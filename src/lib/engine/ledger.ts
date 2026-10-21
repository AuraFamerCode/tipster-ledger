/**
 * The learning loop, as pure functions:
 *
 *   picks (before start) ──► settle(result) ──► credibility() ──► scorecard + lessons ──► Walrus Memory
 *                                                                                           │
 *   recommendations ◄── consensus(weights FROM MEMORY) ◄── latest scorecard recalled ◄──────┘
 *
 * The product never reads weights from local pick history directly; it reads the newest scorecard memory.
 * That's what makes memory portable: wipe local state, recall from Walrus, and the app still knows who to trust.
 */
import { credibility, MUTE_BELOW, recalibrate, settledRows, weightForSegment, type Credibility } from "../scoring/credibility";
import { analyse, devig, type DisagreementReport } from "../odds/disagreement";
import type { ConsensusView, CredibilityMemory, LedgerEvent, Pick, Source } from "../types";
import { MARKET_SOURCE_ID } from "./seed";

export interface LedgerState {
  sources: Source[];
  events: LedgerEvent[];
  picks: Pick[];
  /** Index of the next seed event the demo replay will settle. */
  replayCursor: number;
  mode: "demo" | "live";
  /** Keys of lessons already written, so each lesson is learned (and stored) once. */
  emittedLessons: string[];
  /** Prequential record: the consensus the app showed BEFORE each result was known. Drives the "memory lift" metric. */
  history: Array<{ eventId: string; naive: number; weighted: number; market?: number; result: 0 | 1; usedMemory: boolean }>;
}

export type MemoryWeights = CredibilityMemory["sources"][number];

export function computeCredibility(state: LedgerState): Map<string, Credibility> {
  const rows = settledRows(state.events, state.picks);
  const out = new Map<string, Credibility>();
  for (const s of state.sources) out.set(s.id, credibility(s.id, rows.get(s.id) ?? []));
  return out;
}

const pct = (x: number) => `${Math.round(x * 100)}%`;
const article = (w: string) => (/^[aeiou]|^ODI|^IPL/i.test(w) ? "an" : "a");

/** Compare credibility before/after a settlement and describe threshold crossings in plain English. */
export interface Lesson {
  key: string;
  text: string;
}

export function lessons(prev: Map<string, Credibility>, next: Map<string, Credibility>, sources: Source[]): Lesson[] {
  const out: Lesson[] = [];
  const push = (key: string, text: string) => out.push({ key, text });
  for (const s of sources) {
    const a = prev.get(s.id);
    const b = next.get(s.id);
    if (!b || b.n < 3) continue;
    if (s.kind === "market") {
      // The benchmark only earns one kind of lesson: being worth listening to.
      if (b.status === "trusted" && a?.status !== "trusted")
        push(`trust:${s.id}`, `The ${s.name} has out-forecast the tipsters (Brier ${b.raw.brier.toFixed(3)} over ${b.n}); it now carries weight ${b.weight.toFixed(2)} in the ledger.`);
      continue;
    }
    if (a?.status !== b.status) {
      if (b.status === "trusted") push(`trust:${s.id}`, `Now trusting ${s.name}: Brier ${b.raw.brier.toFixed(3)} over ${b.n} picks, weight ${b.weight.toFixed(2)}.`);
      if (b.status === "muted") push(`mute:${s.id}`, `Muting ${s.name}: no better than a coin flip (Brier ${b.raw.brier.toFixed(3)} over ${b.n} picks).`);
      if (b.status === "fade")
        push(`fade:${s.id}`, `${s.name} is a fade signal: favoured side won only ${pct(b.raw.hitRate)} of ${b.n} picks, so their view is now inverted.`);
    }
    const wasCalibrated = !a || a.n < 3 || a.calibrationFactor >= 0.8;
    if (b.calibrationFactor >= 0 && b.calibrationFactor < 0.8 && wasCalibrated) {
      const typical = Math.round((b.raw.overconfidence + b.raw.hitRate) * 100) / 100; // mean stated confidence
      if (typical - recalibrate(typical, b.calibrationFactor) >= 0.03)
        push(`overconfident:${s.id}`, `${s.name} is overconfident: their typical ${pct(typical)} now counts as ${pct(recalibrate(typical, b.calibrationFactor))}.`);
    }
    for (const [seg, st] of Object.entries(b.segments)) {
      const before = a?.segments[seg];
      if (st.n >= 3 && st.weight >= 1.5 && (!before || before.n < 3 || before.weight < 1.5) && b.weight < 1.5)
        push(`specialist:${s.id}:${seg}`, `${s.name} is ${article(seg)} ${seg} specialist (weight ${st.weight.toFixed(2)} there vs ${b.weight.toFixed(2)} overall).`);
      if (st.n >= 3 && st.weight < MUTE_BELOW && (!before || before.n < 3 || before.weight >= MUTE_BELOW) && b.weight >= MUTE_BELOW)
        push(`ignore:${s.id}:${seg}`, `Ignoring ${s.name} on ${seg} (weight ${st.weight.toFixed(2)} there).`);
    }
  }
  return out;
}

