/**
 * Server-side orchestration: persists ledger state to .data/state.json, writes/recalls memories through
 * the configured MemoryStore, and builds the dashboard view model. All business rules live in ledger.ts.
 */
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { getMemoryStore, type StoredMemory } from "../memory";
import { computeCredibility, eventView, memoryLift, rebuildFromMemories, settle, weightsFromMemory, type LedgerState } from "./ledger";
import { SEED_FETCHED_AT, SEED_SOURCES, seedEventsUnsettled, seedPicks, seedResult } from "./seed";
import type { LedgerEvent, Pick, Source } from "../types";

const DATA_DIR = process.env.TIPSTER_DATA_DIR ?? path.join(process.cwd(), ".data");
const STATE_FILE = path.join(DATA_DIR, "state.json");
const CACHE_FILE = path.join(DATA_DIR, "memory-cache.json");

export function initialState(): LedgerState {
  return {
    sources: SEED_SOURCES,
    events: seedEventsUnsettled(),
    picks: seedPicks(),
    replayCursor: 0,
    mode: "demo",
    emittedLessons: [],
    history: [],
  };
}

function readJson<T>(file: string, fallback: T): T {
  return existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as T) : fallback;
}
function writeJson(file: string, data: unknown) {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(data, null, 2));
}

export const loadState = (): LedgerState => readJson(STATE_FILE, initialState());
export const saveState = (s: LedgerState) => writeJson(STATE_FILE, s);
/** Local mirror of the memories the app is running on (what was written, or what was recalled from Walrus). */
export const loadCache = (): StoredMemory[] => readJson(CACHE_FILE, [] as StoredMemory[]);
const saveCache = (c: StoredMemory[]) => writeJson(CACHE_FILE, c);

// Serialise mutations: settlement + memory write must not interleave.
let chain: Promise<unknown> = Promise.resolve();
function exclusive<T>(fn: () => Promise<T>): Promise<T> {
  const run = chain.then(fn, fn);
  chain = run.catch(() => undefined);
  return run;
}

export async function settleAndRemember(eventId: string, result: 0 | 1, resultSource?: string) {
  return exclusive(async () => {
    const state = loadState();
    const cache = loadCache();
    const out = settle(state, eventId, result, resultSource, cache.map((c) => c.memory));
    const store = await getMemoryStore();
    const stored = await store.remember(out.memories); // throws -> state not saved, nothing half-learned
    saveState(out.state);
    saveCache([...stored, ...cache]);
    return { event: out.event, stored };
  });
}

export async function replayStep() {
  const state = loadState();
  const next = state.events.filter((e) => e.result === undefined && seedResult(e.id))[0];
  if (!next) throw new Error("Replay finished: every seed match is settled.");
  const r = seedResult(next.id)!;
  const res = await settleAndRemember(next.id, r.result, r.source);
  const s = loadState();
  s.replayCursor += 1;
  saveState(s);
  return res;
}

/** Forget everything local (picks, results, cached memories). Walrus Memory is untouched. */
export async function resetLocal() {
  return exclusive(async () => {
    rmSync(STATE_FILE, { force: true });
    rmSync(CACHE_FILE, { force: true });
    return { ok: true };
  });
}

/** Rebuild the app's knowledge from the memory store (Walrus Memory on mainnet when configured). */
export async function restoreFromMemory() {
  return exclusive(async () => {
    const store = await getMemoryStore();
    const recalled = await store.recallLatest(100);
    saveCache(recalled);
    const rebuilt = rebuildFromMemories(loadState(), recalled.map((r) => r.memory));
    saveState(rebuilt);
    return {
      recalled: recalled.length,
      backend: store.info().backend,
      eventsRestored: rebuilt.events.filter((e) => e.result !== undefined).length,
    };
  });
}

export async function addPick(input: { eventId: string; probability: number; sourceId?: string; sourceName?: string; note?: string }) {
  return exclusive(async () => {
    const state = loadState();
    const ev = state.events.find((e) => e.id === input.eventId);
    if (!ev) throw new Error("unknown event");
    if (ev.result !== undefined) throw new Error("event already settled");
    if (Date.now() > new Date(ev.startsAt).getTime()) throw new Error("picks lock at the start time: this one would not be scored");
    if (!(input.probability > 0 && input.probability < 1)) throw new Error("probability must be between 0 and 1");
    let sourceId = input.sourceId;
    if (!sourceId && input.sourceName) {
      const name = input.sourceName.trim().slice(0, 40);
      const existing = state.sources.find((s) => s.name.toLowerCase() === name.toLowerCase());
      sourceId = existing?.id ?? `src-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
      if (!existing) state.sources.push({ id: sourceId, name, kind: "tipster", style: "Added by you." } satisfies Source);
    }
    if (!sourceId) throw new Error("sourceId or sourceName required");
    const pick: Pick = {
      id: `${ev.id}:${sourceId}`,
      eventId: ev.id,
      sourceId,
      probability: input.probability,
      loggedAt: new Date().toISOString(),
      note: input.note,
    };
    state.picks = [...state.picks.filter((p) => p.id !== pick.id), pick];
    saveState(state);
    return pick;
  });
}

export async function addEvent(ev: Omit<LedgerEvent, "id"> & { id?: string }) {
  return exclusive(async () => {
    const state = loadState();
    const id = ev.id ?? `ev-${Date.now().toString(36)}`;
    if (state.events.some((e) => e.id === id)) return state.events.find((e) => e.id === id)!;
    const event: LedgerEvent = { ...ev, id, result: undefined };
    state.events.push(event);
    state.mode = "live";
    saveState(state);
    return event;
  });
}

export async function dashboard() {
  const state = loadState();
  const cache = loadCache();
  const store = await getMemoryStore();
  const memories = cache.map((c) => c.memory);
  const weights = weightsFromMemory(memories);
  const cred = computeCredibility(state);
  const unsettled = state.events.filter((e) => e.result === undefined).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const upcoming = unsettled.slice(0, 4).map((e) => ({ ...eventView(e, state.picks, weights), seed: Boolean(seedResult(e.id)) }));
  const settled = state.events
    .filter((e) => e.result !== undefined)
    .map((e) => ({ event: e, shown: state.history.find((h) => h.eventId === e.id) }))
    .reverse()
    .slice(0, 12);
  const leaderboard = state.sources
    .map((s) => {
      const w = weights.get(s.id);
      const c = cred.get(s.id)!;
      return {
        source: s,
        remembered: w ?? null,
        local: { n: c.n, brier: c.raw.brier, hitRate: c.raw.hitRate, overconfidence: c.raw.overconfidence },
      };
    })
    .sort((a, b) => (b.remembered?.weight ?? 1) - (a.remembered?.weight ?? 1));
  return {
    memory: {
      ...store.info(),
      count: cache.length,
      scorecards: cache.filter((c) => c.memory.kind === "scorecard").length,
      insights: cache.filter((c) => c.memory.kind === "insight").length,
      timeline: cache.slice(0, 30).map((c) => ({ ...c.memory, blobId: c.blobId, backend: c.backend })),
      hasMemory: weights.size > 0,
    },
    leaderboard,
    upcoming,
    settled,
    lift: { all: memoryLift(state.history), last10: memoryLift(state.history, 10) },
    replay: {
      settled: state.events.filter((e) => e.result !== undefined && seedResult(e.id)).length,
      total: state.events.filter((e) => seedResult(e.id)).length,
      seedFetchedAt: SEED_FETCHED_AT,
    },
    mode: state.mode,
  };
}

export type Dashboard = Awaited<ReturnType<typeof dashboard>>;
