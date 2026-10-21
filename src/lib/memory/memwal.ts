/**
 * Walrus Memory (MemWal) implementation.
 * The managed mainnet relayer embeds each memory, Seal-encrypts it, uploads it to Walrus and records it
 * against our MemWalAccount on Sui. We wait for each job so the UI only shows memories that really landed.
 */
import type { CredibilityMemory } from "../types";
import type { MemoryInfo, MemoryStore, StoredMemory } from "./adapter";
import { decodeMemory, encodeMemory, RECALL_QUERY } from "./codec";

/** The subset of the SDK we use. Both `MemWal` and the SDK's own `MemWalMock` satisfy it, which keeps this testable. */
export interface MemWalLike {
  rememberAndWait(text: string, opts?: { idempotencyKey?: string; timeoutMs?: number }): Promise<{ blob_id: string }>;
  rememberBulkAndWait(items: { text: string }[], opts?: { idempotencyKey?: string }): Promise<{
    results: { blob_id: string; status: string; error?: string }[];
  }>;
  recall(params: { query: string; limit?: number; sort?: "relevance" | "recent" }): Promise<{ results: { text: string; blob_id: string }[] }>;
  health(): Promise<{ status: string; version: string }>;
}

export interface MemWalStoreOptions {
  namespace: string;
  serverUrl: string;
  accountId?: string;
  /** Retries for rate-limit (429) / transient errors. */
  retries?: number;
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function isRetryable(err: unknown): boolean {
  const e = err as { status?: number; message?: string };
  return e?.status === 429 || (e?.status ?? 0) >= 500 || /429|rate|timeout|ECONNRESET|fetch failed/i.test(e?.message ?? "");
}

export class MemWalMemoryStore implements MemoryStore {
  constructor(private readonly client: MemWalLike, private readonly opts: MemWalStoreOptions) {}

  info(): MemoryInfo {
    return {
      backend: "memwal",
      namespace: this.opts.namespace,
      network: this.opts.serverUrl.includes("staging") ? "sui-testnet" : "sui-mainnet",
      serverUrl: this.opts.serverUrl,
      accountId: this.opts.accountId,
    };
  }

  private async withRetry<T>(fn: () => Promise<T>): Promise<T> {
    const retries = this.opts.retries ?? 4;
    const sleep = this.opts.sleep ?? defaultSleep;
    for (let attempt = 0; ; attempt++) {
      try {
        return await fn();
      } catch (err) {
        if (attempt >= retries || !isRetryable(err)) throw err;
        await sleep(Math.min(60_000, 2_000 * 2 ** attempt)); // relayer limits are per-minute
      }
    }
  }

  async remember(memories: CredibilityMemory[]): Promise<StoredMemory[]> {
    if (!memories.length) return [];
    const texts = memories.map(encodeMemory);
    // Idempotency: retries of the same settlement never double-write.
    const key = `tl-${memories[0].eventId}-${memories[0].writtenAt}`.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 120);
    let blobIds: string[];
    if (texts.length === 1) {
      const r = await this.withRetry(() => this.client.rememberAndWait(texts[0], { idempotencyKey: key, timeoutMs: 120_000 }));
      blobIds = [r.blob_id];
    } else {
      const r = await this.withRetry(() => this.client.rememberBulkAndWait(texts.map((text) => ({ text })), { idempotencyKey: key }));
      const failed = r.results.filter((x) => x.status !== "done");
      if (failed.length) throw new Error(`MemWal bulk write: ${failed.length} failed (${failed[0].error ?? failed[0].status})`);
      blobIds = r.results.map((x) => x.blob_id);
    }
    return memories.map((memory, i) => ({ memory, text: texts[i], blobId: blobIds[i], backend: "memwal" as const }));
  }

  async recallLatest(limit = 50): Promise<StoredMemory[]> {
    // sort: "recent" makes the relayer widen candidates and order by write time (see MemWal API reference).
    const { results } = await this.withRetry(() => this.client.recall({ query: RECALL_QUERY, limit: Math.min(100, limit), sort: "recent" }));
    return results
      .map((r) => ({ text: r.text, blobId: r.blob_id, memory: decodeMemory(r.text) }))
      .filter((x): x is { text: string; blobId: string; memory: CredibilityMemory } => x.memory !== null)
      .sort((a, b) => b.memory.writtenAt.localeCompare(a.memory.writtenAt))
      .map((x) => ({ ...x, backend: "memwal" as const }));
  }

  async health() {
    try {
      const h = await this.client.health();
      return { ok: h.status === "ok" || h.status === "healthy" || !!h.version, detail: `relayer ${this.opts.serverUrl} v${h.version}` };
    } catch (e) {
      return { ok: false, detail: (e as Error).message };
    }
  }
}