export function scorecardMemory(
  state: LedgerState,
  event: LedgerEvent,
  cred: Map<string, Credibility>,
  writtenAt = new Date().toISOString(),
): CredibilityMemory {
  return {
    kind: "scorecard",
    version: 1,
    writtenAt,
    eventId: event.id,
    eventTitle: event.title,
    result: event.result === undefined ? "unsettled" : event.outcomes[event.result],
    sources: state.sources
      .filter((s) => (cred.get(s.id)?.n ?? 0) > 0)
      .map((s) => {
        const c = cred.get(s.id)!;
        return {
          sourceId: s.id,
          name: s.name,
          n: c.n,
          brier: round(c.raw.brier),
          hitRate: round(c.raw.hitRate),
          overconfidence: round(c.raw.overconfidence),
          weight: round(c.weight),
          calibrationFactor: round(c.calibrationFactor),
          status: c.status,
          segments: Object.fromEntries(Object.entries(c.segments).map(([k, v]) => [k, { n: v.n, brier: round(v.brier), weight: round(v.weight) }])),
        };
      }),
  };
}

const clamp = (p: number) => Math.min(0.99, Math.max(0.01, p));
const logit = (p: number) => Math.log(p / (1 - p));
const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));
const round = (x: number) => Math.round(x * 1000) / 1000;

/**
 * Settle one event and produce the memories to write (1 scorecard + 0..n new lessons). Returns a new state.
 * `priorMemories` are the memories the app is currently running on; we snapshot what it recommended before the result.
 */
export function settle(
  state: LedgerState,
  eventId: string,
  result: 0 | 1,
  resultSource: string | undefined,
  priorMemories: CredibilityMemory[],
  now = new Date(),
): { state: LedgerState; memories: CredibilityMemory[]; event: LedgerEvent } {
  const before = computeCredibility(state);
  const shown = state.events.find((e) => e.id === eventId);
  if (!shown) throw new Error(`unknown event ${eventId}`);
  if (shown.result !== undefined) throw new Error(`event ${eventId} already settled`);
  const remembered = weightsFromMemory(priorMemories);
  const view = consensus(shown, state.picks, remembered);
  const events = state.events.map((e) => (e.id === eventId ? { ...e, result, resultSource } : e));
  const event = events.find((e) => e.id === eventId)!;
  const fresh = lessons(before, computeCredibility({ ...state, events }), state.sources).filter((l) => !state.emittedLessons.includes(l.key));
  const next: LedgerState = {
    ...state,
    events,
    emittedLessons: [...state.emittedLessons, ...fresh.map((l) => l.key)],
    history: view
      ? [...state.history, { eventId, naive: view.naive, weighted: view.weighted, market: shown.marketPrice, result, usedMemory: remembered.size > 0 }]
      : state.history,
  };
  const after = computeCredibility(next);
  const writtenAt = now.toISOString();
  const card: CredibilityMemory = {
    ...scorecardMemory(next, event, after, writtenAt),
    record: {
      event: {
        id: event.id,
        sport: event.sport,
        competition: event.competition,
        title: event.title,
        outcomes: event.outcomes,
        startsAt: event.startsAt,
        marketPrice: event.marketPrice,
      },
      result,
      picks: state.picks.filter((p) => p.eventId === eventId).map((p) => [p.sourceId, p.probability, p.loggedAt]),
      shown: view ? { naive: round(view.naive), weighted: round(view.weighted), usedMemory: remembered.size > 0 } : undefined,
    },
  };
  const memories: CredibilityMemory[] = [card];
  // Lessons carry the scorecard snapshot but not the record (it lives once, on the scorecard).
  fresh.forEach((l, i) => memories.push({ ...card, record: undefined, kind: "insight", lesson: l.text, writtenAt: new Date(now.getTime() + i + 1).toISOString() }));
  return { state: next, memories, event };
}

/** Weights as remembered: newest scorecard wins. Empty map = no memory yet = everyone counts equally. */
export function weightsFromMemory(memories: CredibilityMemory[]): Map<string, MemoryWeights> {
  const latest = [...memories].filter((m) => m.kind === "scorecard").sort((a, b) => b.writtenAt.localeCompare(a.writtenAt))[0];
  return new Map((latest?.sources ?? []).map((s) => [s.sourceId, s]));
}

