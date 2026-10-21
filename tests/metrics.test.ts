import { describe, expect, it } from "vitest";
import { brier, brierSkill, calibrationBuckets, confidence, hit, logLoss } from "@/lib/scoring/metrics";

describe("scoring rules", () => {
  it("brier: perfect, wrong and coin-flip forecasts", () => {
    expect(brier(1, 0)).toBe(0);
    expect(brier(1, 1)).toBe(1);
    expect(brier(0.5, 0)).toBe(0.25);
    expect(brier(0.8, 0)).toBeCloseTo(0.04);
    expect(brier(0.8, 1)).toBeCloseTo(0.64);
  });
  it("log loss is finite at the extremes", () => {
    expect(Number.isFinite(logLoss(1, 1))).toBe(true);
    expect(logLoss(0.5, 0)).toBeCloseTo(Math.log(2));
  });
  it("hit counts the favoured side; 50/50 is half a hit", () => {
    expect(hit(0.7, 0)).toBe(1);
    expect(hit(0.7, 1)).toBe(0);
    expect(hit(0.3, 1)).toBe(1);
    expect(hit(0.5, 0)).toBe(0.5);
  });
  it("confidence and skill", () => {
    expect(confidence(0.2)).toBe(0.8);
    expect(brierSkill(0.25)).toBe(0);
    expect(brierSkill(0)).toBe(1);
    expect(brierSkill(0.5)).toBe(-1);
  });
  it("calibration buckets", () => {
    const rows = [
      { p: 0.9, result: 0 as const },
      { p: 0.9, result: 1 as const },
      { p: 0.55, result: 0 as const },
    ];
    const b = calibrationBuckets(rows);
    const top = b.find((x) => x.from === 0.9)!;
    expect(top.n).toBe(2);
    expect(top.hitRate).toBe(0.5);
    expect(b.find((x) => x.from === 0.5)!.n).toBe(1);
  });
});
