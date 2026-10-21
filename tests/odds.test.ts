import { describe, expect, it } from "vitest";
import { analyse, devig, impliedFromDecimal, levelFor } from "@/lib/odds/disagreement";

describe("odds", () => {
  it("converts decimal odds and removes the bookmaker margin", () => {
    expect(impliedFromDecimal(2)).toBe(0.5);
    const { p0, margin } = devig([1.8, 2.05]);
    expect(margin).toBeCloseTo(1 / 1.8 + 1 / 2.05 - 1);
    expect(p0).toBeGreaterThan(0.5);
    expect(p0 + (1 / 2.05) / (1 / 1.8 + 1 / 2.05)).toBeCloseTo(1);
    expect(() => impliedFromDecimal(1)).toThrow();
  });

  it("classifies disagreement", () => {
    expect(levelFor(0.05)).toBe("agree");
    expect(levelFor(0.12)).toBe("disagree");
    expect(levelFor(0.25)).toBe("strong");
  });

  it("flags the widest gap between sources", () => {
    const r = analyse(
      [
        { label: "market", p0: 0.6 },
        { label: "book", p0: 0.62 },
        { label: "tipsters", p0: 0.85 },
        { label: "missing", p0: undefined },
      ],
      ["India", "Australia"],
    );
    expect(r.signals).toHaveLength(3);
    expect(r.level).toBe("strong");
    expect(r.pair).toEqual(["market", "tipsters"]);
  });

  it("only recommends once enough evidence is behind the weights", () => {
    const early = analyse([], ["A", "B"], { weighted: 0.8, market: 0.6, evidence: 2 });
    expect(early.recommendation.side).toBeNull();
    const later = analyse([], ["A", "B"], { weighted: 0.8, market: 0.6, evidence: 40 });
    expect(later.recommendation.side).toBe(0);
    expect(later.recommendation.text).toMatch(/possible value/);
    const aligned = analyse([], ["A", "B"], { weighted: 0.31, market: 0.3, evidence: 40 });
    expect(aligned.recommendation.side).toBe(1);
    expect(aligned.recommendation.text).toMatch(/In line with the market/);
  });
});
