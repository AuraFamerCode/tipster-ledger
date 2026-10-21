/**
 * Credibility model: turns a source's settled track record into
 *   (1) a calibration factor  — how much to stretch/shrink their stated probabilities, and
 *   (2) a trust weight        — how much their (recalibrated) view counts in consensus.
 *
 * Everything is shrunk toward "no information" (factor 1, weight 1) by sample size, so one lucky call
 * doesn't make a guru. These numbers are what we persist to Walrus Memory after every settled event.
 */
import { brier, brierSkill, confidence, hit, logLoss, mean } from "./metrics";
import type { LedgerEvent, Pick, SourceStats } from "../types";

export const SHRINK_K = 10; // pseudo-observations of "average source"
export const MIN_WEIGHT = 0.1;
export const MAX_WEIGHT = 5;
export const MUTE_BELOW = 0.35;
export const SEGMENT_MIN_N = 3;
/** A source must be consistently wrong over this many picks before we invert ('fade') their view. */
export const FADE_MIN_N = 12;
/** exp(SKILL_SHARPNESS * skill): how hard skill differences separate weights. */
export const SKILL_SHARPNESS = 10;

export interface Settled {
  p: number;
  result: 0 | 1;
  segment: string; // competition
}

export interface Credibility {
  sourceId: string;
  n: number;
  raw: SourceStats;
  /** p' = 0.5 + (p - 0.5) * factor. <1 = overconfident (shrink), >1 = underconfident, <0 = fade signal. */
  calibrationFactor: number;
  adjustedBrier: number;
  weight: number;
  segments: Record<string, { n: number; brier: number; weight: number }>;
  status: "learning" | "trusted" | "neutral" | "muted" | "fade";
}

export function stats(sourceId: string, segment: string, rows: Settled[]): SourceStats {
  const hits = rows.map((r) => hit(r.p, r.result));
  return {
    sourceId,
    segment,
    n: rows.length,
    brier: mean(rows.map((r) => brier(r.p, r.result))),
    hitRate: mean(hits),
    logLoss: mean(rows.map((r) => logLoss(r.p, r.result))),
    overconfidence: rows.length ? mean(rows.map((r) => confidence(r.p))) - mean(hits) : 0,
  };
}

/** Least-squares stretch factor c minimising Σ(0.5 + c(p-0.5) - y)^2, shrunk toward 1 by n. */
export function calibrationFactor(rows: Settled[], k = SHRINK_K): number {
  if (!rows.length) return 1;
  let num = 0;
  let den = 0;
  for (const r of rows) {
    const d = r.p - 0.5;
    num += d * ((r.result === 0 ? 1 : 0) - 0.5);
    den += d * d;
  }
  if (den === 0) return 1;
  const floor = rows.length >= FADE_MIN_N ? -1 : 0; // never invert a source on a small sample
  const c = Math.max(floor, Math.min(1.5, num / den));
  const shrink = rows.length / (rows.length + k);
  return 1 + (c - 1) * shrink;
}

export const recalibrate = (p: number, factor: number): number => Math.min(0.99, Math.max(0.01, 0.5 + (p - 0.5) * factor));

/** Trust weight from Brier skill, shrunk by sample size, mapped through exp so skill differences compound. */
export function weightFromBrier(meanBrier: number, n: number, k = SHRINK_K): number {
  if (n === 0) return 1;
  const skill = brierSkill(meanBrier) * (n / (n + k));
  return Math.min(MAX_WEIGHT, Math.max(MIN_WEIGHT, Math.exp(SKILL_SHARPNESS * skill)));
}

export function credibility(sourceId: string, rows: Settled[]): Credibility {
  const raw = stats(sourceId, "all", rows);
  const factor = calibrationFactor(rows);
  const adjusted = rows.map((r) => ({ ...r, p: recalibrate(r.p, factor) }));
  const adjustedBrier = mean(adjusted.map((r) => brier(r.p, r.result)));
  // Trust is earned on the RAW record (what the source actually said). Recalibration only reshapes how we read them;
  // scoring the in-sample-recalibrated record would reward overfitting.
  const weight = weightFromBrier(raw.brier, rows.length);

  const segments: Credibility["segments"] = {};
  const bySeg = new Map<string, Settled[]>();
  for (const r of rows) bySeg.set(r.segment, [...(bySeg.get(r.segment) ?? []), r]);
  for (const [seg, segRows] of bySeg) {
    const b = mean(segRows.map((r) => brier(r.p, r.result)));
    segments[seg] = { n: segRows.length, brier: b, weight: weightFromBrier(b, segRows.length) };
  }

  let status: Credibility["status"] = "neutral";
  if (rows.length < 3) status = "learning";
  else if (factor < -0.1 && raw.hitRate < 0.4) status = "fade"; // consistently, clearly wrong
  else if (weight < MUTE_BELOW) status = "muted";
  else if (weight >= 1.5) status = "trusted";

  return { sourceId, n: rows.length, raw, calibrationFactor: factor, adjustedBrier, weight, segments, status };
}

/** Weight to use for a specific upcoming event: blend overall with segment track record once it is meaningful. */
export function weightForSegment(
  c: { weight: number; segments?: Record<string, { n: number; weight: number }> },
  segment: string,
): number {
  const s = c.segments?.[segment];
  if (!s || s.n < SEGMENT_MIN_N) return c.weight;
  return Math.sqrt(c.weight * s.weight); // geometric blend
}

/** Join picks with settled events into per-source rows. Only picks logged before start count. */
export function settledRows(events: LedgerEvent[], picks: Pick[]): Map<string, Settled[]> {
  const byId = new Map(events.map((e) => [e.id, e]));
  const out = new Map<string, Settled[]>();
  for (const pk of picks) {
    const ev = byId.get(pk.eventId);
    if (!ev || ev.result === undefined) continue;
    if (new Date(pk.loggedAt).getTime() > new Date(ev.startsAt).getTime()) continue; // late pick: not scored
    out.set(pk.sourceId, [...(out.get(pk.sourceId) ?? []), { p: pk.probability, result: ev.result, segment: ev.competition }]);
  }
  return out;
}