export function consensus(event: LedgerEvent, picks: Pick[], weights: Map<string, MemoryWeights>): ConsensusView | null {
  const forEvent = picks.filter((p) => p.eventId === event.id);
  const tipsters = forEvent.filter((p) => p.sourceId !== MARKET_SOURCE_ID);
  if (!tipsters.length) return null;
  // No memory: every tipster counts the same (same log-odds pooling, equal weights); the market is just a reference line.
  const naive = sigmoid(tipsters.reduce((a, p) => a + logit(clamp(p.probability)), 0) / tipsters.length);
  // With memory: the market price is one more voice, and has to earn its weight like everyone else.
  const relevant = weights.size ? forEvent : tipsters;
  let num = 0;
  let den = 0;
  const rows = relevant.map((p) => {
    const w = weights.get(p.sourceId);
    const weight = w ? weightForSegment(w, event.competition) : 1;
    const adj = w ? recalibrate(p.probability, w.calibrationFactor) : p.probability;
    num += weight * logit(clamp(adj));
    den += weight;
    return { sourceId: p.sourceId, weight, probability: p.probability, adjusted: adj };
  });
  // Log-odds pooling: a confident, trusted voice (e.g. a 97% market) isn't diluted toward 50% the way a linear mean dilutes it.
  return { eventId: event.id, naive, weighted: den ? sigmoid(num / den) : naive, weights: rows };
}

export interface EventView {
  event: LedgerEvent;
  consensus: ConsensusView | null;
  bookmakerP0?: number;
  report: DisagreementReport;
}

export function eventView(event: LedgerEvent, picks: Pick[], weights: Map<string, MemoryWeights>): EventView {
  const c = consensus(event, picks, weights);
  const bookmakerP0 = event.bookmakerOdds ? devig(event.bookmakerOdds).p0 : undefined;
  const evidence = [...weights.values()].filter((w) => w.sourceId !== MARKET_SOURCE_ID).reduce((a, w) => a + w.n, 0);
  const report = analyse(
    [
      { label: "Market (Polymarket)", p0: event.marketPrice },
      { label: "Bookmaker (de-vigged)", p0: bookmakerP0 },
      { label: "Tipsters, no memory", p0: c?.naive },
      { label: "Tipsters, memory-weighted", p0: c?.weighted },
    ],
    event.outcomes,
    { weighted: c?.weighted, market: event.marketPrice ?? bookmakerP0, evidence, minEvidence: 6 },
  );
  return { event, consensus: c, bookmakerP0, report };
}

/** Out-of-sample Brier of what the app actually showed: no-memory consensus vs memory-weighted vs market. */
export function memoryLift(history: LedgerState["history"], lastN?: number) {
  const rows = (lastN ? history.slice(-lastN) : history).filter((h) => h.usedMemory);
  const b = (p: number, r: 0 | 1) => (p - (r === 0 ? 1 : 0)) ** 2;
  const avg = (f: (h: (typeof rows)[number]) => number) => (rows.length ? rows.reduce((a, h) => a + f(h), 0) / rows.length : NaN);
  const naive = avg((h) => b(h.naive, h.result));
  const weighted = avg((h) => b(h.weighted, h.result));
  const marketRows = rows.filter((h) => h.market !== undefined);
  const market = marketRows.length ? marketRows.reduce((a, h) => a + b(h.market!, h.result), 0) / marketRows.length : NaN;
  return { n: rows.length, naive, weighted, market, improvement: rows.length ? (naive - weighted) / naive : NaN };
}

/**
 * Rebuild ledger state from recalled scorecard memories (Walrus is the source of truth).
 * Sources, events, picks, results and the prequential history are all reconstructed; existing local data wins on conflict.
 */
export function rebuildFromMemories(base: LedgerState, memories: CredibilityMemory[]): LedgerState {
  const state: LedgerState = structuredClone(base);
  const cards = memories.filter((m) => m.kind === "scorecard" && m.record).sort((a, b) => a.writtenAt.localeCompare(b.writtenAt));
  for (const m of cards) {
    const r = m.record!;
    for (const s of m.sources)
      if (!state.sources.some((x) => x.id === s.sourceId)) state.sources.push({ id: s.sourceId, name: s.name, kind: "tipster", style: "Restored from Walrus Memory." });
    let ev = state.events.find((e) => e.id === r.event.id);
    if (!ev) {
      ev = { ...r.event };
      state.events.push(ev);
    }
    if (ev.result === undefined) ev.result = r.result;
    for (const [sourceId, probability, loggedAt] of r.picks)
      if (!state.picks.some((p) => p.eventId === ev!.id && p.sourceId === sourceId))
        state.picks.push({ id: `${ev.id}:${sourceId}`, eventId: ev.id, sourceId, probability, loggedAt });
    if (r.shown && !state.history.some((h) => h.eventId === ev!.id))
      state.history.push({ eventId: ev.id, ...r.shown, market: r.event.marketPrice, result: r.result });
  }
  return state;
}
