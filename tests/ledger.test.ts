import { describe, expect, it } from "vitest";
import { consensus, memoryLift, rebuildFromMemories, settle, weightsFromMemory, type LedgerState } from "@/lib/engine/ledger";
import { SEED_EVENTS, SEED_SOURCES, seedEventsUnsettled, seedPicks, seedResult } from "@/lib/engine/seed";
import type { CredibilityMemory } from "@/lib/types";

const fresh = (): LedgerState => ({
  sources: SEED_SOURCES,
  events: seedEventsUnsettled(),
  picks: seedPicks(),
  replayCursor: 0,
  mode: "demo",
  emittedLessons: [],
  history: [],
});

function replayAll() {
  let state = fresh();
  const memories: CredibilityMemory[] = [];
  let t = Date.parse("2026-10-21T00:00:00Z");
  for (const ev of seedEventsUnsettled()) {
    const r = seedResult(ev.id)!;
    const out = settle(state, ev.id, r.result, r.source, memories, new Date((t += 60_000)));
    state = out.state;
    memories.push(...out.memories);
  }
  return { state, memories };
}

describe("seed data", () => {
  it("has real resolved matches with pre-match prices and sources", () => {
    expect(SEED_EVENTS.length).toBeGreaterThanOrEqual(10);
    for (const e of SEED_EVENTS) {
      expect(e.result === 0 || e.result === 1).toBe(true);
      expect(e.marketPrice).toBeGreaterThan(0);
      expect(e.marketSource?.url).toMatch(/^https:\/\/polymarket\.com\/event\//);
    }
  });
  it("persona picks are logged before the start and never depend on results", () => {
    for (const p of seedPicks()) {
      const ev = SEED_EVENTS.find((e) => e.id === p.eventId)!;
      expect(new Date(p.loggedAt) < new Date(ev.startsAt)).toBe(true);
    }
    const unsettled = seedEventsUnsettled();
    expect(unsettled.every((e) => e.result === undefined)).toBe(true);
  });
});

describe("learning loop", () => {
  it("before any memory, the weighted consensus equals the naive one", () => {
    const s = fresh();
    const c = consensus(s.events[0], s.picks, new Map())!;
    expect(c.weighted).toBeCloseTo(c.naive);
    expect(c.weights.every((w) => w.weight === 1)).toBe(true);
  });

  it("settling writes a scorecard carrying the full record, plus lessons", () => {
    const s = fresh();
    const ev = s.events[0];
    const out = settle(s, ev.id, seedResult(ev.id)!.result, undefined, [], new Date("2026-10-21T00:00:00Z"));
    const card = out.memories[0];
    expect(card.kind).toBe("scorecard");
    expect(card.record?.picks.length).toBeGreaterThan(0);
    expect(card.record?.shown?.usedMemory).toBe(false);
    expect(() => settle(out.state, ev.id, 0, undefined, out.memories)).toThrow(/already settled/);
  });

  it("the full replay stores well over 10 memories and each lesson only once", () => {
    const { state, memories } = replayAll();
    expect(memories.length).toBeGreaterThanOrEqual(SEED_EVENTS.length);
    const lessons = memories.filter((m) => m.kind === "insight").map((m) => m.lesson);
    expect(new Set(lessons).size).toBe(lessons.length);
    expect(new Set(state.emittedLessons).size).toBe(state.emittedLessons.length);
  });

  it("memory changes the product: weights diverge from 1 and recommendations shift", () => {
    const { state, memories } = replayAll();
    const w = weightsFromMemory(memories);
    const weights = [...w.values()].map((x) => x.weight);
    expect(Math.max(...weights) / Math.min(...weights)).toBeGreaterThan(3);
    const ev = state.events[state.events.length - 1];
    const before = consensus(ev, state.picks, new Map())!;
    const after = consensus(ev, state.picks, w)!;
    expect(Math.abs(after.weighted - before.naive)).toBeGreaterThan(0.03);
  });

  it("memory-weighted predictions beat equal weights on the later matches (out of sample)", () => {
    const { state } = replayAll();
    const last10 = memoryLift(state.history, 10);
    expect(last10.n).toBe(10);
    expect(last10.weighted).toBeLessThan(last10.naive);
  });

  it("the whole ledger can be rebuilt from memories alone", () => {
    const { state, memories } = replayAll();
    const rebuilt = rebuildFromMemories(fresh(), memories);
    expect(rebuilt.events.filter((e) => e.result !== undefined)).toHaveLength(state.events.length);
    expect(rebuilt.history).toHaveLength(state.history.length);
    expect(memoryLift(rebuilt.history).weighted).toBeCloseTo(memoryLift(state.history).weighted, 2);
  });
});
