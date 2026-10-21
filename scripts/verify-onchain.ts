/**
 * Relayer-independent proof via Tatum's Sui RPC: reads the MemWalAccount and counts the Walrus Blob
 * objects (memories) the owner holds in our namespace. Usage: npm run verify:onchain
 */
import "dotenv/config";
import { listMemoryBlobs, readAccount } from "../src/lib/tatum/memwalVerify";
import { readPythPrice } from "../src/lib/tatum/pyth";
import { TatumSuiClient } from "../src/lib/tatum/suiRpc";

const client = new TatumSuiClient();
console.log(`Tatum RPC: ${client.url} (${client.authenticated ? "x-api-key set" : "keyless, rate-limited"})`);
console.log("chain:", await client.getChainIdentifier(), "checkpoint:", await client.getLatestCheckpoint());
const pyth = await readPythPrice(client, process.env.PYTH_SUI_USD_OBJECT_ID ?? "0x801dbc2f0053d34734814b2d6df491ce7807a725fe9a01ad74a07e9c51396c37");
console.log(`Pyth SUI/USD onchain: $${pyth.price.toFixed(4)} published ${pyth.publishTime}${pyth.stale ? " (stale)" : ""}`);

const accountId = process.env.MEMWAL_ACCOUNT_ID;
if (!accountId) {
  console.log("MEMWAL_ACCOUNT_ID not set: skipping memory verification.");
  process.exit(0);
}
const account = await readAccount(client, accountId);
console.log(`MemWal account ${account.accountId} owner ${account.owner}`);
for (const k of account.delegateKeys) console.log(`  agent key "${k.label}": ${k.agentId}`);
const namespace = process.env.MEMWAL_NAMESPACE || "tipster-ledger";
const { blobs, scanned, truncated } = await listMemoryBlobs(client, process.env.MEMWAL_OWNER_ADDRESS || account.owner, { namespace, maxBlobs: 500 });
console.log(`\n${blobs.length} Tipster Ledger memories on Walrus (namespace "${namespace}"), ${scanned} blob objects scanned${truncated ? " (truncated)" : ""}.`);
for (const b of blobs.slice(0, 15)) console.log(`  ${b.objectId}  blob ${b.blobId}  agent ${b.agentId?.slice(0, 12)}…`);
console.log(blobs.length >= 10 ? "✅ hackathon requirement met: ≥10 memories on mainnet" : "⏳ fewer than 10 memories so far");
