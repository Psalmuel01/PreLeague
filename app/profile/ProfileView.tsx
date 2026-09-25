"use client";

import Link from "next/link";
import { useState } from "react";
import { COMPANY_BY_ID } from "@/lib/companies";
import { dateLabel, pct, shortAddress } from "@/lib/format";
import { useHistory } from "@/lib/hooks/useHistory";
import { usePlayer } from "@/lib/hooks/usePlayer";
import { toRoundState, useRound } from "@/lib/hooks/useRound";
import { useGame } from "@/components/providers/GameProvider";
import { PageSkeleton, Shell } from "@/components/shell/Shell";
import { Badge, Clock, CoLogo, Delta, Medal, Move } from "@/components/ui/bits";
import { Icon } from "@/components/ui/Icon";
import { Pitch } from "@/components/ui/Pitch";
import { useSession } from "@/components/providers/SessionProvider";
import type { HistoryItem } from "@/lib/hooks/useHistory";

export function ProfileView() {
  const game = useGame();
  const player = usePlayer();
  const session = useSession();
  const history = useHistory();
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [copied, setCopied] = useState(false);
  const [showAll, setShowAll] = useState(false);

  if (!game.ready || !history) {
    return (
      <Shell>
        <PageSkeleton height={360} />
      </Shell>
    );
  }

  const { stats, level, xp, achievements } = history;
  const items = showAll ? history.items : history.items.slice(0, 5);

  const copy = async () => {
    if (!player.address) return;
    await navigator.clipboard.writeText(player.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Shell>
      <section className="band" style={{ padding: "52px 0 112px" }}>
        <span className="band-slash" style={{ right: -70, width: 200 }} aria-hidden="true" />
        <span className="band-slash thin" style={{ right: 170, opacity: 0.9 }} aria-hidden="true" />
        <div className="container split" style={{ position: "relative", "--side": "460px", "--gap": "56px", "--align": "center" } as React.CSSProperties}>
          <div className="row profile-id" style={{ gap: 28 }}>
            <span className="avatar av-you profile-avatar" aria-hidden="true">
              {player.initials}
            </span>
            <div className="stack" style={{ gap: 12, minWidth: 0 }}>
              <div className="row" style={{ gap: 10 }}>
                <Badge kind="xp">Level {level.level}</Badge>
                <span className="eyebrow" style={{ color: "var(--lime)", fontSize: 16 }}>
                  {level.title}
                </span>
              </div>
              {editing ? (
                <form
                  className="row"
                  style={{ gap: 8 }}
                  onSubmit={(e) => {
                    e.preventDefault();
                    void session.setDisplayName(draftName);
                    setEditing(false);
                  }}
                >
                  <label className="sr-only" htmlFor="name-input">
                    Display name
                  </label>
                  <input id="name-input" className="text-input" autoFocus maxLength={20} value={draftName} onChange={(e) => setDraftName(e.target.value)} placeholder="Your manager name" style={{ maxWidth: 260 }} />
                  <button className="btn btn-lime btn-sm" type="submit">
                    Save
                  </button>
                </form>
              ) : (
                <h1 className="h-hero t-hero-sm" style={{ wordBreak: "break-word" }}>
                  {player.displayName}
                </h1>
              )}
              <div className="row wrap" style={{ gap: 4 }}>
                {player.signedIn && player.address ? (
                  <>
                    <span className="mono" style={{ fontSize: 14, color: "var(--navy-ink-2)" }}>
                      {shortAddress(player.address)}
                    </span>
                    <button className="icon-btn" type="button" aria-label={copied ? "Copied" : "Copy wallet address"} onClick={copy} style={{ width: 36, height: 36, color: "var(--navy-ink-2)" }}>
                      <Icon name={copied ? "check" : "copy"} size="sm" />
                    </button>
                  </>
                ) : (
                  <button className="btn btn-lime btn-sm" type="button" onClick={() => player.signIn()} disabled={player.signingIn}>
                    {player.signingIn ? "Check your wallet…" : player.connected ? "Sign in" : "Connect wallet"}
                  </button>
                )}
                {!editing && player.signedIn && (
                  <button
                    className="btn btn-ghost-night btn-sm"
                    type="button"
                    style={{ marginLeft: 12 }}
                    onClick={() => {
                      setDraftName(session.displayName ?? "");
                      setEditing(true);
                    }}
                  >
                    Edit name
                  </button>
                )}
                {player.signedIn && (
                  <button className="btn btn-ghost-night btn-sm" type="button" style={{ marginLeft: 8 }} onClick={() => player.signOut()}>
                    Sign out
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="stack" style={{ background: "var(--navy-2)", borderRadius: 16, padding: 24, gap: 14, boxShadow: "0 0 0 1px var(--navy-line)" }}>
            <div className="stack" style={{ gap: 6 }}>
              <span className="eyebrow">Manager level</span>
              <span className="h-2" style={{ fontSize: "clamp(32px, 3.4vw, 44px)" }}>
                Level {level.level} · <span style={{ color: "var(--lime)" }}>{level.title}</span>
              </span>
            </div>
            <div className="xp" role="progressbar" aria-label="Experience" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(level.progress * 100)} style={{ height: 14 }}>
              <span style={{ width: `${Math.max(2, level.progress * 100)}%` }} />
            </div>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <span className="fig-s num">
                {xp.toLocaleString()} <span style={{ color: "var(--navy-ink-2)", fontSize: 16 }}>{level.next ? `/ ${level.next.toLocaleString()} XP` : "XP"}</span>
              </span>
              {level.next && (
                <span className="small" style={{ color: "var(--navy-ink-2)" }}>
                  {(level.next - xp).toLocaleString()} XP to Level {level.level + 1}
                </span>
              )}
            </div>
          </div>
        </div>
      </section>

      <section style={{ position: "relative", marginTop: -64, zIndex: 2 }}>
        <div className="container">
          <div className="cols-5 profile-stats" aria-label="Your stats">
            <Stat k="Leagues" v={String(stats.leagues)} />
            <Stat k="Wins" v={String(stats.wins)} />
            <Stat k="Best finish" v={stats.bestFinish ? `#${stats.bestFinish}` : "—"} />
            <Stat k="Avg. return" v={stats.avgReturn !== null ? pct(stats.avgReturn) : "—"} lime />
            <Stat k="Prizes won · PreStocks" v={`$${stats.prizesUsd}`} hero />
          </div>
        </div>
      </section>

      <section style={{ padding: "48px 0 0" }}>
        <div className="container">
          <div className="card" style={{ overflow: "hidden" }}>
            <div className="card-head" style={{ justifyContent: "space-between" }}>
              <span>Achievements</span>
              <span style={{ fontSize: 15, color: "var(--lime)" }}>
                {achievements.filter((a) => a.done).length} / {achievements.length} unlocked
              </span>
            </div>
            <ul className="achv-grid">
              {achievements.map((a) => (
                <li key={a.id} className="row" style={{ gap: 14 }}>
                  <span className={["achv", a.done ? a.tone ?? "" : "locked"].join(" ")} role="img" aria-label={a.done ? "Unlocked" : "Locked"}>
                    {a.icon ? <Icon name={a.done ? a.icon : "lock"} /> : <span className="score" style={{ fontSize: 30 }}>3</span>}
                  </span>
                  <span className="stack" style={{ gap: 2 }}>
                    <span className="title" style={{ fontSize: 16, color: a.done ? undefined : "var(--ink-3)" }}>
                      {a.title}
                    </span>
                    <span className="caption">{a.done ? a.caption : `Locked · ${a.caption.toLowerCase()}`}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section style={{ padding: "48px 0 88px" }}>
        <div className="container split" style={{ "--side": "390px", "--gap": "40px" } as React.CSSProperties}>
          <div className="stack" style={{ gap: 16 }}>
            <div className="row" style={{ alignItems: "baseline", gap: 12 }}>
              <h2 className="h-2 t-h2">History</h2>
              <span className="caption">{history.items.length} finished</span>
            </div>
            <div className="card" style={{ overflow: "hidden" }}>
              {history.items.length === 0 ? (
                <div className="empty-state">
                  <Icon name="trophy" size="lg" style={{ color: "var(--ink-3)" }} />
                  <p className="title">No finished rounds yet</p>
                  <p className="small muted">Lock a squad and your results will show up here after the final whistle.</p>
                  <Link className="btn btn-navy" href="/leagues">
                    Find a league
                  </Link>
                </div>
              ) : (
                <>
                  <div className="lb" style={{ "--lb-cols": "84px minmax(0, 1fr) auto 120px" } as React.CSSProperties}>
                    <div className="lb-head">
                      <span>Pos</span>
                      <span>League</span>
                      <span className="hide-sm">Prize</span>
                      <span style={{ textAlign: "right" }}>Return</span>
                    </div>
                    {items.map((it) => (
                      <Link key={it.leagueId} className="lb-row" href={`/league/${it.league.slug}/results?round=${it.leagueId}`} style={{ minHeight: 78, color: "var(--ink)" }}>
                        <span className="lb-rank">{it.rank ? it.rank <= 3 ? <Medal rank={it.rank} /> : <span style={{ paddingLeft: 4 }}>{it.rank}</span> : "—"}</span>
                        <div className="stack" style={{ gap: 2, minWidth: 0 }}>
                          <span className="title" style={{ fontSize: 16 }}>
                            {it.league.name}
                          </span>
                          <span className="caption">
                            Round {it.round} · {dateLabel(it.startsAt)}
                            {it.status !== "completed" ? (it.status === "cancelled" ? " · cancelled" : " · under review") : ""}
                          </span>
                        </div>
                        <span className="hide-sm">
                          {it.rank === 1 ? (
                            <span className="badge badge-won" style={{ height: 32, padding: "0 12px 0 5px" }}>
                              <CoLogo id={it.league.prize.company} size="xs" />
                              Won ${it.league.prize.usd}
                              <span className="mono" style={{ fontSize: 12, fontWeight: 500 }}>
                                {COMPANY_BY_ID[it.league.prize.company].symbol}
                              </span>
                            </span>
                          ) : null}
                        </span>
                        <span className="lb-return">{it.score !== null ? <Delta value={it.score} /> : <span className="caption">Not scored</span>}</span>
                      </Link>
                    ))}
                  </div>
                  {history.items.length > 5 && (
                    <div style={{ borderTop: "1px solid var(--line)", padding: "10px 12px" }}>
                      <button className="btn btn-ghost btn-sm" type="button" onClick={() => setShowAll((v) => !v)}>
                        {showAll ? "Show fewer" : `Show all ${history.items.length} rounds`}
                        <Icon name={showAll ? "chevronUp" : "chevronDown"} size="sm" />
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          <aside className="stack" style={{ gap: 16 }} aria-labelledby="active-title">
            <div className="row" style={{ alignItems: "baseline", gap: 12 }}>
              <h2 className="h-2 t-h2" id="active-title">
                Active leagues
              </h2>
              <span className="caption">{history.active.length}</span>
            </div>
            {history.active.length === 0 && (
              <div className="card empty-state">
                <p className="title">No squads on the pitch</p>
                <Link className="btn btn-lime" href="/leagues">
                  Join a league
                </Link>
              </div>
            )}
            {history.active.map((a) => (
              <ActiveCard key={a.leagueId} item={a} />
            ))}
          </aside>
        </div>
      </section>
    </Shell>
  );
}

function Stat({ k, v, hero, lime }: { k: string; v: string; hero?: boolean; lime?: boolean }) {
  return (
    <div className={["stat-box", hero ? "hero" : ""].join(" ")} style={{ padding: "18px 20px", gap: 10 }}>
      <span className="k">{k}</span>
      <span className="v profile-stat-v" style={lime ? { color: "var(--lime)" } : undefined}>
        {v}
      </span>
    </div>
  );
}

function ActiveCard({ item }: { item: HistoryItem }) {
  const { league } = item;
  const { now } = useGame();
  const { view } = useRound(league, item.leagueId);
  const entry = { picks: item.picks };
  const r = view?.round ?? toRoundState(item, now);
  const live = r.phase === "live";
  const you = view?.you;
  if (!live) {
    return (
      <article className="card stack" style={{ padding: 20, gap: 14 }}>
        <div className="row wrap" style={{ gap: 8 }}>
          <Badge kind="soon">Kicks off in</Badge>
          <Clock ms={r.remaining} variant="card-sm" label="Kicks off in" />
          <Badge kind="joined">Joined</Badge>
        </div>
        <div className="stack" style={{ gap: 2 }}>
          <h3 className="h-3">{league.name}</h3>
          <span className="caption">
            Round {r.round} · {league.format} · ${league.prize.usd} in {COMPANY_BY_ID[league.prize.company].name} PreStock
          </span>
        </div>
        <div className="row" style={{ justifyContent: "space-between" }}>
          <span className="small row" style={{ gap: 6, fontWeight: 700, color: "var(--up)" }}>
            <Icon name="check" size="sm" />
            Squad set
          </span>
          <Link href={`/league/${league.slug}/locked`} className="link-row" style={{ fontSize: 14, minHeight: 36 }}>
            View squad
            <Icon name="chevronRight" size="sm" />
          </Link>
        </div>
      </article>
    );
  }
  return (
    <article className="card" style={{ overflow: "hidden" }}>
      <div className="band stack" style={{ padding: "18px 20px", gap: 14 }}>
        <div className="row" style={{ justifyContent: "space-between" }}>
          <Badge kind="live">Live</Badge>
          <span className="caption">
            Round {r.round} · {view?.managers.length ?? 0} managers
          </span>
        </div>
        <div className="row" style={{ alignItems: "flex-end", justifyContent: "space-between", gap: 12 }}>
          <h3 className="h-3" style={{ fontSize: 28 }}>
            {league.name}
          </h3>
          <Clock ms={r.remaining} variant="sm" label="Time left" />
        </div>
      </div>
      <Pitch height={216} mini slots={entry.picks.map((id) => ({ id, value: view?.returns?.[id] ?? "33.3%" }))} colGap={72} rowGap={6} style={{ borderRadius: 0, border: 0, boxShadow: "none" }} />
      <div className="stack" style={{ padding: "18px 20px 20px", gap: 16 }}>
        <div className="cols-2" style={{ gap: 10 }}>
          <div className="stat-box" style={{ padding: "12px 14px" }}>
            <span className="k">Position</span>
            <span className="v row" style={{ gap: 8 }}>
              {you ? `#${you.rank}` : "—"}
              {you && <Move n={you.move} />}
            </span>
          </div>
          <div className="stat-box hero" style={{ padding: "12px 14px" }}>
            <span className="k">Your return</span>
            <span className="v">{you ? pct(you.portfolioReturn) : "—"}</span>
          </div>
        </div>
        <Link className="btn btn-lime btn-block" href={`/league/${league.slug}/live`}>
          Open live table
        </Link>
      </div>
    </article>
  );
}

