import { describe, expect, it, vi } from "vitest";
import { MemWalMock } from "@mysten-incubation/memwal";
import { decodeMemory, encodeMemory, TAG } from "@/lib/memory/codec";
import { LocalMemoryStore } from "@/lib/memory/local";
import { MemWalMemoryStore, type MemWalLike } from "@/lib/memory/memwal";
import type { CredibilityMemory } from "@/lib/types";

const mem = (eventId: string, writtenAt: string, kind: "scorecard" | "insight" = "scorecard"): CredibilityMemory => ({
  kind,
  version: 1,
  writtenAt,
  eventId,
  eventTitle: `Match ${eventId}`,
  result: "India",
  lesson: kind === "insight" ? "Now trusting Analyst Kavya." : undefined,
  sources: [{ sourceId: "kavya", name: "Analyst Kavya", n: 5, brier: 0.18, hitRate: 0.8, overconfidence: 0.02, weight: 1.9, calibrationFactor: 0.95, status: "trusted" }],
});

describe("codec", () => {
  it("round-trips and keeps a human-readable first line", () => {
    const m = mem("e1", "2026-10-21T00:00:00.000Z");
    const text = encodeMemory(m);
    expect(text.split("\n")[0]).toMatch(/credibility scorecard.*Analyst Kavya weight 1.90/);
    expect(text).toContain(TAG);
    expect(decodeMemory(text)).toEqual(m);
  });
  it("ignores unrelated or corrupt memories", () => {
    expect(decodeMemory("User prefers dark mode")).toBeNull();
    expect(decodeMemory(`${TAG}{not json`)).toBeNull();
  });
});

describe("LocalMemoryStore", () => {
  it("returns newest first", async () => {
    const s = new LocalMemoryStore(null);
    await s.remember([mem("a", "2026-10-21T00:00:00Z"), mem("b", "2026-10-21T01:00:00Z")]);
    const r = await s.recallLatest();
    expect(r.map((x) => x.memory.eventId)).toEqual(["b", "a"]);
  });
});

describe("MemWalMemoryStore (against the SDK's own MemWalMock)", () => {
  it("writes single and bulk memories and recalls them decoded", async () => {
    const client = MemWalMock.create({ namespace: "tipster-ledger-test" });
    const store = new MemWalMemoryStore(client as unknown as MemWalLike, { namespace: "tipster-ledger-test", serverUrl: "https://relayer.memory.walrus.xyz" });
    expect(store.info().network).toBe("sui-mainnet");
    const one = await store.remember([mem("a", "2026-10-21T00:00:00Z")]);
    expect(one[0].blobId).toBeTruthy();
    const two = await store.remember([mem("b", "2026-10-21T01:00:00Z"), mem("b", "2026-10-21T01:00:01Z", "insight")]);
    expect(two).toHaveLength(2);
    const recalled = await store.recallLatest(10);
    expect(recalled.map((r) => r.memory.eventId)).toEqual(["b", "b", "a"]);
    expect(recalled[0].memory.kind).toBe("insight");
    expect((await store.health()).ok).toBe(true);
  });

  it("retries rate-limited writes, then gives up on hard errors", async () => {
    let calls = 0;
    const flaky: MemWalLike = {
      rememberAndWait: vi.fn(async () => {
        calls++;
        if (calls < 3) throw Object.assign(new Error("Too Many Requests"), { status: 429 });
        return { blob_id: "blob-1" };
      }),
      rememberBulkAndWait: vi.fn(),
      recall: vi.fn(),
      health: vi.fn(),
    } as unknown as MemWalLike;
    const sleep = vi.fn(async () => undefined);
    const store = new MemWalMemoryStore(flaky, { namespace: "n", serverUrl: "https://relayer.memory.walrus.xyz", sleep });
    const r = await store.remember([mem("a", "2026-10-21T00:00:00Z")]);
    expect(r[0].blobId).toBe("blob-1");
    expect(sleep).toHaveBeenCalledTimes(2);

    const broken = { ...flaky, rememberAndWait: vi.fn(async () => Promise.reject(Object.assign(new Error("AUTH_REJECTED"), { status: 401 }))) };
    const s2 = new MemWalMemoryStore(broken as MemWalLike, { namespace: "n", serverUrl: "x", sleep });
    await expect(s2.remember([mem("a", "2026-10-21T00:00:00Z")])).rejects.toThrow(/AUTH_REJECTED/);
  });
});
