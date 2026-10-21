/**
 * Regenerates data/seed/matches.json from PUBLIC Polymarket data:
 *  - resolved cricket match-winner ("moneyline") markets from the Gamma API
 *  - the last traded price BEFORE the scheduled start from the CLOB prices-history API
 *
 * Results and prices are real. Nothing here needs an API key.
 * Usage: npm run seed:fetch -- [count=16] [minVolumeUsd=2000]
 */
import { writeFileSync } from "node:fs";
import path from "node:path";
import type { LedgerEvent } from "../src/lib/types";
import { competitionFromTitle } from "../src/lib/polymarket/gamma";

const GAMMA = "https://gamma-api.polymarket.com";
const CLOB = "https://clob.polymarket.com";
const UA = { "user-agent": "tipster-ledger/0.1 (+https://github.com/AuraFamerCode/tipster-ledger)" };

const count = Number(process.argv[2] ?? 16);
const minVolume = Number(process.argv[3] ?? 2000);

interface GammaMarket {
  question: string;
  slug: string;
  outcomes: string;
  outcomePrices: string;
  clobTokenIds: string;
  gameStartTime?: string;
  sportsMarketType?: string;
  volumeNum?: number;
  umaResolutionStatus?: string;
}
interface GammaEvent { slug: string; title: string; markets: GammaMarket[] }

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: UA });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return (await res.json()) as T;
}

async function preMatchPrice(tokenId: string, startUnix: number): Promise<number | undefined> {
  const { history } = await getJson<{ history: { t: number; p: number }[] }>(
    `${CLOB}/prices-history?market=${tokenId}&interval=max&fidelity=60`,
  );
  const before = history.filter((h) => h.t <= startUnix);
  return before.length ? before[before.length - 1].p : undefined;
}

async function main() {
  const picked: LedgerEvent[] = [];
  for (let offset = 0; offset < 1000 && picked.length < count; offset += 100) {
    const events = await getJson<GammaEvent[]>(
      `${GAMMA}/events?tag_slug=cricket&closed=true&limit=100&offset=${offset}&order=endDate&ascending=false`,
    );
    if (!events.length) break;
    for (const ev of events) {
      const m = ev.markets.find((x) => x.sportsMarketType === "moneyline");
      if (!m || !m.gameStartTime || (m.volumeNum ?? 0) < minVolume) continue;
      const prices = JSON.parse(m.outcomePrices) as string[];
      if (!(prices[0] === "1" || prices[1] === "1")) continue; // skip 50-50 / void
      const outcomes = JSON.parse(m.outcomes) as [string, string];
      const tokens = JSON.parse(m.clobTokenIds) as string[];
      const start = new Date(m.gameStartTime.replace(" ", "T").replace("+00", "Z"));
      const price = await preMatchPrice(tokens[0], Math.floor(start.getTime() / 1000));
      if (price === undefined || price <= 0.02 || price >= 0.98) continue;
      picked.push({
        id: ev.slug,
        sport: "cricket",
        competition: competitionFromTitle(m.question),
        title: m.question,
        outcomes,
        startsAt: start.toISOString(),
        marketPrice: Number(price.toFixed(3)),
        marketSource: { name: "Polymarket (last trade before start)", url: `https://polymarket.com/event/${ev.slug}` },
        result: prices[0] === "1" ? 0 : 1,
        resultSource: `Polymarket resolution (UMA): https://polymarket.com/event/${ev.slug}`,
      });
      if (picked.length >= count) break;
    }
  }
  picked.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const out = path.join(process.cwd(), "data/seed/matches.json");
  writeFileSync(
    out,
    JSON.stringify({ fetchedAt: new Date().toISOString(), source: "Polymarket Gamma + CLOB public APIs", events: picked }, null, 2),
  );
  console.log(`wrote ${picked.length} resolved cricket matches -> ${out}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
