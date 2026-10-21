import { describe, expect, it } from "vitest";
import { competitionFromTitle, parseGammaEvents } from "@/lib/polymarket/gamma";

describe("polymarket", () => {
  it("classifies competitions from market titles", () => {
    expect(competitionFromTitle("Indian Premier League: CSK vs MI")).toBe("IPL");
    expect(competitionFromTitle("England and Sri Lanka Tour of Pakistan ODIs: Pakistan vs England")).toBe("ODI");
    expect(competitionFromTitle("New Zealand Women Tour of Australia T20s: Australia Women vs New Zealand Women")).toBe("Women's T20");
    expect(competitionFromTitle("ICC Men's T20 World Cup Africa Sub Regional Qualifier C: Uganda vs Zambia")).toBe("T20");
    expect(competitionFromTitle("Some Cup: A vs B")).toBe("Other");
  });

  it("parses Gamma events, preferring the moneyline market and skipping closed ones", () => {
    const events = parseGammaEvents([
      {
        slug: "crint-ken-dnk-2026-10-21",
        markets: [
          { question: "Kenya vs Denmark - Who wins the toss?", outcomes: '["Kenya","Denmark"]', outcomePrices: '["0.5","0.5"]', sportsMarketType: "cricket_toss_winner" },
          { question: "ICC Cricket World Cup Challenge League A: Kenya vs Denmark", outcomes: '["Kenya","Denmark"]', outcomePrices: '["0.765","0.235"]', sportsMarketType: "moneyline", gameStartTime: "2026-10-21 06:30:00+00" },
        ],
      },
      { slug: "closed", markets: [{ question: "x", outcomes: '["a","b"]', outcomePrices: '["1","0"]', sportsMarketType: "moneyline", closed: true }] },
    ]);
    expect(events).toHaveLength(1);
    expect(events[0].marketPrice).toBe(0.765);
    expect(events[0].startsAt).toBe("2026-10-21T06:30:00.000Z");
    expect(events[0].marketSource?.url).toBe("https://polymarket.com/event/crint-ken-dnk-2026-10-21");
  });
});
