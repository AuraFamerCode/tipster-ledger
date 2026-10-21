# SETUP: Walrus Memory (mainnet) + Tatum Sui RPC

Research notes and exact setup steps. Verified 21 Oct 2026 against the official docs and live Sui mainnet objects.

---

## 1. Walrus Memory (MemWal): what it is

- **SDK:** `@mysten-incubation/memwal` (npm, v0.1.9 at the time of writing). Python: `pip install memwal`. Source: https://github.com/MystenLabs/MemWal
- **Docs:** https://docs.wal.app/walrus-memory · API reference: https://github.com/MystenLabs/MemWal/blob/dev/docs/sdk/api-reference.md
- **How a write works:** SDK → **relayer** (embeds the text, Seal-encrypts it, uploads a blob to Walrus, indexes the vector) → the Walrus `Blob` object is transferred to the account **owner** on Sui with metadata `memwal_namespace`, `memwal_owner`, `memwal_package_id`, `memwal_agent_id`. Recall is a semantic search scoped to *owner + namespace*, returning decrypted text.
- **Identity model:**
  - **Owner** = your Sui wallet. It creates one `MemWalAccount` object per address and manages keys.
  - **Delegate key** = an Ed25519 keypair registered on the account. The app signs requests with it. It can store, recall and decrypt, but it **cannot** move funds or manage the account. Max 20 per account.
  - **`MEMWAL_AGENT_ID` (hackathon form)** = the delegate key's **public key** (hex), shown under *Delegate keys* in the dashboard. Onchain it appears as `memwal_agent_id` on every blob that key writes. (Source: recall-tatum-walrus.vercel.app, *How to start with Walrus*.)
  - **`MEMWAL_ACCOUNT_ID`** = the `MemWalAccount` object id (`0x…`). This is probably the form's *"Account ID (SUI)"*; confirm with the organisers on Discord if unsure.
- **Endpoints**

  | Network | Dashboard | Relayer |
  |---|---|---|
  | **Mainnet (required)** | https://memory.walrus.xyz | `https://relayer.memory.walrus.xyz` |
  | Testnet | https://staging.memory.walrus.xyz | `https://relayer-staging.memory.walrus.xyz` |

- **Mainnet contract ids:** package `0xcee7a6fd8de52ce645c38332bde23d4a30fd9426bc4681409733dd50958a24c6`, registry `0x0da982cefa26864ae834a8a0504b904233d49e20fcc17c373c8bed99c75a7edd`. Walrus Blob type: `0xfdc88f7d7cf30afab2f82e8380d11ee8f70efb90e863d1de8616fae1bb09ea77::blob::Blob`.
- **API used by this app:** `MemWal.create({ key, accountId, serverUrl, namespace })`, `rememberAndWait`, `rememberBulkAndWait` (≤ 20 items), `recall({ query, limit, sort: "recent" })`, `health`, `getPublicKeyHex`. The SDK also ships `MemWalMock`, which our tests use.
- **Managed relayer limits:** 60 points/min and 500 points/hour per account; 30 points/min per delegate key; 1 GB storage per account. Costs: `remember` = 5, `remember/bulk` = 10, `analyze` = 5, `recall` = 1. A full demo replay (20 settlements, 34 memories) costs about 150 points, so `npm run memwal:replay` waits 25 s between settlements.

### Costs (mainnet)

- **Memory writes on the managed relayer cost you nothing.** "During the launch period, builders can get started with Walrus Memory for free. Usage limits apply." (walrus.xyz/products/walrus-memory). The relayer's server wallet pays the Walrus storage (WAL) and the gas for the upload transactions. **You do not need WAL.**
- **Account setup is a normal Sui transaction paid by your wallet, unless the dashboard sponsors it.** One `AccountCreated` transaction on mainnet used `computation 100,000 + storage 6,475,200 − rebate 2,625,876 MIST ≈ 0.0039 SUI` (tx `C9tw2a7xe3HacFEoVvScLYUPFEjohB8tvEZMYgpkLEZk`, sender paid gas). Adding a delegate key is a similar small transaction. **Expect about 0.01 SUI in total, well under US$0.05.** The dashboard also offers "Continue with Google" sign-in, which may sponsor this; I could not confirm that without signing up.
- The only real cost is getting a little SUI into a wallet: exchange minimums and the **withdrawal fee** usually cost more than the gas itself (see TODO-KANISH.md).

---

## 2. Tatum Sui RPC

