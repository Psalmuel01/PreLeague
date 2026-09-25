"use client";

import { useCallback, useEffect, useState } from "react";
import { Shell } from "@/components/shell/Shell";
import { useGame } from "@/components/providers/GameProvider";
import { Badge } from "@/components/ui/bits";

type LeagueRow = {
  id: string;
  series: string;
  round: number;
  status: string;
  starts_at: string;
  ends_at: string;
  players: number;
  winner_wallet: string | null;
  review_reason: string | null;
};
type Status = {
  leagues: LeagueRow[];
  latestSnapshot: string | null;
  snapshots: number;
  jobs: { job: string; ok: boolean; detail: string | null; ran_at: string }[];
};

const KEY = "preleague:admin";
const t = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

// Demo controls: snapshot prices, kick off / end / settle / cancel a round, seed demo managers.
export function AdminView() {
  const [secret, setSecret] = useState("");
  const [status, setStatus] = useState<Status | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { now } = useGame();

  const load = useCallback(async (s: string) => {
    const res = await fetch("/api/admin", { headers: { "x-admin-secret": s }, cache: "no-store" });
    if (!res.ok) {
      setStatus(null);
      setMsg(res.status === 401 ? "Wrong admin secret" : `Error ${res.status}`);
      return;
    }
    setStatus(await res.json());
  }, []);

  useEffect(() => {
    let saved = "";
    try {
      saved = sessionStorage.getItem(KEY) ?? "";
    } catch {}
    // eslint-disable-next-line react-hooks/set-state-in-effect -- restore the secret typed earlier this session
    setSecret(saved);
    if (saved) void load(saved);
  }, [load]);

  useEffect(() => {
    if (!status) return;
    const id = setInterval(() => load(secret), 10_000);
    return () => clearInterval(id);
  }, [status, secret, load]);

  async function act(action: string, leagueId?: string) {
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/admin", {
      method: "POST",
      headers: { "content-type": "application/json", "x-admin-secret": secret },
      body: JSON.stringify({ action, leagueId }),
    });
    const body = await res.json().catch(() => ({}));
    setMsg(`${action}${leagueId ? ` ${leagueId}` : ""}: ${res.ok ? JSON.stringify(body) : body.error ?? res.status}`);
    await load(secret);
    setBusy(false);
  }

  const age = status?.latestSnapshot ? Math.max(0, Math.round((now - new Date(status.latestSnapshot).getTime()) / 1000)) : null;

  return (
    <Shell footer={false}>
      <div className="container stack" style={{ padding: "40px 0 80px", gap: 20 }}>
        <h1 className="h-1">Admin</h1>
        <form
          className="row wrap"
          style={{ gap: 8 }}
          onSubmit={(e) => {
            e.preventDefault();
            try {
              sessionStorage.setItem(KEY, secret);
            } catch {}
            void load(secret);
          }}
        >
          <label className="sr-only" htmlFor="admin-secret">
            Admin secret
          </label>
          <input id="admin-secret" className="text-input" type="password" placeholder="ADMIN_SECRET" value={secret} onChange={(e) => setSecret(e.target.value)} style={{ maxWidth: 320 }} />
          <button className="btn btn-navy btn-sm" type="submit">
            Unlock
          </button>
        </form>
        {msg && <div className="banner banner-info mono" style={{ fontSize: 12.5, wordBreak: "break-all" }}>{msg}</div>}

        {status && (
          <>
            <div className="card row wrap" style={{ padding: 18, gap: 18 }}>
              <span className="title">
                Latest snapshot: {status.latestSnapshot ? `${t(status.latestSnapshot)} (${age}s ago)` : "none"} · {status.snapshots.toLocaleString()} stored
              </span>
              <span className="spacer" />
              <button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => act("snapshot")}>
                Take snapshot
              </button>
              <button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => act("tick")}>
                Run scheduler tick
              </button>
            </div>

            <div className="card" style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                <thead>
                  <tr style={{ background: "var(--navy)", color: "#fff", textAlign: "left" }}>
                    {["League", "Status", "Kick-off", "Whistle", "Players", "Actions"].map((h) => (
                      <th key={h} style={{ padding: "10px 12px", fontFamily: "var(--f-display)", textTransform: "uppercase", letterSpacing: ".06em" }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {status.leagues.map((l) => (
                    <tr key={l.id} style={{ borderTop: "1px solid var(--line)" }}>
                      <td style={{ padding: "10px 12px", fontWeight: 700 }}>{l.id}</td>
                      <td style={{ padding: "10px 12px" }}>
                        <Badge kind={l.status === "live" ? "live" : l.status === "completed" ? "done" : l.status === "upcoming" ? "soon" : "warn"}>{l.status}</Badge>
                        {l.review_reason && <div className="caption">{l.review_reason}</div>}
                      </td>
                      <td style={{ padding: "10px 12px" }} className="num">{t(l.starts_at)}</td>
                      <td style={{ padding: "10px 12px" }} className="num">{t(l.ends_at)}</td>
                      <td style={{ padding: "10px 12px" }} className="num">{l.players}</td>
                      <td style={{ padding: "10px 12px" }}>
                        <div className="row wrap" style={{ gap: 6 }}>
                          {l.status === "upcoming" && (
                            <>
                              <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => act("bots", l.id)}>
                                Add demo managers
                              </button>
                              <button className="btn btn-lime btn-sm" disabled={busy} onClick={() => act("start", l.id)}>
                                Start now
                              </button>
                            </>
                          )}
                          {l.status === "live" && (
                            <button className="btn btn-navy btn-sm" disabled={busy} onClick={() => act("end", l.id)}>
                              End &amp; settle
                            </button>
                          )}
                          {["settling", "review_required"].includes(l.status) && (
                            <button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => act("settle", l.id)}>
                              Retry settle
                            </button>
                          )}
                          {!["completed", "cancelled"].includes(l.status) && (
                            <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => act("cancel", l.id)}>
                              Cancel
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="card stack" style={{ padding: 18, gap: 6 }}>
              <span className="eyebrow">Recent jobs</span>
              {status.jobs.map((j, i) => (
                <div key={i} className="small mono" style={{ color: j.ok ? "var(--ink-2)" : "var(--down)" }}>
                  {t(j.ran_at)} {j.job} {j.ok ? "ok" : "FAILED"} — {j.detail}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </Shell>
  );
}
