/** Picks the memory backend from env. Server-only. */
import path from "node:path";
import type { MemoryStore } from "./adapter";
import { LocalMemoryStore } from "./local";
import { MemWalMemoryStore, type MemWalLike } from "./memwal";

export type { MemoryStore, StoredMemory, MemoryInfo } from "./adapter";

export function memwalConfigured(env = process.env): boolean {
  return Boolean(env.MEMWAL_PRIVATE_KEY && env.MEMWAL_ACCOUNT_ID);
}

let cached: MemoryStore | null = null;

export async function getMemoryStore(env = process.env): Promise<MemoryStore> {
  if (cached) return cached;
  const backend = (env.MEMORY_BACKEND ?? "auto").toLowerCase();
  const namespace = env.MEMWAL_NAMESPACE || "tipster-ledger";
  const useMemwal = backend === "memwal" || (backend === "auto" && memwalConfigured(env));
  if (useMemwal) {
    if (!memwalConfigured(env)) throw new Error("MEMORY_BACKEND=memwal but MEMWAL_PRIVATE_KEY / MEMWAL_ACCOUNT_ID are not set");
    const { MemWal } = await import("@mysten-incubation/memwal");
    const serverUrl = env.MEMWAL_SERVER_URL || "https://relayer.memory.walrus.xyz";
    const client = MemWal.create({ key: env.MEMWAL_PRIVATE_KEY!, accountId: env.MEMWAL_ACCOUNT_ID!, serverUrl, namespace });
    cached = new MemWalMemoryStore(client as unknown as MemWalLike, { namespace, serverUrl, accountId: env.MEMWAL_ACCOUNT_ID });
  } else {
    cached = new LocalMemoryStore(path.join(env.TIPSTER_DATA_DIR ?? path.join(process.cwd(), ".data"), "memories.json"), namespace);
  }
  return cached;
}

/** For tests / after env changes. */
export function resetMemoryStore(): void {
  cached = null;
}
