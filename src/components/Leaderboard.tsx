"use client";

import type { Dashboard } from "@/lib/engine/service";

const pct = (x: number) => `${Math.round(x * 100)}%`;

export function Leaderboard({ rows, hasMemory }: { rows: Dashboard["leaderboard"]; hasMemory: boolean }) {
  return (
    <section className="panel">
      <h2>Who to trust</h2>
      <p className="sub">
        {hasMemory ? "Read from the newest scorecard in memory. Weight 1.00 = average voice." : "Empty until the first scorecard is remembered."}
      </p>
      <table>
        <thead>
          <tr>
            <th>Source</th>
            <th>Weight</th>
            <th>Brier</th>
            <th>Hit</th>
            <th>n</th>
            <th>Reads 80% as</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ source, remembered: r }) => (
            <tr key={source.id} title={source.style}>
              <td>
                {source.name}{" "}
                <span className={`st ${r?.status ?? "new"}`}>{source.kind === "market" ? "benchmark" : (r?.status ?? "new")}</span>
              </td>
              <td>
                <span className="wbar">
                  <span style={{ width: `${Math.min(100, ((r?.weight ?? 1) / 5) * 100)}%` }} />
                </span>
                {(r?.weight ?? 1).toFixed(2)}
              </td>
              <td className="num">{r ? r.brier.toFixed(3) : "—"}</td>
              <td className="num">{r ? pct(r.hitRate) : "—"}</td>
              <td className="num">{r?.n ?? 0}</td>
              <td className="num">{r ? pct(Math.min(0.99, Math.max(0.01, 0.5 + 0.3 * r.calibrationFactor))) : "80%"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
