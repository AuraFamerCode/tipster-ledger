import { describe, expect, it } from "vitest";
import {
  calibrationFactor,
  credibility,
  FADE_MIN_N,
  recalibrate,
  settledRows,
  weightForSegment,
  weightFromBrier,
  type Settled,
} from "@/lib/scoring/credibility";
import type { LedgerEvent, Pick } from "@/lib/types";

const rows = (spec: Array<[number, 0 | 1]>, segment = "T20"): Settled[] => spec.map(([p, result]) => ({ p, result, segment }));
const repeat = <T,>(xs: T[], k: number) => Array.from({ length: k }, () => xs).flat();

describe("credibility", () => {
  it("no history = neutral weight 1 and factor 1", () => {
    const c = credibility("x", []);
    expect(c.weight).toBe(1);
    expect(c.calibrationFactor).toBe(1);
    expect(c.status).toBe("learning");
  });

  it("weights grow with skill and shrink with small samples", () => {
    expect(weightFromBrier(0.1, 20)).toBeGreaterThan(weightFromBrier(0.1, 2));
    expect(weightFromBrier(0.1, 20)).toBeGreaterThan(1);
    expect(weightFromBrier(0.35, 20)).toBeLessThan(1);
    expect(weightFromBrier(0.25, 50)).toBeCloseTo(1);
  });

  it("an overconfident source gets a calibration factor below 1", () => {
    // says 90% but only wins 60% of the time
    const r = rows(repeat<[number, 0 | 1]>([[0.9, 0], [0.9, 0], [0.9, 0], [0.9, 1], [0.9, 1]], 4));
    const f = calibrationFactor(r);
    expect(f).toBeLessThan(0.8);
    expect(f).toBeGreaterThan(0);
    expect(recalibrate(0.9, f)).toBeLessThan(0.9);
  });

  it("never inverts ('fades') a source on a small sample", () => {
    const wrong = rows(repeat<[number, 0 | 1]>([[0.8, 1]], FADE_MIN_N - 1));
    expect(calibrationFactor(wrong)).toBeGreaterThanOrEqual(0);
    const consistentlyWrong = rows(repeat<[number, 0 | 1]>([[0.8, 1]], 30));
    expect(calibrationFactor(consistentlyWrong)).toBeLessThan(0);
    expect(credibility("x", consistentlyWrong).status).toBe("fade");
  });

  it("a source that is reliably right becomes trusted; one that is reliably wrong gets muted", () => {
    const good = credibility("g", rows(repeat<[number, 0 | 1]>([[0.8, 0], [0.75, 0], [0.3, 1]], 7)));
    expect(good.status).toBe("trusted");
    const bad = credibility("b", rows(repeat<[number, 0 | 1]>([[0.7, 1], [0.65, 0], [0.7, 1]], 3)));
    expect(bad.weight).toBeLessThan(good.weight);
  });

  it("segment weights only kick in with enough segment history", () => {
    const c = credibility("s", [
      ...rows(repeat<[number, 0 | 1]>([[0.65, 0]], 6), "ODI"),
      ...rows(repeat<[number, 0 | 1]>([[0.65, 1]], 4), "T20"),
      ...rows([[0.65, 0]], "Test"),
    ]);
    expect(weightForSegment(c, "ODI")).toBeGreaterThan(c.weight); // specialist
    expect(weightForSegment(c, "T20")).toBeLessThan(c.weight); // poor in this segment
    expect(weightForSegment(c, "Test")).toBe(c.weight); // n=1 < SEGMENT_MIN_N
    expect(weightForSegment(c, "IPL")).toBe(c.weight); // never seen
  });

  it("picks logged after the start are not scored", () => {
    const ev: LedgerEvent = {
      id: "e",
      sport: "cricket",
      competition: "T20",
      title: "A vs B",
      outcomes: ["A", "B"],
      startsAt: "2026-10-20T10:00:00Z",
      result: 0,
    };
    const picks: Pick[] = [
      { id: "1", eventId: "e", sourceId: "early", probability: 0.7, loggedAt: "2026-10-20T08:00:00Z" },
      { id: "2", eventId: "e", sourceId: "late", probability: 0.99, loggedAt: "2026-10-20T11:00:00Z" },
    ];
    const r = settledRows([ev], picks);
    expect(r.get("early")).toHaveLength(1);
    expect(r.has("late")).toBe(false);
  });
});
