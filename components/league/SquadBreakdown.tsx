"use client";

import { COMPANY_BY_ID } from "@/lib/companies";
import { contribution } from "@/lib/scoring";
import { pct, usd } from "@/lib/format";
import type { RoundView, Standing } from "@/lib/hooks/useRound";
import { CoLogo, Delta, Move } from "@/components/ui/bits";
import { Icon } from "@/components/ui/Icon";
import { Pitch } from "@/components/ui/Pitch";
import { Clock } from "@/components/ui/bits";

/** Per-company breakdown of a squad: start → now, return, contribution, and the formula. */
export function SquadBreakdown({ view, s, onClose, title }: { view: RoundView; s: Standing; onClose: () => void; title: string }) {
  const start = view.boundary.start ?? {};
  const now = view.nowPrices ?? {};
  const maxAbs = Math.max(...s.pickReturns.map((r) => Math.abs(contribution(r))), 1e-9);
  const live = view.round.phase === "live";
  return (
    <>
      <div className="pl-scrim" onClick={onClose} aria-hidden="true" />
      <aside className="pl-drawer stack" role="dialog" aria-modal="true" aria-labelledby="squad-title">
        <div className="row" style={{ alignItems: "flex-start", justifyContent: "space-between", gap: 16, padding: "24px 24px 0 28px" }}>
          <div className="stack" style={{ gap: 10 }}>
            <span className="eyebrow row" style={{ gap: 8 }}>
              {live && <span className="live-dot" />}
              {view.league.name} · {live ? "Live" : "Final"}
            </span>
            <h2 className="h-2" id="squad-title">
              {title}
            </h2>
            <p className="body" style={{ fontWeight: 600, color: "var(--ink)" }}>
              {headline(s)}
            </p>
          </div>
          <button type="button" className="icon-btn" aria-label="Close" onClick={onClose} style={{ color: "var(--ink)" }}>
            <Icon name="close" />
          </button>
        </div>

        <div className="stack" style={{ padding: "20px 28px 28px", gap: 18 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1.15fr .85fr", gap: 8 }} aria-label="Squad status">
            <div className="stat-box hero">
              <span className="k">Squad return</span>
              <span className="v">{pct(s.portfolioReturn)}</span>
            </div>
            <div className="stat-box">
              <span className="k">Rank</span>
              <span className="row" style={{ gap: 8 }}>
                <span className="v">#{s.rank}</span>
                <span className="fig-s" style={{ color: "var(--navy-ink-2)" }}>
                  of {view.managers.length}
                </span>
                {live && <Move n={s.move} />}
              </span>
            </div>
            <div className="stat-box">
              <span className="k">{live ? "Time left" : "Status"}</span>
              {live ? <Clock ms={view.round.remaining} label="Time left" variant="sm" /> : <span className="v">Final</span>}
            </div>
          </div>

          <Pitch height={196} mini slots={s.picks.map((id, i) => ({ id, value: s.pickReturns[i] }))} colGap={100} rowGap={4} />

          <section className="card-flat" style={{ overflow: "hidden" }} aria-label="Breakdown by company">
            <div className="bd-row bd-head">
              <span>Company</span>
              <span style={{ textAlign: "right" }}>Start</span>
              <span style={{ textAlign: "right" }}>{live ? "Current" : "End"}</span>
              <span style={{ textAlign: "right" }}>Return</span>
            </div>
            {s.picks.map((id, i) => {
              const c = COMPANY_BY_ID[id];
              const r = s.pickReturns[i];
              const add = contribution(r);
              return (
                <div key={id} className="stack" style={{ gap: 10, padding: "14px 18px", borderTop: i ? "1px solid var(--line)" : 0 }}>
                  <div className="bd-row">
                    <div className="row" style={{ gap: 10, minWidth: 0 }}>
                      <CoLogo id={id} size="sm" />
                      <div className="stack" style={{ gap: 1 }}>
                        <span style={{ fontWeight: 700, fontSize: 15, lineHeight: 1.2 }}>{c.name}</span>
                        <span className="ticker">{c.symbol}</span>
                      </div>
                    </div>
                    <span className="num small faint" style={{ textAlign: "right" }}>
                      {start[c.symbol] ? usd(start[c.symbol]) : "—"}
                    </span>
                    <span className="num small" style={{ textAlign: "right", fontWeight: 700 }}>
                      {now[c.symbol] ? usd(now[c.symbol]) : "—"}
                    </span>
                    <span style={{ textAlign: "right" }}>
                      <Delta value={r} />
                    </span>
                  </div>
                  <div className="row" style={{ gap: 12, paddingLeft: 38 }}>
                    <div className="progress" style={{ flexGrow: 1, height: 6 }}>
                      <span style={{ width: `${(Math.abs(add) / maxAbs) * 100}%`, background: add >= 0 ? "var(--lime-press)" : "var(--down-bg)" }} />
                    </div>
                    <span className="caption num" style={{ width: 96, textAlign: "right", fontWeight: 600 }}>
                      {add >= 0 ? "Adds" : "Costs"} {pct(add)}
                    </span>
                  </div>
                </div>
              );
            })}
          </section>

          <section className="card-sunken stack" style={{ padding: "18px 20px", gap: 12 }} aria-labelledby="score-title">
            <h3 className="h-3" id="score-title" style={{ fontSize: 22 }}>
              How your score is made
            </h3>
            <div className="row wrap" style={{ gap: 5 }} role="math" aria-label={`(${s.pickReturns.map((r) => pct(r)).join(" + ")}) ÷ 3 = ${pct(s.portfolioReturn)}`}>
              <span className="fig-m" style={{ color: "var(--ink-3)" }} aria-hidden="true">
                (
              </span>
              {s.picks.map((id, i) => (
                <span key={id} className="row" style={{ gap: 5 }} aria-hidden="true">
                  {i > 0 && (
                    <span className="fig-m" style={{ color: "var(--ink-3)" }}>
                      +
                    </span>
                  )}
                  <span className="stat-box" style={{ padding: "8px 10px", gap: 4, alignItems: "center", minWidth: 68 }}>
                    <CoLogo id={id} size="xs" style={{ boxShadow: "0 0 0 1.5px rgba(255,255,255,.35)" }} />
                    <span className="fig-s" style={{ color: s.pickReturns[i] >= 0 ? "var(--lime)" : "#FF8A80" }}>
                      {(s.pickReturns[i] * 100).toFixed(2)}
                    </span>
                  </span>
                </span>
              ))}
              <span className="fig-m" style={{ color: "var(--ink-3)" }} aria-hidden="true">
                ) ÷
              </span>
              <span className="stat-box light" style={{ padding: "8px 12px", alignItems: "center", justifyContent: "center", alignSelf: "stretch" }} aria-hidden="true">
                <span className="fig-m">3</span>
              </span>
            </div>
            <div className="stat-box hero" style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: "14px 18px" }} aria-hidden="true">
              <span className="k" style={{ fontSize: 15 }}>
                = Squad score
              </span>
              <span className="v" style={{ fontSize: 40 }}>
                {pct(s.portfolioReturn)}
              </span>
            </div>
            <p className="small muted">Each pick counts for a third. Your score is the average of their moves.</p>
          </section>

          <div className="small muted row" style={{ gap: 8 }}>
            <Icon name="info" size="sm" />
            Virtual squad — you don’t own these shares.
          </div>
        </div>
      </aside>
    </>
  );
}

export function headline(s: Standing): string {
  const best = s.picks[s.pickReturns.indexOf(Math.max(...s.pickReturns))];
  const worst = s.picks[s.pickReturns.indexOf(Math.min(...s.pickReturns))];
  const name = (id: string) => COMPANY_BY_ID[id as keyof typeof COMPANY_BY_ID].name;
  const who = s.you ? "your" : "the";
  const pos = s.you ? (s.rank === 1 ? "You’re top of the table." : `You’re #${s.rank}.`) : `${s.name} is #${s.rank}.`;
  if (Math.max(...s.pickReturns) > 0) return `${pos} ${name(best)} is carrying ${who} lineup.`;
  return `${pos} ${name(worst)} is dragging ${who} lineup.`;
}
