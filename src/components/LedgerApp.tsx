"use client";

import { useCallback, useEffect, useState } from "react";
import type { Dashboard } from "@/lib/engine/service";
import { EventCard } from "./EventCard";
import { Leaderboard } from "./Leaderboard";
import { MemoryTimeline } from "./MemoryTimeline";
import { OnchainPanel } from "./OnchainPanel";
import { LiveMarkets } from "./LiveMarkets";
import { SettledList } from "./SettledList";
import { api } from "./api";

const fmt = (x: number) => (Number.isFinite(x) ? x.toFixed(3) : "—");

export function LedgerApp() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ text: string; err?: boolean }>({ text: "" });

  const refresh = useCallback(async () => setData(await api<Dashboard>("/api/state")), []);
  useEffect(() => {
    refresh().catch((e) => setStatus({ text: e.message, err: true }));
  }, [refresh]);

  const run = async (label: string, fn: () => Promise<string>) => {
    setBusy(true);
    setStatus({ text: `${label}…` });
    try {
      setStatus({ text: await fn() });
      await refresh();
    } catch (e) {
      setStatus({ text: (e as Error).message, err: true });
    } finally {
      setBusy(false);
    }
  };

  const step = (n: number) =>
    run(n === 1 ? "Settling next match and writing memory" : `Settling ${n} matches`, async () => {
      const lines: string[] = [];
      for (let i = 0; i < n; i++) {
        const r = await api<{ settled: string; wrote: { kind: string; lesson?: string }[] }>("/api/replay/step", { method: "POST" });
        const lessons = r.wrote.filter((w) => w.lesson).map((w) => w.lesson);
        lines.push(`Wrote ${r.wrote.length} memor${r.wrote.length === 1 ? "y" : "ies"}${lessons.length ? `. Learned: ${lessons.join(" ")}` : "."}`);
        await refresh();
      }
      return lines.slice(-2).join(" ");
    });

  if (!data) return <div className="wrap">Loading ledger… {status.err && <span className="status err">{status.text}</span>}</div>;

  const m = data.memory;
  const lift = data.lift.last10.n >= 3 ? data.lift.last10 : data.lift.all;
  return (
    <div className="wrap">
      <header className="top">
        <div className="brand">
          <h1>🏏 Tipster Ledger</h1>
          <p>Log picks before the game. After the result, the ledger scores every voice and remembers who to trust.</p>
        </div>
        <div className="badges">
          <span className={`badge ${m.backend === "memwal" ? "on" : "off"}`}>
            Memory: <b>{m.backend === "memwal" ? `Walrus Memory · ${m.network}` : "local fallback (no MemWal keys)"}</b>
          </span>
          <span className="badge">
            namespace <b>{m.namespace}</b>
          </span>
          <span className="badge">
            <b>{m.count}</b> memories ({m.scorecards} scorecards, {m.insights} lessons)
          </span>
        </div>
      </header>

      <section className="panel hero" style={{ marginBottom: 16 }}>
        <div>
          <h2>Does memory help? (measured on predictions made before each result)</h2>
          <div className="lift">
            <div className="metric">
              <div className="k">No memory (equal weights)</div>
              <div className="v">{fmt(lift.naive)}</div>
            </div>
            <div className="metric">
              <div className="k">With memory (learned weights)</div>
              <div className={`v ${lift.improvement > 0 ? "good" : ""}`}>{fmt(lift.weighted)}</div>
            </div>
            <div className="metric">
              <div className="k">Market price alone</div>
              <div className="v">{fmt(lift.market)}</div>
            </div>
            <div className="metric">
              <div className="k">Improvement from memory</div>
              <div className={`v ${lift.improvement > 0 ? "good" : ""}`}>{Number.isFinite(lift.improvement) ? `${(lift.improvement * 100).toFixed(0)}%` : "—"}</div>
            </div>
          </div>
          <p className="small" style={{ margin: "8px 0 0" }}>
            Brier score, lower is better. {data.lift.last10.n >= 3 ? `Last ${lift.n} settled matches` : `${lift.n} settled matches`} where memory existed. Demo: {data.replay.settled}/
            {data.replay.total} real matches settled (Polymarket data fetched {data.replay.seedFetchedAt.slice(0, 10)}).
          </p>
        </div>
        <div>
          <div className="actions">
            <button className="primary" disabled={busy || data.replay.settled >= data.replay.total} onClick={() => step(1)}>
              ▶ Settle next match
            </button>
            <button disabled={busy || data.replay.settled >= data.replay.total} onClick={() => step(5)}>
              ▶▶ Settle 5
            </button>
          </div>
          <div className="actions" style={{ marginTop: 8 }}>
            <button
              className="ghost"
              disabled={busy}
              onClick={() => run("Wiping local state", async () => (await api("/api/reset", { method: "POST" }), "Local state wiped. Walrus Memory untouched: try Restore."))}
            >
              Wipe local state
            </button>
            <button
              disabled={busy}
              onClick={() =>
                run("Recalling memories", async () => {
                  const r = await api<{ recalled: number; backend: string; eventsRestored: number }>("/api/restore", { method: "POST" });
                  return `Recalled ${r.recalled} memories from ${r.backend === "memwal" ? "Walrus Memory" : "local store"}; rebuilt ${r.eventsRestored} settled matches.`;
                })
              }
            >
              ⟲ Restore from {m.backend === "memwal" ? "Walrus" : "memory store"}
            </button>
          </div>
        </div>
        <div className={`status ${status.err ? "err" : ""}`} style={{ gridColumn: "1 / -1" }}>
          {status.text}
        </div>
      </section>

      <div className="grid">
        <div className="col">
          <section className="panel">
            <h2>Next up</h2>
            <p className="sub">
              {m.hasMemory
                ? "Every pick is read through memory: overconfident voices are shrunk, proven ones count more."
                : "No memory yet: every voice counts the same. Settle a match to start learning."}
            </p>
            {data.upcoming.length ? (
              data.upcoming.map((v) => <EventCard key={v.event.id} view={v} sources={data.leaderboard.map((l) => l.source)} onChange={refresh} />)
            ) : (
              <p className="small">Nothing unsettled. Import a live market below, or wipe local state to replay.</p>
            )}
          </section>
          <SettledList settled={data.settled} />
          <LiveMarkets onChange={refresh} />
        </div>
        <div className="col">
          <Leaderboard rows={data.leaderboard} hasMemory={m.hasMemory} />
          <MemoryTimeline items={m.timeline} backend={m.backend} />
          <OnchainPanel />
        </div>
      </div>
      <footer>
        Seed tipsters are synthetic, rule-based personas; match results and market prices are real (Polymarket public data). Not betting advice.
      </footer>
    </div>
  );
}
