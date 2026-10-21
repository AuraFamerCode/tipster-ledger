/** The one interface the engine depends on. Implementations: Walrus Memory (MemWal) and a local JSON file. */
import type { CredibilityMemory } from "../types";

export interface StoredMemory {
  memory: CredibilityMemory;
  text: string;
  /** Walrus blob id when stored on Walrus. */
  blobId?: string;
  backend: "memwal" | "local";
}

export interface MemoryInfo {
  backend: "memwal" | "local";
  namespace: string;
  network: "sui-mainnet" | "sui-testnet" | "local";
  serverUrl?: string;
  accountId?: string;
}

export interface MemoryStore {
  info(): MemoryInfo;
  /** Persist memories (in order). Resolves once they are durably stored (Walrus blob certified for MemWal). */
  remember(memories: CredibilityMemory[]): Promise<StoredMemory[]>;
  /** Newest-first credibility memories, decoded. */
  recallLatest(limit?: number): Promise<StoredMemory[]>;
  /** Cheap liveness check. */
  health(): Promise<{ ok: boolean; detail: string }>;
}
