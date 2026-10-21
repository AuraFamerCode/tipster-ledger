# Kanish's to-do list (things only you can do)

Deadline: **10 Nov 2026, 17:00 UTC = 22:30 IST**. Aim to submit by **8 Nov** to leave buffer.

## Cost estimate

| Item | Amount | ≈ USD | ≈ INR |
|---|---|---|---|
| Gas: create MemWal account + add delegate key (observed ≈ 0.004 SUI per tx onchain) | ~0.01 SUI | ~$0.01 | ~₹1 |
| Memory writes (34+ memories) on the managed relayer | free during launch (relayer pays WAL + gas) | $0 | ₹0 |
| WAL tokens | **not needed** | $0 | ₹0 |
| Tatum API key (free plan, 100K credits) | free | $0 | ₹0 |
| **Recommended wallet top-up** (buffer for retries / extra txs) | 0.3–0.5 SUI | $0.30–0.50 | ₹30–50 |
| Exchange withdrawal fee (varies by exchange; often 0.1–1 SUI) | 0.1–1 SUI | $0.10–1.00 | ₹10–100 |
| **Realistic total out of pocket** | | **≈ $1–2** | **≈ ₹100–200** |

SUI ≈ $1.03 / ₹97 on 21 Oct 2026 (CoinGecko). If you already hold a little SUI anywhere, the real cost is basically zero. If the dashboard's "Continue with Google" flow sponsors account creation, you may not need SUI at all, but have ~0.3 SUI ready just in case.

## Steps (in order)

1. **Register for the hackathon / join Discord** (Walrus https://discord.gg/walrusprotocol, Tatum https://discord.gg/hR6NG7sNXE). Note your Discord handle for the form.
2. **Create a Sui wallet yourself.** Use the Slush browser extension (https://slush.app) or Suiet. Write the 12/24-word recovery phrase on paper. **Never share it with anyone, including Hark or any app or chat.** Copy your `0x…` address.
3. **Fund it with ~0.3–0.5 SUI.** Buy SUI on an exchange you already use (CoinDCX, Mudrex, Binance, etc.), then withdraw to your address on the **Sui network**. Send a tiny test amount first.
4. **Create the Walrus Memory account + agent (mainnet):** https://memory.walrus.xyz/dashboard → connect wallet → create account → *Delegate keys* → Generate (label `tipster-ledger`). Save the delegate **private key** (password manager), the **public key** (= `MEMWAL_AGENT_ID`) and the **account object id** (= `MEMWAL_ACCOUNT_ID`).
5. **Get a Tatum API key:** https://dashboard.tatum.io → free plan → copy the **Mainnet** key and your **account id** (for "Tatum ID" on the form).
6. **Create the public GitHub repo `tipster-ledger`** under AuraFamerCode (empty: no README, no license; we already have them). Then either:
   - tell Hark "repo created" and Hark pushes the files through the GitHub connector, or
   - push it yourself: `git init && git add . && git commit -m "Tipster Ledger" && git branch -M main && git remote add origin https://github.com/AuraFamerCode/tipster-ledger.git && git push -u origin main`
   `.env` is git-ignored. Double-check no keys are committed.
7. **Run it with your keys:** `cp .env.example .env` → fill it in → `npm install` → `npm run memwal:smoke` (1 test memory) → `npm run memwal:replay` (34 memories, ~9 min) → `npm run verify:onchain` (should print ✅ ≥10 memories).
8. **(Recommended) Deploy a public demo:** Vercel → import the repo → add the env vars + `TIPSTER_DATA_DIR=/tmp/tipster` → deploy. After a cold start, click *Restore from Walrus*.
9. **Retake the screenshot with MemWal on** (badge shows "Walrus Memory · sui-mainnet") and replace `docs/screenshot.jpg`, or ask Hark to.
10. **Record the 2–3 min demo video** following `demo-script.md`. Upload to YouTube (unlisted is fine) or Loom.
11. **Publish the blog post** (`blog.md`) on Medium, Hashnode, dev.to or LinkedIn articles. Replace `[VIDEO_LINK]` and the memory count.
12. **Submit the form** at https://recall-tatum-walrus.vercel.app using `submission.md`. Fill in: Discord handle, how you heard, Tatum ID, SUI address, Account ID, MEMWAL_AGENT_ID, video link. Write your own short answers to the two "experience" questions.
13. **Bonus:** post on X/LinkedIn (draft in `submission.md`), tagging @Tatum_io and @WalrusFoundation.
14. **Keep the wallet:** prizes are paid in USDC to a wallet you control. Keep that address's recovery phrase safe.

## Things to double-check with organisers (Discord)

- Does "Account ID (SUI)" mean the MemWalAccount object id? (Most likely, but confirm.)
- Does the memory count use the namespace you write to, or the whole account? Our replay writes to `tipster-ledger` (plus 1 memory in `tipster-ledger-smoke`).
