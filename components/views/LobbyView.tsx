"use client";

import Link from "next/link";
import { useState } from "react";
import { COMPANY_BY_ID } from "@/lib/companies";
import { LEAGUE_BY_SLUG } from "@/lib/leagues";
import { useRound } from "@/lib/hooks/useRound";
import { EARLY_BIRD_MS } from "@/lib/standings";
import { usePlayer } from "@/lib/hooks/usePlayer";
import { useGame } from "@/components/providers/GameProvider";
import { PageSkeleton, Shell } from "@/components/shell/Shell";
import { managerCount } from "@/components/league/LeagueFacts";
import { Achv, Avatar, Badge, Clock, CoLogo, Progress } from "@/components/ui/bits";
import { Icon } from "@/components/ui/Icon";

export function LobbyView({ slug }: { slug: string }) {
  const league = LEAGUE_BY_SLUG[slug];
  const { ready } = useGame();
  const player = usePlayer();
  const { view: next, ids, loaded } = useRound(league, "next");
  const { view: inPlayView } = useRound(league, "live");
  const [scoringOpen, setScoringOpen] = useState(false);

  if (!ready || !loaded) {
    return (
      <Shell>
        <PageSkeleton height={372} />
      </Shell>
    );
  }

  const round = next?.round ?? null;
  const inPlay = inPlayView?.round ?? { round: round?.round ?? 0, phase: ids.last ? ("final" as const) : ("upcoming" as const) };
  const joined = Boolean(next?.entry);
  const managers = next?.managers ?? [];
  const { count, capacity, full } = managerCount(league, managers.length);
  const base = `/league/${league.slug}`;
  const durationMin = league.schedule.durationMs / 60_000;

  return (
    <Shell>
      <section className="band band-pad">
        <span className="band-slash" style={{ right: -70, width: 200 }} aria-hidden="true" />
        <span className="band-slash thin" style={{ right: 170, opacity: 0.9 }} aria-hidden="true" />
        <div className="container split" style={{ position: "relative", "--side": "400px", "--gap": "56px" } as React.CSSProperties}>
          <div className="stack" style={{ gap: 18 }}>
            <nav aria-label="Breadcrumb" className="row" style={{ gap: 8, fontSize: 14 }}>
              <Link href="/leagues" className="row" style={{ gap: 4, fontWeight: 700, color: "var(--navy-ink-2)" }}>
                <Icon name="chevronLeft" size="sm" />
                Leagues
              </Link>
              <span style={{ color: "var(--ink-3)" }}>/</span>
              <span style={{ color: "#fff", fontWeight: 600 }} aria-current="page">
                {league.name}
              </span>
            </nav>
            <div className="row wrap" style={{ gap: 10 }}>
              {round ? (
                <span className="badge badge-soon">
                  <Icon name="clock" style={{ width: 14, height: 14 }} />
                  Upcoming
                </span>
              ) : (
                <Badge kind={inPlay.phase === "live" ? "live" : "done"}>{inPlay.phase === "live" ? "Live" : "Final"}</Badge>
              )}
              <span className="eyebrow" style={{ color: "var(--lime)", fontSize: 16 }}>
                Round {(round ?? inPlay).round} · {league.format}
              </span>
            </div>
            <h1 className="h-1 t-page">{league.name}</h1>
            <p className="lead" style={{ color: "var(--navy-ink-2)", maxWidth: 540 }}>
              {league.tagline}
            </p>
          </div>
          <div className="stack" style={{ gap: 22, paddingTop: 36 }}>
            {round && (
              <div className="stack" style={{ gap: 10 }}>
                <span className="cd-label" style={{ color: "var(--navy-ink-2)" }}>
                  Deadline in
                </span>
                <Clock ms={round.remaining} variant="xl" label="Deadline in" role="timer" />
              </div>
            )}
            <div className="row" style={{ gap: 14 }}>
              <CoLogo id={league.prize.company} size="lg" style={{ boxShadow: "0 0 0 2px var(--navy-line)" }} />
              <div className="stack" style={{ gap: 2 }}>
                <span className="eyebrow">Prize · winner takes it</span>
                <span className="h-3" style={{ fontSize: 28 }}>
                  ${league.prize.usd} in {COMPANY_BY_ID[league.prize.company].name} PreStock
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="overlap">
        <div className="container">
          <article className="card facts" style={{ "--cols": "1.2fr 1fr 1fr 1.2fr 300px" } as React.CSSProperties} aria-label="Key facts">
            <div className="fact head">
              <span className="cd-label">Managers</span>
              <span className="fig-m">
                {count}
                <span className="fig-of"> / {capacity}</span>
              </span>
              <Progress value={count / capacity} tone={full ? "full" : undefined} />
            </div>
            <div className="fact">
              <span className="cd-label">Duration</span>
              <span className="fig-m">{durationMin < 60 ? `${durationMin} min` : durationMin < 1440 ? `${durationMin / 60} hr` : `${durationMin / 1440} days`}</span>
            </div>
            <div className="fact">
              <span className="cd-label">Entry</span>
              <span className="fig-m">Free</span>
            </div>
            <div className="fact">
              <span className="cd-label">Squad</span>
              <span className="fig-m">3 picks</span>
              <span className="caption">33.3% each · equal weight</span>
            </div>
            <div className={["fact", "cta", joined || !round || full ? "" : "lime"].join(" ")}>
              {!round ? (
                <Link className="btn btn-navy btn-lg btn-block" href={`${base}/${inPlay.phase === "live" ? "live" : "results"}`}>
                  {inPlay.phase === "live" ? "Watch live" : "See results"}
                </Link>
              ) : joined ? (
                <Link className="btn btn-secondary btn-lg btn-block" href={`${base}/locked`}>
                  View my squad
                </Link>
              ) : full ? (
                <button type="button" className="btn btn-lg btn-block" disabled>
                  League full
                </button>
              ) : (
                <Link className="btn btn-navy btn-lg btn-block" href={`${base}/draft`}>
                  Draft my squad
                </Link>
              )}
              <span className="caption cta-note">
                {joined ? "Squad locked · you’re in" : inPlay.phase === "live" && round ? `Round ${inPlay.round} is in play now` : "You never buy what you draft."}
              </span>
            </div>
          </article>
        </div>
      </section>

      <div style={{ padding: "56px 0 80px" }}>
        <div className="container split" style={{ "--side": "380px", "--gap": "48px" } as React.CSSProperties}>
          <div className="stack" style={{ gap: 48 }}>
            <section className="stack" style={{ gap: 18 }} aria-labelledby="rules-h" id="rules">
              <h2 className="h-2 t-h2" id="rules-h">
                Rules
              </h2>
              <ol className="stack" style={{ gap: 10 }}>
                {[
                  ["Pick exactly 3 companies", `From the ${league.pool.length}-company draft pool`],
                  ["Equal-weight squad", "Each pick counts for 33.3%"],
                  ["Squads lock at the deadline", "No changes once the round starts"],
                  ["Highest % return wins", "Measured from kick-off to final whistle"],
                  ["Free entry", "You never buy what you draft"],
                ].map(([title, note], i) => (
                  <li key={title} className="card rule-row">
                    <span className="score rule-num">{i + 1}</span>
                    <span className="title">{title}</span>
                    <span className="small faint">{note}</span>
                  </li>
                ))}
              </ol>
            </section>

            <section className="stack" style={{ gap: 18 }} aria-labelledby="pool-h">
              <div className="row" style={{ alignItems: "baseline", gap: 14 }}>
                <h2 className="h-2 t-h2" id="pool-h">
                  Draft pool
                </h2>
                <span className="eyebrow">{league.pool.length} eligible companies</span>
              </div>
              <div className="pitch pool-pitch">
                <span className="pitch-circle" aria-hidden="true" />
                <ul className="pool-kits">
                  {league.pool.map((id) => {
                    const c = COMPANY_BY_ID[id];
                    return (
                      <li key={id} className="kit">
                        <div className="kit-shirt" style={{ background: c.fill }}>
                          <span className="mono-mark" style={{ color: c.ink }}>
                            {c.mono}
                          </span>
                        </div>
                        <div className="plate">
                          <div className="n">{c.name}</div>
                          <div className="p" style={{ fontFamily: "var(--f-mono)", fontSize: 11, fontWeight: 500 }}>
                            {c.symbol}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </section>
          </div>

          <aside className="stack" style={{ gap: 20 }} aria-label="League details">
            <section className="card" style={{ overflow: "hidden" }} aria-labelledby="managers-h">
              <div className="card-head">
                <span id="managers-h">Managers joined</span>
                <span className="spacer" />
                <span className="num" style={{ color: "var(--lime)" }}>
                  {count} / {capacity}
                </span>
              </div>
              <div className="stack" style={{ padding: "18px 20px 20px", gap: 16 }}>
                <Progress value={count / capacity} tone={full ? "full" : undefined} />
                {managers.length === 0 ? (
                  <p className="small muted">No squads yet. Be the first to draft.</p>
                ) : (
                  <ul style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "14px 16px" }}>
                    {[...managers].sort((a, b) => Number(b.you) - Number(a.you)).slice(0, 8).map((m) => (
                      <li key={m.id} className="row" style={{ gap: 10, fontWeight: m.mono ? 500 : 700, fontSize: 14, minWidth: 0 }}>
                        <Avatar initials={m.initials} tone={m.avatar} />
                        <span className={m.mono ? "mono" : ""} style={{ fontSize: m.mono ? 12.5 : undefined, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {m.you ? player.displayName : m.name}
                        </span>
                        {m.you && <span className="you-tag">You</span>}
                      </li>
                    ))}
                  </ul>
                )}
                {managers.length > 8 && <span className="caption">+ {managers.length - 8} more</span>}
                <span className="caption">
                  {full ? "All spots taken." : `${capacity - count} spots left. ${joined ? "You’re in." : "Draft a squad to take one."}`}
                </span>
              </div>
            </section>

            <section className="card row" style={{ padding: "18px 20px", gap: 16 }} aria-label="Achievement on offer">
              <Achv icon="clock" tone="blue" />
              <div className="stack" style={{ gap: 4, minWidth: 0 }}>
                <div className="row" style={{ gap: 8 }}>
                  <span className="h-3" style={{ fontSize: 22 }}>
                    Early bird
                  </span>
                  <Badge kind="xp">+20 XP</Badge>
                </div>
                <span className="small muted">Lock your squad at least {EARLY_BIRD_MS / 60_000} minutes before the deadline.</span>
              </div>
            </section>

            <div className="disclosure">
              <button type="button" className="disclosure-head" aria-expanded={scoringOpen} aria-controls="scoring-body" onClick={() => setScoringOpen((o) => !o)}>
                <Icon name="info" style={{ color: "var(--ink-3)" }} />
                <span style={{ flexGrow: 1 }}>How scoring works</span>
                <Icon name="chevronDown" style={{ color: "var(--ink-3)", transform: scoringOpen ? "rotate(180deg)" : undefined, transition: "transform .2s" }} />
              </button>
              {scoringOpen && (
                <div id="scoring-body" className="stack" style={{ padding: "0 18px 20px", gap: 14 }}>
                  <p className="body">
                    Your score is the average % return of your three picks, from kick-off to the final whistle. Prices come from live PreStock markets.
                  </p>
                  <div className="card-night stack" style={{ padding: "14px 16px", gap: 10, borderRadius: 12 }}>
                    <span className="eyebrow">Example squad</span>
                    <div className="row wrap num" style={{ gap: 8, fontSize: 14, fontWeight: 700 }}>
                      <span style={{ color: "var(--lime)" }}>+4.20%</span>
                      <span style={{ color: "var(--navy-ink-2)" }}>+</span>
                      <span style={{ color: "var(--lime)" }}>+2.10%</span>
                      <span style={{ color: "var(--navy-ink-2)" }}>+</span>
                      <span style={{ color: "var(--lime)" }}>+2.20%</span>
                      <span style={{ color: "var(--navy-ink-2)" }}>÷ 3 =</span>
                    </div>
                    <span className="delta up fig-m">+2.83%</span>
                  </div>
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>
    </Shell>
  );
}
