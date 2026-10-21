/** Odds conversion and the "sources disagree" detector. */

/** Decimal odds -> raw implied probability (includes bookmaker margin). */
export function impliedFromDecimal(decimal: number): number {
  if (!(decimal > 1)) throw new Error(`invalid decimal odds: ${decimal}`);
  return 1 / decimal;
}

/** Remove the overround proportionally. Returns fair probability of outcome 0 and the margin. */
export function devig(odds: [number, number]): { p0: number; margin: number } {
  const a = impliedFromDecimal(odds[0]);
  const b = impliedFromDecimal(odds[1]);
  return { p0: a / (a + b), margin: a + b - 1 };
}

export const probToDecimal = (p: number): number => (p <= 0 ? Infinity : 1 / p);

export type Level = "agree" | "disagree" | "strong";

export interface SignalInput {
  label: string;
  p0: number | undefined;
}

export interface DisagreementReport {
  signals: Array<{ label: string; p0: number }>;
  maxGap: number;
  level: Level;
  pair?: [string, string];
  /** Memory-weighted consensus minus market price (positive = value on outcome 0). */
  edge?: number;
  recommendation: { side: 0 | 1 | null; text: string };
}

export const DISAGREE_AT = 0.1;
export const STRONG_AT = 0.2;
export const EDGE_AT = 0.08;

export function levelFor(gap: number): Level {
  if (gap >= STRONG_AT) return "strong";
  if (gap >= DISAGREE_AT) return "disagree";
  return "agree";
}

/**
 * Compare every available probability source pairwise.
 * `weighted` (memory-weighted consensus) and `market` drive the recommendation; the rest only drive flags.
 * `evidence` = number of settled picks behind the weights; recommendations need some before they fire.
 */
export function analyse(
  inputs: SignalInput[],
  outcomes: [string, string],
  opts: { weighted?: number; market?: number; evidence?: number; minEvidence?: number } = {},
): DisagreementReport {
  const signals = inputs.filter((s): s is { label: string; p0: number } => typeof s.p0 === "number" && Number.isFinite(s.p0));
  let maxGap = 0;
  let pair: [string, string] | undefined;
  for (let i = 0; i < signals.length; i++)
    for (let j = i + 1; j < signals.length; j++) {
      const g = Math.abs(signals[i].p0 - signals[j].p0);
      if (g > maxGap) {
        maxGap = g;
        pair = [signals[i].label, signals[j].label];
      }
    }

  const { weighted, market, evidence = 0, minEvidence = 6 } = opts;
  let recommendation: DisagreementReport["recommendation"] = { side: null, text: "Not enough signals yet." };
  let edge: number | undefined;
  if (weighted !== undefined) {
    const side: 0 | 1 = weighted >= 0.5 ? 0 : 1;
    const conf = side === 0 ? weighted : 1 - weighted;
    if (evidence < minEvidence) {
      recommendation = { side: null, text: `Still learning: ${evidence}/${minEvidence} settled picks behind the weights.` };
    } else {
      let text = `Ledger pick: ${outcomes[side]} ${(conf * 100).toFixed(0)}%.`;
      if (market !== undefined) {
        edge = weighted - market;
        const valueSide: 0 | 1 = edge > 0 ? 0 : 1;
        text +=
          Math.abs(edge) >= EDGE_AT
            ? ` Trusted sources rate ${outcomes[valueSide]} ${(Math.abs(edge) * 100).toFixed(0)} pts higher than the market: possible value.`
            : " In line with the market.";
      }
      recommendation = { side, text };
    }
  }
  return { signals, maxGap, level: levelFor(maxGap), pair, edge, recommendation };
}
