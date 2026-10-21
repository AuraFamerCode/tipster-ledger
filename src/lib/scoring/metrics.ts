/** Proper scoring rules for binary forecasts. `p` is the probability given to outcome 0; `result` is 0 or 1 (index of the winner). */

const EPS = 1e-6;

/** 1 if outcome 0 happened, else 0. */
export const y = (result: 0 | 1): number => (result === 0 ? 1 : 0);

export function brier(p: number, result: 0 | 1): number {
  return (p - y(result)) ** 2;
}

export function logLoss(p: number, result: 0 | 1): number {
  const q = Math.min(1 - EPS, Math.max(EPS, p));
  return -(y(result) * Math.log(q) + (1 - y(result)) * Math.log(1 - q));
}

/** 1 if the favoured side won, 0 if it lost, 0.5 for a coin-flip pick. */
export function hit(p: number, result: 0 | 1): number {
  if (p === 0.5) return 0.5;
  return (p > 0.5) === (result === 0) ? 1 : 0;
}

/** Confidence in the favoured side (0.5..1). */
export const confidence = (p: number): number => Math.max(p, 1 - p);

export const mean = (xs: number[]): number => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

/** Brier skill vs an always-50% forecaster (Brier 0.25). 1 = perfect, 0 = no better than a coin, <0 = worse. */
export const brierSkill = (meanBrier: number): number => 1 - meanBrier / 0.25;

/** Reliability table: bucket forecasts by confidence and compare to realised hit rate. */
export function calibrationBuckets(
  rows: Array<{ p: number; result: 0 | 1 }>,
  edges = [0.5, 0.6, 0.7, 0.8, 0.9, 1.0001],
): Array<{ from: number; to: number; n: number; meanConfidence: number; hitRate: number }> {
  const out = [];
  for (let i = 0; i < edges.length - 1; i++) {
    const inB = rows.filter((r) => confidence(r.p) >= edges[i] && confidence(r.p) < edges[i + 1]);
    out.push({
      from: edges[i],
      to: Math.min(1, edges[i + 1]),
      n: inB.length,
      meanConfidence: mean(inB.map((r) => confidence(r.p))),
      hitRate: mean(inB.map((r) => hit(r.p, r.result))),
    });
  }
  return out;
}
