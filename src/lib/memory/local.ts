/** Local fallback store for development and tests: same contract as MemWal, persisted to a JSON file (or memory only). */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { CredibilityMemory } from "../types";
import type { MemoryInfo, MemoryStore, StoredMemory } from "./adapter";
import { decodeMemory, encodeMemory } from "./codec";

export class LocalMemoryStore implements MemoryStore {
  private items: string[] = [];

  /** @param file JSON file path, or null for a purely in-memory store. */
  constructor(private readonly file: string | null, private readonly namespace = "tipster-ledger") {
    if (file && existsSync(file)) this.items = JSON.parse(readFileSync(file, "utf8")) as string[];
  }

  info(): MemoryInfo {
    return { backend: "local", namespace: this.namespace, network: "local" };
  }

  async remember(memories: CredibilityMemory[]): Promise<StoredMemory[]> {
    const out = memories.map((memory) => ({ memory, text: encodeMemory(memory), backend: "local" as const }));
    this.items.push(...out.map((o) => o.text));
    this.flush();
    return out;
  }

  async recallLatest(limit = 50): Promise<StoredMemory[]> {
    return this.items
      .map((text) => ({ text, memory: decodeMemory(text) }))
      .filter((x): x is { text: string; memory: CredibilityMemory } => x.memory !== null)
      .sort((a, b) => b.memory.writtenAt.localeCompare(a.memory.writtenAt))
      .slice(0, limit)
      .map((x) => ({ ...x, backend: "local" as const }));
  }

  async health() {
    return { ok: true, detail: this.file ? `local file ${this.file}` : "in-memory" };
  }

  clear(): void {
    this.items = [];
    this.flush();
  }

  private flush(): void {
    if (!this.file) return;
    mkdirSync(path.dirname(this.file), { recursive: true });
    writeFileSync(this.file, JSON.stringify(this.items, null, 2));
  }
}
