import { describe, expect, it, vi } from "vitest";
import { TatumSuiClient, type SuiObjectResponse } from "@/lib/tatum/suiRpc";
import { decodePriceInfoObject, PYTH_SUI_USD_FEED_ID } from "@/lib/tatum/pyth";
import { bytesToHex, decodeAccount, decodeMetadataField, listMemoryBlobs, mapLimit } from "@/lib/tatum/memwalVerify";
import pythFixture from "./fixtures/pyth-sui-usd.json";
import accountFixture from "./fixtures/memwal-account.json";
import metaFixture from "./fixtures/blob-metadata-field.json";

const jsonRes = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("TatumSuiClient", () => {
  it("sends JSON-RPC with the x-api-key header", async () => {
    const fetchImpl = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => jsonRes({ jsonrpc: "2.0", id: 1, result: "336455066" }));
    const c = new TatumSuiClient({ url: "https://sui-mainnet.gateway.tatum.io", apiKey: "k", fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(await c.getLatestCheckpoint()).toBe("336455066");
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://sui-mainnet.gateway.tatum.io");
    expect((init!.headers as Record<string, string>)["x-api-key"]).toBe("k");
    expect(JSON.parse(init!.body as string).method).toBe("sui_getLatestCheckpointSequenceNumber");
  });

  it("retries 429 then surfaces JSON-RPC errors", async () => {
    const responses = [jsonRes({}, 429), jsonRes({ jsonrpc: "2.0", id: 2, error: { code: -32602, message: "bad params" } })];
    const fetchImpl = vi.fn(async () => responses.shift()!);
    const c = new TatumSuiClient({ apiKey: "k", fetchImpl: fetchImpl as unknown as typeof fetch, sleep: async () => undefined });
    await expect(c.getObject("0x1")).rejects.toThrow(/bad params/);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("omits the key header when keyless", async () => {
    const fetchImpl = vi.fn(async (_u: string | URL | Request, _i?: RequestInit) => jsonRes({ result: "35834a8a" }));
    const c = new TatumSuiClient({ apiKey: "", fetchImpl: fetchImpl as unknown as typeof fetch });
    await c.getChainIdentifier();
    expect((fetchImpl.mock.calls[0][1]!.headers as Record<string, string>)["x-api-key"]).toBeUndefined();
    expect(c.authenticated).toBe(false);
  });
});

describe("decoders (fixtures captured from Sui mainnet via Tatum, 2026-10-21)", () => {
  it("decodes the Pyth SUI/USD PriceInfoObject", () => {
    const p = decodePriceInfoObject(pythFixture as SuiObjectResponse, Date.parse("2026-10-21T00:00:00Z"));
    expect(p.feedId).toBe(PYTH_SUI_USD_FEED_ID);
    expect(p.price).toBeGreaterThan(0.1);
    expect(p.price).toBeLessThan(20);
    expect(p.stale).toBe(true); // last pushed weeks before the fixture date
  });

  it("decodes a MemWalAccount and its delegate keys (agent ids)", () => {
    const a = decodeAccount(accountFixture as SuiObjectResponse);
    expect(a.owner).toMatch(/^0x[0-9a-f]{64}$/);
    expect(a.delegateKeys[0].agentId).toMatch(/^[0-9a-f]{64}$/);
  });

  it("decodes Walrus blob metadata written by the MemWal relayer", () => {
    const m = decodeMetadataField(metaFixture as SuiObjectResponse);
    expect(m.memwal_namespace).toBeTruthy();
    expect(m.memwal_agent_id).toMatch(/^[0-9a-f]{64}$/);
    // The agent id on the blob is the hex public key registered on the account.
    const a = decodeAccount(accountFixture as SuiObjectResponse);
    expect(a.delegateKeys.map((k) => k.agentId)).toContain(m.memwal_agent_id);
  });

  it("rejects the wrong object type", () => {
    expect(() => decodeAccount(pythFixture as SuiObjectResponse)).toThrow();
    expect(() => decodePriceInfoObject(accountFixture as SuiObjectResponse)).toThrow();
  });
});

describe("listMemoryBlobs", () => {
  it("keeps only MemWal blobs in the requested namespace", async () => {
    const meta = (ns: string) => ({
      data: { objectId: "m", version: "1", digest: "d", content: { dataType: "moveObject", type: "x", fields: { value: { fields: { metadata: { fields: { contents: [{ fields: { key: "memwal_namespace", value: ns } }, { fields: { key: "memwal_agent_id", value: "ab" } }] } } } } } } },
    });
    const blob = (id: string) => ({ data: { objectId: id, version: "1", digest: "d", content: { dataType: "moveObject", type: "b", fields: { blob_id: "123", size: "10", storage: { fields: { end_epoch: 56 } } } } } });
    const client = {
      getOwnedObjects: vi.fn(async () => ({ data: [blob("b1"), blob("b2"), blob("b3")], nextCursor: null, hasNextPage: false })),
      getDynamicFields: vi.fn(async (id: string) => ({ data: id === "b3" ? [] : [{ objectId: `f-${id}`, objectType: "pkg::metadata::Metadata", name: { type: "vector<u8>", value: [] } }], nextCursor: null, hasNextPage: false })),
      multiGetObjects: vi.fn(async (ids: string[]) => ids.map((id) => meta(id === "f-b1" ? "tipster-ledger" : "other"))),
    } as unknown as TatumSuiClient;
    const r = await listMemoryBlobs(client, "0xowner", { namespace: "tipster-ledger" });
    expect(r.scanned).toBe(3);
    expect(r.blobs.map((b) => b.objectId)).toEqual(["b1"]);
    expect(r.blobs[0].endEpoch).toBe(56);
  });

  it("helpers", async () => {
    expect(bytesToHex([0, 15, 255])).toBe("000fff");
    let inFlight = 0;
    let peak = 0;
    const out = await mapLimit([1, 2, 3, 4, 5], 2, async (x) => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      await new Promise((r) => setTimeout(r, 5));
      inFlight--;
      return x * 2;
    });
    expect(out).toEqual([2, 4, 6, 8, 10]);
    expect(peak).toBeLessThanOrEqual(2);
  });
});
