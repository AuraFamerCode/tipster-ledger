# Demo video script (target 2:30, hard max 3:00)

**Setup before recording**
- `.env` filled (MemWal mainnet + Tatum key). Run `npm run build && npm start`, or use the deployed URL.
- Fresh state: click **Wipe local state** once so the ledger starts empty. *Don't* wipe Walrus. If you already ran the replay, Restore at the end will still work, and that's the point.
- Have one Suiscan tab open on your MemWal account object and one on your wallet address.
- Screen at 1280–1440 px wide, browser zoom 90%. Record with OBS or Loom, with mic on.

| Time | Screen | Say (roughly) |
|---|---|---|
| 0:00–0:15 | App header | "Every cricket fan follows a dozen tipsters, and nobody keeps score. This is Tipster Ledger: log picks before the match, and after the result it scores every voice and **remembers who to trust**, on Walrus Memory on Sui mainnet." |
| 0:15–0:35 | *Next up* card, badge shows `0 memories` | "These are real matches from October with real Polymarket prices. Four tipsters logged picks two hours before the start. No memory yet, so every voice counts the same and the app just says it's still learning." |
| 0:35–1:00 | Click **▶ Settle next match**, then **▶▶ Settle 5**. Point at the *Memory timeline* | "Settle a match: the real result comes in, every pick gets a Brier score, and a scorecard is written to Walrus Memory. Here's its blob id. As results come in it writes lessons: 'Muting Favourite Farhan, no better than a coin flip', 'his 88% now counts as 77%'." |
| 1:00–1:30 | *Next up* chips (`88% → 76% · w 0.68`, struck-through muted voice), the two bars, the disagreement flag | "This is memory changing the product. Same picks, but now each one is read through memory: overconfident voices shrink, muted ones barely count. Purple is the crowd *before* memory, blue is the ledger *after*. When the market and tipsters split, it flags the disagreement in points." |
| 1:30–1:50 | Settle a few more. Hero panel: *Improvement from memory* | "And it's measurable. On predictions made before each result, over the last ten matches, the memory-weighted ledger beats the equal-weight crowd by about eleven percent. It also learns the market is the best single voice." |
| 1:50–2:15 | **Wipe local state** (weights reset), then **⟲ Restore from Walrus** | "Now I wipe everything local. Gone. Restore from Walrus: it recalls the memories from mainnet and rebuilds every match, pick and weight. Total recall, on any machine." |
| 2:15–2:40 | Onchain panel → **Verify memories onchain**; flash the Suiscan tab | "All onchain reads go through Tatum's Sui RPC. It reads my MemWal account and agent key, then counts the Walrus blob objects in my namespace: [N] memories on mainnet, verified without trusting the relayer. Tatum also reads the Pyth SUI/USD oracle object, which settles markets questions like 'SUI above one dollar'." |
| 2:40–2:55 | *Add live events* → Load upcoming cricket → Add one, log "Me 60%" | "And it works on live matches: import from Polymarket, paste bookmaker odds, log your pick before the toss." |
| 2:55–3:00 | README / repo | "Tipster Ledger. Open source, link below. Thanks Walrus and Tatum." |

**Tips:** keep the cursor slow and zoom in on the timeline and chips. If a Settle click takes a few seconds (the Walrus upload certifying), say "writing to Walrus mainnet…" and keep going. Cut any wait longer than 3 s in editing.