- **Gateway (JSON-RPC):** `https://sui-mainnet.gateway.tatum.io` (testnet: `sui-testnet.gateway.tatum.io`). GraphQL is at `/graphql`, and gRPC at `sui-mainnet-grpc.gateway.tatum.io:443`.
- **Auth:** header `x-api-key: <key>`. Without a key the gateway still answers, but it is rate-limited to a few requests per minute (we hit HTTP 429 quickly while testing).
- **Free plan:** free API key with 100K credits and no credit card (tatum.io/chain/sui). Each free account gets one mainnet and one testnet key (docs.tatum.io/docs/authentication). A third-party summary lists about 3 RPS on the free plan.
- **Supported Sui methods:** https://sui-mainnet.gateway.tatum.io/llms.txt. This app uses `sui_getChainIdentifier`, `sui_getLatestCheckpointSequenceNumber`, `suix_getReferenceGasPrice`, `sui_getObject`, `sui_multiGetObjects`, `suix_getOwnedObjects`, `suix_getDynamicFields`, and `suix_queryEvents` (available in the client).
- **Note:** Sui is moving from JSON-RPC to gRPC/GraphQL. Tatum still serves JSON-RPC for Sui, and the client is a single small class (`src/lib/tatum/suiRpc.ts`), so swapping transports later is contained.
- **"Tatum ID" / account ID on the form:** the dashboard account id at https://dashboard.tatum.io.
- **Tatum AI Builder** (https://ai.tatum.io): an optional prompt-to-app builder with its own US$500 prize for apps built *primarily* with it. Tipster Ledger is hand-written, so it is **not** a strong candidate for that prize. The form still asks about your AI Builder experience: answer honestly (e.g. "tried it for a prototype" or "didn't use it").

### What we read through Tatum (all real mainnet objects)

| Purpose | Call | Object / filter |
|---|---|---|
| Settle markets picks | `sui_getObject` | Pyth SUI/USD `PriceInfoObject` `0x801dbc2f0053d34734814b2d6df491ce7807a725fe9a01ad74a07e9c51396c37` (feed `0x23d7…5744`) |
| Show agent ids | `sui_getObject` | your `MemWalAccount` → `delegate_keys[].public_key` |
| Prove memories onchain | `suix_getOwnedObjects` (StructType = Walrus Blob) → `suix_getDynamicFields` → `sui_multiGetObjects` | blob metadata `memwal_namespace = tipster-ledger` |
| Status | `sui_getChainIdentifier`, `sui_getLatestCheckpointSequenceNumber`, `suix_getReferenceGasPrice` | n/a |

---

## 3. Exact setup steps

You do these yourself. Never paste a seed phrase anywhere, including into this app or any chat.

1. **Sui wallet:** install Slush (https://slush.app, Mysten's wallet) or Suiet as a browser extension. Create a wallet, write the recovery phrase on paper, and copy your address (`0x…`).
2. **Fund it:** get about **0.1–0.5 SUI** onto that address (see TODO-KANISH.md). No WAL is needed.
3. **Create the MemWal account and agent:** go to https://memory.walrus.xyz/dashboard → connect the wallet → *Create account* → approve the transaction → *Delegate keys* → **Generate** (label it `tipster-ledger`). Copy:
   - the **private key** → `MEMWAL_PRIVATE_KEY` (shown once; store it in a password manager)
   - the **public key** → `MEMWAL_AGENT_ID` (goes on the form)
   - the **account object id** → `MEMWAL_ACCOUNT_ID`
4. **Tatum key:** sign up at https://dashboard.tatum.io → copy the **Mainnet** API key → `TATUM_API_KEY`. Note your account id for the form.
5. **Configure:**
   ```bash
   cp .env.example .env    # fill MEMWAL_PRIVATE_KEY, MEMWAL_ACCOUNT_ID, MEMWAL_AGENT_ID, MEMWAL_OWNER_ADDRESS, TATUM_API_KEY
   npm install
   npm run memwal:smoke    # health → 1 test memory → recall (writes 1 memory to namespace tipster-ledger-smoke)
   ```
6. **Write the demo memories to mainnet** (≥ 10 required; this writes 34):
   ```bash
   npm run memwal:replay   # ~9 min, paced for the relayer's rate limits
   npm run verify:onchain  # counts tipster-ledger blobs owned by your address via Tatum
   ```
   Or run `npm run dev` and click **▶ Settle next match** repeatedly. Each click writes to mainnet.
7. **Restore test:** in the UI, click **Wipe local state** → **⟲ Restore from Walrus**.
8. **Deploy (optional, for a public demo link):** import the GitHub repo in Vercel and set the same env vars plus `TIPSTER_DATA_DIR=/tmp/tipster`. Never commit `.env`.

### Troubleshooting

- `401` / `AUTH_REJECTED` from the relayer: the delegate key isn't registered on that account, or you're mixing mainnet and testnet. Re-check `MEMWAL_ACCOUNT_ID` and use the mainnet relayer URL.
- `429`: relayer or Tatum rate limit. The app retries with backoff; for Tatum, set `TATUM_API_KEY`.
- Recall returns nothing right after a write: writes are asynchronous. The app always uses `rememberAndWait` / `rememberBulkAndWait` before recalling.
