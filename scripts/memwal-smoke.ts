/**
 * One-shot connectivity check against Walrus Memory: health -> write 1 memory -> recall it.
 * Usage: cp .env.example .env (fill MEMWAL_*), then `npm run memwal:smoke`.
 * Writes ONE real memory on mainnet (free on the managed relayer during launch; counts toward your quota).
 */
import "dotenv/config";
import { MemWal } from "@mysten-incubation/memwal";

const { MEMWAL_PRIVATE_KEY, MEMWAL_ACCOUNT_ID } = process.env;
if (!MEMWAL_PRIVATE_KEY || !MEMWAL_ACCOUNT_ID) {
  console.error("Set MEMWAL_PRIVATE_KEY and MEMWAL_ACCOUNT_ID in .env first (see SETUP.md).");
  process.exit(1);
}
const serverUrl = process.env.MEMWAL_SERVER_URL || "https://relayer.memory.walrus.xyz";
const namespace = (process.env.MEMWAL_NAMESPACE || "tipster-ledger") + "-smoke";
const memwal = MemWal.create({ key: MEMWAL_PRIVATE_KEY, accountId: MEMWAL_ACCOUNT_ID, serverUrl, namespace });

const health = await memwal.health();
console.log("relayer:", serverUrl, health);
console.log("delegate public key (MEMWAL_AGENT_ID):", await memwal.getPublicKeyHex());
const stored = await memwal.rememberAndWait(`Tipster Ledger smoke test at ${new Date().toISOString()}: setup works.`, { timeoutMs: 120_000 });
console.log("stored blob:", stored.blob_id, "owner:", stored.owner, "namespace:", stored.namespace);
const recalled = await memwal.recall({ query: "Tipster Ledger smoke test", limit: 3, sort: "recent" });
console.log("recalled:", recalled.results.map((r) => r.text));
