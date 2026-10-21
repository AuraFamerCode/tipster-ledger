"use client";

import type { Dashboard } from "@/lib/engine/service";

const pct = (p?: number) => (p === undefined ? "—" : `${Math.round(p * 100)}%`);

export function SettledList({ settled }: { settled: Dashboard["settled"] }) {
  if (!settled.length) return null;
  return (
    <section className="panel">
      <h2>Post-game scorecards</h2>
      <p className="sub">What the app said before the result (for the first-listed side), and who won.</p>
      <table>
        <thead>
          <tr>
            <th>Match</th>
            <th>Market</th>
            <th>No memory</th>
            <th>Memory</th>
            <th>Winner</th>
          </tr>
        </thead>
        <tbody>
          {settled.map(({ event, shown }) => (
            <tr key={event.id}>
              <td title={event.resultSource}>{event.title.replace(/^.*?: /, "")}</td>
              <td className="num">{pct(event.marketPrice)}</td>
              <td className="num">{pct(shown?.naive)}</td>
              <td className="num">{shown?.usedMemory ? pct(shown.weighted) : "—"}</td>
              <td className="won">{event.result !== undefined ? event.outcomes[event.result] : ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
