/**
 * Demo seed: REAL resolved cricket matches (data/seed/matches.json, pulled from Polymarket's public APIs)
 * + four SYNTHETIC, rule-based tipster personas. The personas never see results: each pick is a fixed rule
 * applied to the real pre-match market price, logged 2h before the start. Whatever they score is what the
 * real results gave them, so the learning loop runs on honest data.
 */
import seed from "../../../data/seed/matches.json";
import type { LedgerEvent, Pick, Source } from "../types";

export const SEED_EVENTS = (seed as unknown as { events: LedgerEvent[] }).events;
export const SEED_FETCHED_AT = (seed as { fetchedAt: string }).fetchedAt;

export const MARKET_SOURCE_ID = "polymarket";

export const SEED_SOURCES: Source[] = [
  { id: "farhan", name: "Favourite Farhan", kind: "tipster", style: "Always backs the market favourite at 88%. (Synthetic persona.)" },
  { id: "umesh", name: "Underdog Umesh", kind: "tipster", style: "Always backs the underdog at 65%. (Synthetic persona.)" },
  { id: "harsh", name: "Home-Side Harsh", kind: "tipster", style: "Always backs the first-listed side at 68%. (Synthetic persona.)" },
  {
    id: "kavya",
    name: "Analyst Kavya",
    kind: "analyst",
    style: "Hedged market view on men's cricket; says 50/50 on women's T20 (no read). (Synthetic persona.)",
  },
  { id: "me", name: "Me", kind: "me", style: "Your own picks." },
  { id: MARKET_SOURCE_ID, name: "Polymarket price", kind: "market", style: "Benchmark: the prediction-market price before start. Not part of consensus." },
];

export function personaProbability(sourceId: string, ev: LedgerEvent): number | null {
  const m = ev.marketPrice;
  if (m === undefined) return null;
  const favIsHome = m >= 0.5;
  switch (sourceId) {
    case "farhan":
      return favIsHome ? 0.88 : 0.12;
    case "umesh":
      return favIsHome ? 0.35 : 0.65;
    case "harsh":
      return 0.68;
    case "kavya":
      return ev.competition === "Women's T20" ? 0.5 : Number((0.5 + (m - 0.5) * 0.85).toFixed(3));
    case MARKET_SOURCE_ID:
      return m;
    default:
      return null;
  }
}

/** Seed events with results stripped (results are revealed one at a time by the replay). */
export function seedEventsUnsettled(): LedgerEvent[] {
  return SEED_EVENTS.map(({ result: _r, resultSource: _s, ...e }) => ({ ...e }));
}

export function seedResult(eventId: string): { result: 0 | 1; source?: string } | null {
  const e = SEED_EVENTS.find((x) => x.id === eventId);
  return e && e.result !== undefined ? { result: e.result, source: e.resultSource } : null;
}

export function seedPicks(): Pick[] {
  const picks: Pick[] = [];
  for (const ev of SEED_EVENTS) {
    const loggedAt = new Date(new Date(ev.startsAt).getTime() - 2 * 3600_000).toISOString();
    for (const s of SEED_SOURCES) {
      const p = personaProbability(s.id, ev);
      if (p === null) continue;
      picks.push({ id: `${ev.id}:${s.id}`, eventId: ev.id, sourceId: s.id, probability: p, loggedAt });
    }
  }
  return picks;
}
