import { fail, ok } from "@/lib/http";
import { listMemoryBlobs, readAccount } from "@/lib/tatum/memwalVerify";
import { readPythPrice } from "@/lib/tatum/pyth";
import { TatumSuiClient } from "@/lib/tatum/suiRpc";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const settle = async <T,>(p: Promise<T>) => p.then((value) => ({ ok: true as const, value })).catch((e: Error) => ({ ok: false as const, error: e.message }));

/**
 * Everything the app reads from Sui mainnet through Tatum's RPC gateway:
 * network status, the Pyth SUI/USD oracle object, the MemWal account (delegate keys = agent ids),
 * and the Walrus Blob objects that prove our memories are onchain.
 * ?verify=1 also scans the owner's memory blobs (more RPC calls).
 */
// Keyless Tatum access is only a few requests per minute, so cache the read for a minute and call sequentially.
let cache: { at: number; verify: boolean; body: unknown } | null = null;
const TTL_MS = 60_000;

export async function GET(req: Request) {
  try {
    const verify = new URL(req.url).searchParams.get("verify") === "1";
    if (cache && Date.now() - cache.at < TTL_MS && (cache.verify || !verify)) return ok(cache.body);
    const client = new TatumSuiClient({ retries: 2 });
    const accountId = process.env.MEMWAL_ACCOUNT_ID;
    const namespace = process.env.MEMWAL_NAMESPACE || "tipster-ledger";
    const chain = await settle(client.getChainIdentifier());
    const checkpoint = await settle(client.getLatestCheckpoint());
    const gasPrice = await settle(client.getReferenceGasPrice());
    const pyth = await settle(readPythPrice(client, process.env.PYTH_SUI_USD_OBJECT_ID ?? "0x801dbc2f0053d34734814b2d6df491ce7807a725fe9a01ad74a07e9c51396c37"));
    const account = accountId ? await settle(readAccount(client, accountId)) : null;
    const owner = process.env.MEMWAL_OWNER_ADDRESS || (account?.ok ? account.value.owner : undefined);
    const blobs = verify && owner ? await settle(listMemoryBlobs(client, owner, { namespace, maxBlobs: 150 })) : null;
    const body = { rpc: client.url, authenticated: client.authenticated, chain, checkpoint, gasPrice, pyth, account, owner, namespace, blobs, readAt: new Date().toISOString() };
    if (pyth.ok) cache = { at: Date.now(), verify, body }; // don't cache a rate-limited read
    return ok(body);
  } catch (e) {
    return fail(e, 502);
  }
}
