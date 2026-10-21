/** Thin client for Polymarket's public Gamma API (no key). Used for live cricket match prices. */
import type { LedgerEvent } from "../types";

const GAMMA = "https://gamma-api.polymarket.com";

export function competitionFromTitle(title: string): string {
  const t = title.toLowerCase();
  if (/\bipl\b|indian premier league/.test(t)) return "IPL";
  if (/women/.test(t) && /t20/.test(t)) return "Women's T20";
  if (/\bt20\b|t20s|t20i/.test(t)) return "T20";
  if (/\bodi\b|odis|one day|world cup league 2|challenge league/.test(t)) return "ODI";
  if (/\btest\b/.test(t)) return "Test";
  if (/major league cricket|big bash|psl|cpl|the hundred|legends/.test(t)) return "Franchise";
  return "Other";
}

interface RawMarket {
  question: string;
  outcomes: string;
  outcomePrices: string;
  gameStartTime?: string;
  sportsMarketType?: string;
  closed?: boolean;
}
interface RawEvent { slug: string; markets: RawMarket[] }

/** Pure parser so it can be unit-tested against a fixture. */
export function parseGammaEvents(events: RawEvent[]): LedgerEvent[] {
  const out: LedgerEvent[] = [];
  for (const ev of events) {
    const m = ev.markets?.find((x) => x.sportsMarketType === "moneyline"); // match winner only
    if (!m || m.closed) continue;
    const outcomes = JSON.parse(m.outcomes) as [string, string];
    const prices = (JSON.parse(m.outcomePrices) as string[]).map(Number);
    if (outcomes.length !== 2 || !Number.isFinite(prices[0])) continue;
    out.push({
      id: ev.slug,
      sport: "cricket",
      competition: competitionFromTitle(m.question),
      title: m.question,
      outcomes,
      startsAt: m.gameStartTime ? new Date(m.gameStartTime.replace(" ", "T").replace("+00", "Z")).toISOString() : new Date().toISOString(),
      marketPrice: prices[0],
      marketSource: { name: "Polymarket (live)", url: `https://polymarket.com/event/${ev.slug}` },
    });
  }
  return out;
}

export async function fetchUpcomingCricket(limit = 8): Promise<LedgerEvent[]> {
  const res = await fetch(`${GAMMA}/events?tag_slug=cricket&closed=false&active=true&limit=50&order=startDate&ascending=false`, {
    headers: { "user-agent": "tipster-ledger/0.1" },
    next: { revalidate: 600 },
  } as RequestInit);
  if (!res.ok) throw new Error(`Polymarket Gamma ${res.status}`);
  const events = parseGammaEvents((await res.json()) as RawEvent[]);
  const now = Date.now();
  return events
    .filter((e) => new Date(e.startsAt).getTime() > now - 3 * 3600_000)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
    .slice(0, limit);
}
