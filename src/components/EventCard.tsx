"use client";

import { useState } from "react";
import type { EventView } from "@/lib/engine/ledger";
import type { Source } from "@/lib/types";
import { api } from "./api";

const pct = (p?: number) => (p === undefined ? "—" : `${Math.round(p * 100)}%`);

function Row({ label, p, cls }: { label: string; p?: number; cls: string }) {
  return (
    <>
      <div>{label}</div>
      <div className="bar">{p !== undefined && <span className={cls} style={{ width: `${p * 100}%` }} />}</div>
      <div className="num">{pct(p)}</div>
    </>
  );
}

export function EventCard({ view, sources, onChange }: { view: EventView & { seed: boolean }; sources: Source[]; onChange: () => void }) {
  const { event, consensus, report, bookmakerP0 } = view;
  const name = (id: string) => sources.find((s) => s.id === id)?.name ?? id;
  const started = Date.now() > new Date(event.startsAt).getTime();
  const [who, setWho] = useState("Me");
  const [prob, setProb] = useState(60);
  const [msg, setMsg] = useState("");

  const logPick = async () => {
    try {
      await api("/api/picks", { method: "POST", body: JSON.stringify({ eventId: event.id, sourceName: who, probability: prob / 100 }) });
      setMsg("Pick logged.");
      onChange();
    } catch (e) {
      setMsg((e as Error).message);
    }
  };
  const settle = async (result: 0 | 1) => {
    try {
      const path = event.resolver ? "/api/settle-onchain" : "/api/settle";
      const r = await api<{ settled?: boolean | string; reason?: string }>(path, { method: "POST", body: JSON.stringify({ eventId: event.id, result }) });
      setMsg(r.reason ?? "Settled and remembered.");
      onChange();
    } catch (e) {
      setMsg((e as Error).message);
    }
  };

  return (
    <div className="event">
      <div className="meta">
        <span>{event.sport === "markets" ? "📈 markets" : "🏏 cricket"} · {event.competition}</span>
        <span>starts {new Date(event.startsAt).toUTCString().slice(5, 22)} UTC</span>
        <span className={`flag ${report.level}`}>
          {report.level === "agree" ? "sources agree" : `${report.level === "strong" ? "strong " : ""}disagreement ${Math.round(report.maxGap * 100)} pts`}
        </span>
      </div>
      <h3>
        {event.title} <span className="small">· probabilities for {event.outcomes[0]}</span>
      </h3>
      <div className="bars">
        <Row label="Market (Polymarket)" p={event.marketPrice} cls="market" />
        {bookmakerP0 !== undefined && <Row label="Bookmaker (de-vigged)" p={bookmakerP0} cls="book" />}
        <Row label="Tipsters, before memory" p={consensus?.naive} cls="naive" />
        <Row label="Ledger, after memory" p={consensus?.weighted} cls="weighted" />
      </div>
      <div className="rec">{report.recommendation.text}</div>
      {consensus && (
        <div className="chips">
          {consensus.weights.map((w) => {
            const adjusted = w.adjusted;
            const reread = Math.abs(adjusted - w.probability) >= 0.01;
            return (
              <span key={w.sourceId} className={`chip ${w.weight < 0.35 ? "dim" : ""}`} title="stated → as read through memory · weight">
                {name(w.sourceId)}: <b>{pct(w.probability)}</b>
                {reread ? ` → ${pct(adjusted)}` : ""} · w {w.weight.toFixed(2)}
              </span>
            );
          })}
        </div>
      )}
      <div className="form">
        {view.seed ? (
          <span className="small">Demo match: picks were logged 2h before start; use “Settle next match” to reveal the real result.</span>
        ) : !started ? (
          <>
            <input value={who} onChange={(e) => setWho(e.target.value)} placeholder="source name" style={{ width: 130 }} />
            <span className="small">gives {event.outcomes[0]}</span>
            <input type="number" min={1} max={99} value={prob} onChange={(e) => setProb(Number(e.target.value))} />
            <span className="small">%</span>
            <button onClick={logPick}>Log pick</button>
          </>
        ) : (
          <span className="small">Picks locked (started).</span>
        )}
        {!view.seed && started && (
          <>
            {event.resolver ? (
              <button onClick={() => settle(0)}>Settle from Pyth via Tatum</button>
            ) : (
              <>
                <button onClick={() => settle(0)}>{event.outcomes[0]} won</button>
                <button onClick={() => settle(1)}>{event.outcomes[1]} won</button>
              </>
            )}
          </>
        )}
        {msg && <span className="small">{msg}</span>}
      </div>
    </div>
  );
}
