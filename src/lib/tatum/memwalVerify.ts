/**
 * Independent, relayer-free proof that our memories are on Sui mainnet, read through Tatum:
 *  1. sui_getObject(MemWalAccount)          -> owner + registered delegate keys (agent ids)
 *  2. suix_getOwnedObjects(owner, Blob type) -> Walrus Blob objects the relayer transferred to the owner
 *  3. suix_getDynamicFields + sui_multiGetObjects -> each blob's metadata: memwal_namespace / memwal_agent_id
 * Verified shapes against live mainnet objects on 2026-10-21.
 */
import type { SuiObjectResponse, TatumSuiClient } from "./suiRpc";

export const MEMWAL_PACKAGE_MAINNET = "0xcee7a6fd8de52ce645c38332bde23d4a30fd9426bc4681409733dd50958a24c6";
export const WALRUS_BLOB_TYPE_MAINNET = "0xfdc88f7d7cf30afab2f82e8380d11ee8f70efb90e863d1de8616fae1bb09ea77::blob::Blob";

type F = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

export interface AccountInfo {
  accountId: string;
  owner: string;
  active: boolean;
  delegateKeys: Array<{ label: string; agentId: string; suiAddress: string }>;
}

export interface MemoryBlob {
  objectId: string;
  blobId: string;
  size: number;
  endEpoch?: number;
  namespace?: string;
  agentId?: string;
}

/** Run async fn over items with at most `limit` in flight (Tatum free tier is ~3 req/s). */
export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

export const bytesToHex = (bytes: number[]): string => bytes.map((b) => b.toString(16).padStart(2, "0")).join("");

export function decodeAccount(obj: SuiObjectResponse): AccountInfo {
  const f = obj.data?.content?.fields as F | undefined;
  if (!f || !obj.data?.type?.endsWith("::account::MemWalAccount")) throw new Error("object is not a MemWalAccount");
  return {
    accountId: obj.data.objectId,
    owner: f.owner,
    active: Boolean(f.active),
    delegateKeys: (f.delegate_keys ?? []).map((k: F) => ({
      label: k.fields.label,
      agentId: bytesToHex(k.fields.public_key),
      suiAddress: k.fields.sui_address,
    })),
  };
}

/** Decode a `dynamic_field::Field<vector<u8>, metadata::Metadata>` object into a plain map. */
export function decodeMetadataField(obj: SuiObjectResponse): Record<string, string> {
  const f = obj.data?.content?.fields as F | undefined;
  const entries: F[] = f?.value?.fields?.metadata?.fields?.contents ?? [];
  return Object.fromEntries(entries.map((e) => [e.fields.key, e.fields.value]));
}

export async function readAccount(client: TatumSuiClient, accountId: string): Promise<AccountInfo> {
  return decodeAccount(await client.getObject(accountId));
}

/**
 * Lists MemWal memory blobs owned by `owner`, optionally filtered to a namespace.
 * `maxBlobs` bounds RPC usage (each page of 50 blobs costs 1 + 1 + 1 calls per metadata batch).
 */
export async function listMemoryBlobs(
  client: TatumSuiClient,
  owner: string,
  opts: { namespace?: string; maxBlobs?: number; blobType?: string; concurrency?: number } = {},
): Promise<{ blobs: MemoryBlob[]; scanned: number; truncated: boolean }> {
  const max = opts.maxBlobs ?? 200;
  const blobs: MemoryBlob[] = [];
  let cursor: string | null = null;
  let scanned = 0;
  let truncated = false;
  do {
    const page = await client.getOwnedObjects(owner, opts.blobType ?? WALRUS_BLOB_TYPE_MAINNET, cursor, 50);
    const found = page.data.filter((o) => o.data).map((o) => o.data!);
    scanned += found.length;
    // Fetch each blob's "metadata" dynamic field in parallel, then batch-read the field objects.
    const fieldIds = await mapLimit(found, opts.concurrency ?? 3, async (b) => {
        const df = await client.getDynamicFields(b.objectId, null, 5);
        return df.data.find((d) => d.objectType.endsWith("::metadata::Metadata"))?.objectId;
    });
    const ids = fieldIds.filter((x): x is string => Boolean(x));
    const metaObjs = ids.length ? await client.multiGetObjects(ids) : [];
    const metaById = new Map(ids.map((id, i) => [id, decodeMetadataField(metaObjs[i])]));
    found.forEach((b, i) => {
      const f = b.content?.fields as F;
      const meta = fieldIds[i] ? metaById.get(fieldIds[i]!) : undefined;
      if (!meta?.memwal_namespace) return; // not a MemWal blob
      if (opts.namespace && meta.memwal_namespace !== opts.namespace) return;
      blobs.push({
        objectId: b.objectId,
        blobId: String(f.blob_id),
        size: Number(f.size),
        endEpoch: Number(f.storage?.fields?.end_epoch) || undefined,
        namespace: meta.memwal_namespace,
        agentId: meta.memwal_agent_id,
      });
    });
    cursor = page.hasNextPage ? page.nextCursor : null;
    if (scanned >= max && cursor) {
      truncated = true;
      break;
    }
  } while (cursor);
  return { blobs, scanned, truncated };
}
