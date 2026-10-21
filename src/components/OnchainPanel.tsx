"use client";

import { useEffect, useState } from "react";
import { api } from "./api";

type Res<T> = { ok: true; value: T } | { ok: false; error: string } | null;
interface Onchain {
  rpc: string;
  authenticated: boolean;
  chain: Res<string>;
  checkpoint: Res<string>;
  gasPrice: Res<string>;
  pyth: Res<{ price: number; conf: number; publishTime: string; ageSeconds: number; stale: boolean; objectId: string }>;
  account: Res<{ accountId: string; owner: string; delegateKeys: { label: string; agentId: string }[] }>;
  owner?: string;
  namespace: string;
  blobs: Res<{ blobs: { objectId: string; blobId: string }[]; scanned: number; truncated: boolean }>;
}

const show = <T,>(r: Res<T>, f: (v: T) => React.ReactNode) => (r === null ? <span className="small">not configured</span> : r.ok ? f(r.value) : <span className="small">⚠ {r.error}</span>);

export function OnchainPanel() {
  const [d, setD] = useState<Onchain | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const load = async (verify = false) => {
    setBusy(true);
    setErr("");
    try {
      setD(await api<Onchain>(`/api/onchain${verify ? "?verify=1" : ""}`));
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    load();
  }, []);

  return (
    <section className="panel">
      <h2>Onchain (Sui mainnet via Tatum RPC)</h2>
      <p className="sub">Read live through {d?.rpc ?? "the Tatum gateway"} {d && !d.authenticated && "(keyless: rate-limited; add TATUM_API_KEY)"}.</p>
      {err && <p className="small">⚠ {err}</p>}
      {d && (
        <div className="kv">
          <div className="k">Chain / checkpoint</div>
          <div className="mono">
            {show(d.chain, (v) => v)} · #{show(d.checkpoint, (v) => Number(v).toLocaleString())}
          </div>
          <div className="k">Reference gas price</div>
          <div className="mono">{show(d.gasPrice, (v) => `${v} MIST`)}</div>
          <div className="k">Pyth SUI/USD (onchain)</div>
          <div>
            {show(d.pyth, (p) => (
              <>
                ${p.price.toFixed(4)} ± {p.conf.toFixed(4)} · published {new Date(p.publishTime).toUTCString().slice(5, 22)} UTC{" "}
                {p.stale && <span className="small">(stale: pull oracle, updates when someone pushes a price)</span>}
              </>
            ))}
          </div>
          <div className="k">MemWal account</div>
          <div className="mono">
            {show(d.account, (a) => (
              <>
                <a href={`https://suiscan.xyz/mainnet/object/${a.accountId}`} target="_blank" rel="noreferrer">
                  {a.accountId.slice(0, 10)}…
                </a>{" "}
                · {a.delegateKeys.length} agent key(s): {a.delegateKeys.map((k) => `${k.label} ${k.agentId.slice(0, 8)}…`).join(", ")}
              </>
            ))}
          </div>
          <div className="k">Memories on Walrus</div>
          <div>
            {d.blobs
              ? show(d.blobs, (b) => (
                  <>
                    <b>{b.blobs.length}</b> blob objects in namespace <code>{d.namespace}</code> owned by{" "}
                    <a href={`https://suiscan.xyz/mainnet/account/${d.owner}`} target="_blank" rel="noreferrer">
                      {d.owner?.slice(0, 10)}…
                    </a>
                    {b.truncated && " (scan truncated)"}
                  </>
                ))
              : d.owner
                ? <span className="small">click verify to scan</span>
                : <span className="small">set MEMWAL_ACCOUNT_ID to verify</span>}
          </div>
        </div>
      )}
      <div className="form">
        <button disabled={busy} onClick={() => load(false)}>Refresh</button>
        <button disabled={busy || !d?.owner} onClick={() => load(true)}>Verify memories onchain</button>
      </div>
    </section>
  );
}
