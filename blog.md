# Tipster Ledger: a cricket pick journal that remembers who was right

*Built for the Walrus x Tatum "Total Recall" hackathon (Markets & Sports Prediction). Repo: [github.com/AuraFamerCode/tipster-ledger](https://github.com/AuraFamerCode/tipster-ledger) · Demo video: [VIDEO_LINK]*

Every cricket fan I know follows a dozen "experts". There's the Telegram channel with "100% sure" calls, the YouTuber with a toss prediction, the friend who always backs India. Before a match the feed is loud. After the match nobody goes back to check who was right, so the loudest voice keeps winning.

I wanted an app that keeps the receipts and **gets smarter every match**. That's Tipster Ledger.

## What it does

1. **Log picks before the game.** For each match you record what each source said: a tipster, an analyst, yourself. Picks lock at the start time, and a late pick is never scored.
2. **Score everyone the same way after the result.** Each pick gets a **Brier score**, a proper scoring rule that rewards being right *and* being honest about how sure you are. The ledger also tracks hit rate and **over/under-confidence**, overall and per competition (T20, ODI, Women's T20…).
3. **Remember what it learned.** After each result, Tipster Ledger writes a **credibility scorecard** to **Walrus Memory on Sui mainnet**. When something new is learned, it writes a plain-English **lesson** too:
   - *"Muting Favourite Farhan: no better than a coin flip (Brier 0.394 over 4 picks)."*
   - *"Favourite Farhan is overconfident: their typical 88% now counts as 77%."*
   - *"Home-Side Harsh is an ODI specialist (weight 1.51 there vs 0.78 overall)."*
   - *"The Polymarket price has out-forecast the tipsters… it now carries weight 1.84 in the ledger."*
4. **Use the memory for the next pick.** For every upcoming match the app shows two numbers side by side: **Tipsters, before memory** (everyone counts equally) and **Ledger, after memory** (each voice re-read through its calibration and weighted by its track record). Muted voices are struck through. Disagreements between the market, bookmaker odds and the tipsters are flagged in points.

## How it uses Walrus Memory

Walrus Memory is the app's long-term brain, not a log file:

- **Write:** after each settlement, `rememberAndWait` (or `rememberBulkAndWait` when there are lessons too) stores one scorecard and any new lessons. The relayer embeds, Seal-encrypts and uploads each one to Walrus, and the blob ends up owned by my MemWal account on Sui. Each memory is a readable sentence followed by a compact JSON line, so it makes sense to a person *and* to the app.
- **Read:** the product never reads trust weights from local history. It reads them from the **newest scorecard recalled from Walrus** (`recall({ sort: "recent" })`). If you remove memory, the product goes back to treating every voice equally.
- **Restore:** each scorecard also carries the match, every pick and what the app predicted before the result. In the demo I click **Wipe local state** and the ledger is empty. Then **Restore from Walrus** rebuilds every match, pick and weight from mainnet memories. The app picks up exactly where it left off, on any machine. That's the "Total Recall" part.

During the demo replay the app wrote **34 memories** (20 scorecards + 14 lessons) to the `tipster-ledger` namespace. [Replace with your final count from `npm run verify:onchain`.]

## How it uses Tatum

All onchain reads go through **Tatum's Sui RPC gateway** (`sui-mainnet.gateway.tatum.io`), via a small typed JSON-RPC client:

- **Proving the memories are onchain, without trusting the relayer.** `sui_getObject` reads my `MemWalAccount` (owner + delegate keys, the "agent ids"). `suix_getOwnedObjects` lists the Walrus `Blob` objects my address owns. `suix_getDynamicFields` + `sui_multiGetObjects` decode each blob's metadata (`memwal_namespace`, `memwal_agent_id`). The **Verify memories onchain** button counts the Tipster Ledger memories straight from Sui.
- **Settling markets picks from an onchain oracle.** The ledger isn't only cricket. You can log a question like "SUI/USD at or above $1.00 at lock time?". It's settled by reading the **Pyth SUI/USD PriceInfoObject** on Sui mainnet through Tatum and decoding price, confidence and publish time. Pyth on Sui is a pull oracle, so the app only settles once a price is published after the lock, and it says so when the price is stale.
- **Network status** (chain id, checkpoint, gas price) in the onchain panel.

Market prices and real results come from **Polymarket's public APIs**. The demo seed is 20 real resolved cricket matches from October 2026, each with the last traded price before the start.

## How it learned over time

The demo tipsters are four synthetic personas with simple, fixed rules: always back the favourite at 88%, always back the underdog, always back the first-listed side, a hedged analyst. They **never see results**, so whatever they score comes from what happened in real matches.

Watching the replay is the fun part:

- After **4 matches**, "Favourite Farhan" gets muted. Favourites lost twice early and his 88% calls were punished hard by the Brier score.
- After a few more, the ledger notices he's **good on Women's T20** (favourites there kept winning) and gives him a specialist weight there while keeping him muted elsewhere.
- "Underdog Umesh" is wrong often enough that after 14 picks he becomes a **fade signal**: the ledger inverts his view.
- The **Polymarket price** quietly becomes the most trusted voice.

Does the memory help? The app measures it honestly, on predictions made *before* each result. Over the last 10 matches, the memory-weighted ledger scored **Brier 0.172 vs 0.194** for the equal-weight crowd, about **11% better**. Over all matches it's level, because early memory is thin. The market alone was still better (0.157), and that's the lesson the ledger learned: trust the market over loud tipsters, unless a tipster has earned it in a specific competition.

## Architecture in one breath

Next.js + TypeScript. The scoring engine, credibility model and odds-disagreement module are pure functions covered by **42 vitest tests**. Memory sits behind a small `MemoryStore` interface with a **Walrus MemWal** implementation (tested against the SDK's own `MemWalMock`) and a local fallback for development. The Tatum client and decoders are tested against fixtures captured from Sui mainnet.

## What's next

- Import tipster posts automatically (Telegram/X) and let you tag the source in one tap.
- Per-user namespaces so friends can share a league ledger.
- More onchain markets (DeepBook Predict on Sui) as a second "market" voice next to Polymarket.

*Built by Kanish Patidar ([GitHub](https://github.com/AuraFamerCode) · [LinkedIn](https://linkedin.com/in/kanish-patidar-b79240343)). Thanks @WalrusFoundation and @Tatum_io. Not betting advice.*
