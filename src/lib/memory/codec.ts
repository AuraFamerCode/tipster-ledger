/**
 * Memory text format. Each Walrus memory is a human-readable sentence (so semantic recall and the
 * Walrus Memory dashboard make sense to a person) followed by one machine line:
 *
 *   #TL1 {"kind":"scorecard",...}
 *
 * The relayer embeds and Seal-encrypts the whole text; recall returns it decrypted, and we parse the
 * #TL1 line back into a CredibilityMemory. Anything without a valid #TL1 line is ignored.
 */
import type { CredibilityMemory } from "../types";

export const TAG = "#TL1 ";
export const RECALL_QUERY = "Tipster Ledger credibility scorecard: who to trust, tipster weights and lessons";

export function encodeMemory(m: CredibilityMemory): string {
  const board = [...m.sources]
    .sort((a, b) => b.weight - a.weight)
    .map((s) => `${s.name} weight ${s.weight.toFixed(2)} (Brier ${s.brier.toFixed(3)}, hit ${(s.hitRate * 100).toFixed(0)}%, n=${s.n})`)
    .join("; ");
  const head =
    m.kind === "insight"
      ? `Tipster Ledger lesson after "${m.eventTitle}": ${m.lesson ?? ""}`
      : `Tipster Ledger credibility scorecard after "${m.eventTitle}" (winner: ${m.result}). Who to trust now: ${board}.`;
  return `${head}\n${TAG}${JSON.stringify(m)}`;
}

export function decodeMemory(text: string): CredibilityMemory | null {
  const line = text.split("\n").find((l) => l.startsWith(TAG));
  if (!line) return null;
  try {
    const m = JSON.parse(line.slice(TAG.length)) as CredibilityMemory;
    if (m.version !== 1 || !Array.isArray(m.sources) || !m.writtenAt) return null;
    return m;
  } catch {
    return null;
  }
}
