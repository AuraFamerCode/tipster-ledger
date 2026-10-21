/** Core domain types for Tipster Ledger. Kept framework-free so they can be used by the engine, API routes, scripts and tests. */

export type Sport = "cricket" | "markets" | string;

/** A binary event: exactly one of two outcomes happens. */
export interface LedgerEvent {
  id: string;
  sport: Sport;
  /** Competition / market family, e.g. "T20I", "ODI", "IPL", "crypto-price". Used for segment-level credibility. */
  competition: string;
  title: string;
  /** Outcome labels. Probabilities in picks always refer to outcomes[0] ("home"/"yes"). */
  outcomes: [string, string];
  startsAt: string; // ISO, UTC
  /** Pre-event prediction-market price for outcomes[0] (0..1), e.g. Polymarket last trade before start. */
  marketPrice?: number;
  marketSource?: { name: string; url: string };
  /** Optional bookmaker decimal odds for [outcomes[0], outcomes[1]]. */
  bookmakerOdds?: [number, number];
  /** 0 = outcomes[0] won, 1 = outcomes[1] won. Undefined until settled. */
  result?: 0 | 1;
  resultSource?: string;
  /** Onchain-resolved price events: outcome 0 = "price >= threshold at startsAt". */
  resolver?: { kind: "pyth"; objectId: string; threshold: number; pair: string };
}

/** A pick logged BEFORE the event starts. */
export interface Pick {
  id: string;
  eventId: string;
  sourceId: string;
  /** Probability the source assigns to outcomes[0]. */
  probability: number;
  loggedAt: string; // ISO
  note?: string;
}

export interface Source {
  id: string;
  name: string;
  kind: "tipster" | "analyst" | "me" | "market";
  /** Plain-English description of how the source picks (shown in UI; seed personas are rule-based). */
  style?: string;
}

/** Aggregated track record for a source, overall or within one segment (sport/competition). */
export interface SourceStats {
  sourceId: string;
  segment: string; // "all" | "cricket" | "cricket:T20I" ...
  n: number;
  brier: number; // mean Brier score, lower is better (0..1)
  hitRate: number; // fraction of picks where the favoured side won
  logLoss: number;
  /** Mean predicted prob of the favoured side minus its realised win rate: >0 = overconfident. */
  overconfidence: number;
}

/** What gets written to Walrus Memory after each settled event. */
export interface CredibilityMemory {
  kind: "scorecard" | "insight";
  version: 1;
  writtenAt: string;
  eventId: string;
  eventTitle: string;
  result: string;
  /** Per-source snapshot after this event. */
  sources: Array<{
    sourceId: string;
    name: string;
    n: number;
    brier: number;
    hitRate: number;
    overconfidence: number;
    weight: number;
    calibrationFactor: number;
    status: "learning" | "trusted" | "neutral" | "muted" | "fade";
    segments?: Record<string, { n: number; brier: number; weight: number }>;
  }>;
  /** Human-readable learning, e.g. "Now trusting Analyst Kavya". */
  lesson?: string;
  /**
   * The settled event itself, every pick on it, and what the app showed before the result.
   * Lets the whole ledger be rebuilt from Walrus Memory alone (see service.restoreFromMemory).
   */
  record?: {
    event: {
      id: string;
      sport: Sport;
      competition: string;
      title: string;
      outcomes: [string, string];
      startsAt: string;
      marketPrice?: number;
    };
    result: 0 | 1;
    picks: Array<[sourceId: string, probability: number, loggedAt: string]>;
    shown?: { naive: number; weighted: number; usedMemory: boolean };
  };
}

export interface ConsensusView {
  eventId: string;
  /** Equal-weight average of sources' probabilities: "what the app would say with no memory". */
  naive: number;
  /** Credibility-weighted average using weights learned from memory. */
  weighted: number;
  weights: Array<{ sourceId: string; weight: number; probability: number; adjusted: number }>;
}
