"use client";

import type { Dashboard } from "@/lib/engine/service";

export function MemoryTimeline({ items, backend }: { items: Dashboard["memory"]["timeline"]; backend: string }) {
  return (
    <section className="panel">
      <h2>Memory timeline</h2>
      <p className="sub">
        {backend === "memwal"
          ? "Each entry is a Seal-encrypted memory on Walrus, owned by our MemWal account on Sui mainnet."
          : "Local fallback store. Add MemWal keys to .env to write these to Walrus Memory on mainnet."}
      </p>
      {items.length === 0 ? (
        <p className="small">No memories yet.</p>
      ) : (
        <ul className="timeline">
          {items.map((m, i) => (
            <li key={`${m.writtenAt}-${i}`}>
              <div className={`kind ${m.kind}`}>
                {m.kind === "insight" ? "lesson learned" : "scorecard"} · {new Date(m.writtenAt).toLocaleString()}
              </div>
              <div className="txt">
                {m.kind === "insight"
                  ? m.lesson
                  : `After ${m.eventTitle.replace(/^.*?: /, "")}: ${m.result} won. Top voice: ${[...m.sources].sort((a, b) => b.weight - a.weight)[0]?.name ?? "—"}.`}
              </div>
              {m.blobId && (
                <div className="blob mono">
                  blob{" "}
                  <a href={`https://walruscan.com/mainnet/blob/${m.blobId}`} target="_blank" rel="noreferrer">
                    {m.blobId.slice(0, 18)}…
                  </a>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
