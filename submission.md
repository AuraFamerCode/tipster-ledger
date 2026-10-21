# Submission form answers (https://recall-tatum-walrus.vercel.app → Submit Project)

Fill the `[…]` placeholders yourself. Everything else is ready to paste.

| Field | Answer |
|---|---|
| Email | k4887401@gmail.com |
| Discord handle | [YOUR_DISCORD_HANDLE] |
| LinkedIn | https://linkedin.com/in/kanish-patidar-b79240343 |
| How did you hear about this event? | [e.g. Walrus Sessions page / Tatum newsletter / Discord / X: pick the true one] |
| Is this your first Web3 project? | No. I've done Solana work (Superteam India fellowship contest, 2026). This is my first build on Sui/Walrus. [edit if you see it differently] |
| Tatum ID | [YOUR_TATUM_DASHBOARD_ACCOUNT_ID] |
| SUI address | [YOUR_SUI_WALLET_ADDRESS 0x…] |
| Account ID (SUI) | [YOUR_MEMWAL_ACCOUNT_ID 0x…] *(MemWalAccount object id; confirm on Discord if they mean something else)* |
| MEMWAL_AGENT_ID | [YOUR_DELEGATE_PUBLIC_KEY_HEX] *(dashboard → Delegate keys → public key)* |
| Short demo video (2–3 min) | [VIDEO_LINK] |
| GitHub repo | https://github.com/AuraFamerCode/tipster-ledger |

## Project description

> **Tipster Ledger: a cricket and markets pick journal that learns who to trust.** Log picks from tipsters, analysts and yourself before a match; picks lock at the start. After the result, every voice is scored with a proper scoring rule (Brier), plus hit rate and over/under-confidence, overall and per competition. Each settlement writes a credibility scorecard, plus plain-English lessons ("Muting X: no better than a coin flip", "Y's 88% now counts as 77%", "Z is an ODI specialist"), to **Walrus Memory on Sui mainnet**. The product reads its trust weights *from those memories*: the next match shows the crowd "before memory" next to the ledger "after memory", overconfident voices are shrunk and muted ones struck out, and disagreements between Polymarket prices, de-vigged bookmaker odds and tipsters are flagged. Wipe local state, click **Restore from Walrus**, and the whole ledger (matches, picks, weights) is rebuilt from mainnet memories. **Tatum's Sui RPC** handles all onchain reads: it verifies the memories independently of the relayer (MemWalAccount → owned Walrus Blob objects → `memwal_namespace` / `memwal_agent_id` metadata) and settles markets questions from the Pyth SUI/USD oracle object on Sui. Measured on predictions made before each result, the memory-weighted ledger beat the equal-weight crowd by about 11% (Brier) over the last 10 of 20 real matches. Next.js + TypeScript, pure scoring engine, 42 vitest tests, MemWal adapter tested against the SDK's MemWalMock.

## How was your experience building with Walrus?

> *(Draft. Edit so it's true to your experience.)* The relayer-based SDK made the first mainnet write very quick: `MemWal.create` → `rememberAndWait` → `recall`. What I liked most is that the memory is verifiable. Every write becomes a Walrus Blob owned by my address with `memwal_namespace` and `memwal_agent_id` metadata, so I could prove my memories exist using plain Sui RPC calls. `sort: "recent"` on recall was essential: without it a semantically closer *older* scorecard can outrank the newest one. `rememberBulkAndWait` plus idempotency keys made settlement retries safe. Rough edges: per-key rate limits mean a bulk replay has to be paced (I wait about 25 s between settlements), and it took some reading to understand that `MEMWAL_AGENT_ID` is the delegate public key. `MemWalMock` in the SDK was a great touch for unit tests. [Add anything that broke or surprised you during your own setup.]

## How was your experience building with the Tatum AI Builder?

> [Answer honestly. Tipster Ledger was hand-coded rather than generated with ai.tatum.io. If you try AI Builder (e.g. to prototype a companion screen), describe it here. Otherwise say something like: "I didn't use AI Builder for this entry. I used Tatum's Sui RPC gateway directly (JSON-RPC with x-api-key), which was straightforward; the llms.txt method list on the gateway was handy."]

## Social post (bonus points). Post it yourself once the video is up.

> Built **Tipster Ledger** for #TotalRecall 🏏 It's a cricket and markets pick journal that scores every tipster after the match and remembers who to trust, on @WalrusFoundation Memory (Sui mainnet), with onchain reads via @Tatum_io Sui RPC. Wipe it, restore from Walrus, and it picks up where it left off.
> Demo: [VIDEO_LINK] · Code: github.com/AuraFamerCode/tipster-ledger
