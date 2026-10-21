"use client";

import { useState } from "react";
import type { LedgerEvent } from "@/lib/types";
import { api } from "./api";

export function LiveMarkets({ onChange }: { onChange: () => void }) {
  const [events, setEvents] = useState<LedgerEvent[] | null>(null);
  const [msg, setMsg] = useState("");
  const [threshold, setThreshold] = useState(1);
  const [odds, setOdds] = useState<Record<string, string>>({});

  const load = async () => {
    setMsg("Loading Polymarket cricket markets…");
    try {
      setEvents((await api<{ events: LedgerEvent[] }>("/api/live-markets")).events);
      setMsg("");
    } catch (e) {
      setMsg((e as Error).message);
    }
  };
  const add = async (e: LedgerEvent) => {
    const raw = odds[e.id]?.split(/[,\s/]+/).map(Number).filter((x) => x > 1);
    try {
      await api("/api/events", { method: "POST", body: JSON.stringify({ ...e, bookmakerOdds: raw?.length === 2 ? raw : undefined }) });
      setMsg(`Added “${e.title}”. Log picks on it under Next up.`);
      onChange();
    } catch (err) {
      setMsg((err as Error).message);
    }
  };
  const addMarket = async () => {
    try {
      await api("/api/markets/create", { method: "POST", body: JSON.stringify({ threshold, hoursFromNow: 24 }) });
      setMsg("Added an onchain-resolved SUI/USD question (locks in 24h, settles from Pyth via Tatum).");
      onChange();
    } catch (err) {
      setMsg((err as Error).message);
    }
  };

  return (
    <section className="panel">
      <h2>Add live events</h2>
      <p className="sub">Import upcoming cricket from Polymarket (optionally paste a bookmaker’s decimal odds), or create a markets question resolved onchain.</p>
      <div className="form">
        <button onClick={load}>Load upcoming cricket</button>
        <span className="small">SUI/USD ≥ $</span>
        <input type="number" step="0.01" value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} />
        <button onClick={addMarket}>Add markets question</button>
      </div>
      {msg && <p className="small">{msg}</p>}
      {events && (
        <table style={{ marginTop: 8 }}>
          <tbody>
            {events.map((e) => (
              <tr key={e.id}>
                <td>
                  {e.title.replace(/^.*?: /, "")} <span className="small">({Math.round((e.marketPrice ?? 0) * 100)}% {e.outcomes[0]})</span>
                </td>
                <td>
                  <input placeholder="odds e.g. 1.80 2.05" value={odds[e.id] ?? ""} onChange={(x) => setOdds({ ...odds, [e.id]: x.target.value })} style={{ width: 130 }} />
                </td>
                <td>
                  <button onClick={() => add(e)}>Add</button>
                </td>
              </tr>
            ))}
            {!events.length && (
              <tr>
                <td className="small">No upcoming cricket markets right now.</td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </section>
  );
}
