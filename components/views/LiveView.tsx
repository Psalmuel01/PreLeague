"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { COMPANY_BY_ID, type CompanyId } from "@/lib/companies";
import { LEAGUE_BY_SLUG } from "@/lib/leagues";
import { pct, pctAbs, timeOfDay } from "@/lib/format";
import { useRound, type Standing } from "@/lib/hooks/useRound";
import { useGame } from "@/components/providers/GameProvider";
import { CompanySheet } from "@/components/league/CompanySheet";
import { PriceSourcePill } from "@/components/league/PriceSourcePill";
import { SquadBreakdown, headline } from "@/components/league/SquadBreakdown";
import { MobileBarTitle } from "@/components/shell/MobileBarTitle";
import { PageSkeleton, Shell } from "@/components/shell/Shell";
import { Achv, Avatar, Badge, Clock, CoLogo, Delta, Move } from "@/components/ui/bits";
import { Icon } from "@/components/ui/Icon";
import { LeagueTable } from "@/components/ui/LeagueTable";
import { Pitch } from "@/components/ui/Pitch";

export function LiveView({ slug }: { slug: string }) {
  const league = LEAGUE_BY_SLUG[slug];
  const router = useRouter();
  const { ready } = useGame();
  const { view, loaded } = useRound(league, "current");
  const [company, setCompany] = useState<CompanyId | null>(null);
  const [breakdown, setBreakdown] = useState(false);

  // At the final whistle, follow the round you were watching to its results.
  const watching = useRef<{ id: string; live: boolean } | null>(null);
  useEffect(() => {
    if (!view) return;
    const prev = watching.current;
    if (prev?.live && prev.id !== view.id) {
      router.push(`/league/${slug}/results?round=${prev.id}`);
      return;
    }
    watching.current = { id: view.id, live: view.round.phase === "live" };
  }, [view, router, slug]);

  if (!ready || !loaded) {
    return (
      <Shell>
        <PageSkeleton height={420} />
      </Shell>
    );
  }
  if (!view) {
    return <Redirect to={`/league/${slug}`} />;
  }
  const { round, standings, you } = view;
  if (round.phase === "final") {
    return <Redirect to={`/league/${slug}/results?round=${view.id}`} />;
  }
  if (round.phase === "upcoming") {
    return <PreMatch slug={slug} joined={Boolean(view.entry)} kickoffIn={round.remaining} kickoff={round.kickoff} round={round.round} />;
  }

  const returns = view.returns;
  const movers = returns ? league.pool.map((id) => ({ id, r: returns[id] })).sort((a, b) => b.r - a.r) : [];
  const leader = standings?.[0] ?? null;
  const focus: Standing | null = you ?? leader;
  const avg = standings?.length ? standings.reduce((s, x) => s + x.portfolioReturn, 0) / standings.length : null;
  const prizeName = COMPANY_BY_ID[league.prize.company].name;

  return (
    <Shell
      mobileBar={
        <>
          <MobileBarTitle title={league.name} sub={`Round ${round.round}`} live />
          <span className="spacer" />
          <Clock ms={round.remaining} variant="sm" label="Time left" role="timer" />
          <span className="eyebrow" style={{ fontSize: 11, color: "var(--navy-ink-2)" }}>
            Left
          </span>
        </>
      }
    >
      <section className="band live-band">
        <span className="band-slash hide-sm" style={{ right: -70, width: 200 }} aria-hidden="true" />
        <span className="band-slash thin" style={{ right: 170, opacity: 0.9 }} aria-hidden="true" />
        <div className="container stack" style={{ position: "relative", gap: 32 }}>
          <div className="row wrap hide-sm" style={{ alignItems: "flex-end", justifyContent: "space-between", gap: 32 }}>
            <div className="stack" style={{ gap: 14 }}>
              <div className="row wrap" style={{ gap: 12 }}>
                <Badge kind="live">Live</Badge>
                <span className="eyebrow" style={{ color: "var(--lime)" }}>
                  Round {round.round}
                </span>
                <span className="caption" style={{ fontSize: 14 }}>
                  {league.format} · {view.managers.length} managers · Free entry
                </span>
              </div>
              <h1 className="h-1 t-live">{league.name}</h1>
            </div>
            <div className="row" style={{ alignItems: "stretch", gap: 24, padding: "18px 24px", borderRadius: 16, background: "var(--navy-2)", boxShadow: "inset 0 0 0 1px var(--navy-line)" }}>
              <div className="stack" style={{ gap: 10 }}>
                <span className="cd-label" style={{ color: "var(--navy-ink-2)" }}>
                  Time left
                </span>
                <div className="row" style={{ alignItems: "flex-end", gap: 12 }}>
                  <Clock ms={round.remaining} variant="board" label="Time left" role="timer" />
                  <span className="fig-s hide-md" style={{ color: "var(--navy-ink-2)", textTransform: "uppercase", paddingBottom: 6 }}>
                    remaining
                  </span>
                </div>
              </div>
              <span style={{ width: 1, background: "var(--navy-line)" }} aria-hidden="true" />
              <div className="stack" style={{ gap: 10, justifyContent: "space-between", minWidth: 190 }}>
                <span className="cd-label" style={{ color: "var(--navy-ink-2)" }}>
                  Prize
                </span>
                <div className="row" style={{ gap: 12 }}>
                  <CoLogo id={league.prize.company} size="lg" style={{ boxShadow: "0 0 0 2px var(--gold-bg)" }} />
                  <div className="stack" style={{ gap: 2 }}>
                    <span style={{ fontWeight: 700, fontSize: 16, lineHeight: 1.2 }}>
                      ${league.prize.usd} in {prizeName}
                      <br />
                      PreStock
                    </span>
                    <span className="caption">Winner takes it</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="cols-4 live-stats" aria-label="Round status">
            {you ? (
              <div className="stat-box hero" style={{ padding: "16px 20px" }}>
                <span className="k">Your return</span>
                <span className="v stat-v">{pct(you.portfolioReturn)}</span>
                <span className="stat-note" style={{ color: "var(--lime-ink)" }}>
                  Squad average of 3 picks
                </span>
              </div>
            ) : (
              <div className="stat-box hero" style={{ padding: "16px 20px" }}>
                <span className="k">Leader</span>
                <span className="v stat-v">{leader ? pct(leader.portfolioReturn) : "—"}</span>
                <span className="stat-note" style={{ color: "var(--lime-ink)" }}>
                  {leader ? leader.name : "Waiting for prices"}
                </span>
              </div>
            )}
            <div className="stat-box" style={{ padding: "16px 20px" }}>
              <span className="k">{you ? "Your rank" : "Managers"}</span>
              <span className="row" style={{ alignItems: "baseline", gap: 8 }}>
                <span className="v stat-v">{you ? `#${you.rank}` : view.managers.length}</span>
                {you && (
                  <span className="fig-s hide-sm" style={{ color: "var(--navy-ink-2)" }}>
                    of {view.managers.length}
                  </span>
                )}
                {you && <span className="show-sm"><Move n={you.move} /></span>}
              </span>
              <span className="stat-note hide-sm row" style={{ gap: 6 }}>
                {you ? (
                  <>
                    <Move n={you.move} />
                    {you.move > 0 ? `Up ${you.move} since last update` : you.move < 0 ? `Down ${-you.move} since last update` : "No change since last update"}
                  </>
                ) : (
                  "Join the next round to play"
                )}
              </span>
            </div>
            <div className="stat-box hide-sm" style={{ padding: "16px 20px" }}>
              <span className="k">Average</span>
              <span className="v stat-v">{avg !== null ? pct(avg) : "—"}</span>
              <span className="stat-note">{view.managers.length ? `Across all ${view.managers.length} managers` : "No squads in this round"}</span>
            </div>
            <div className="stat-box" style={{ padding: "16px 20px" }}>
              <span className="k">Highest</span>
              <span className="v stat-v">{leader ? pct(leader.portfolioReturn) : "—"}</span>
              {leader && (
                <span className="stat-note hide-sm row" style={{ gap: 8 }}>
                  <Avatar initials={leader.initials} tone={leader.avatar} size="sm" />
                  {leader.you ? "That’s you" : leader.name}
                  {you && !leader.you ? ` · ${pctAbs(leader.portfolioReturn - you.portfolioReturn)} ahead of you` : ""}
                </span>
              )}
            </div>
          </div>
        </div>
      </section>

      <div className="live-main">
        <div className="container live-grid">
          <div className="live-col">
            <section className="card live-squad" style={{ overflow: "hidden" }} aria-labelledby="squad-h">
              <div className="card-head">
                <span id="squad-h">{you ? "Your squad" : leader ? `Leader · ${leader.name}` : "Squads"}</span>
                <span className="spacer" />
                <span style={{ fontFamily: "var(--f-ui)", fontSize: 13, fontWeight: 600, letterSpacing: 0, textTransform: "none", color: "var(--navy-ink-2)" }}>33.3% each</span>
              </div>
              {focus ? (
                <>
                  <div style={{ padding: "14px 14px 0" }}>
                    <button type="button" onClick={() => setBreakdown(true)} style={{ display: "block", width: "100%" }} aria-label="See squad breakdown">
                      <Pitch height={300} slots={focus.picks.map((id, i) => ({ id, value: focus.pickReturns[i] }))} colGap={60} rowGap={24} />
                    </button>
                  </div>
                  <div className="stack" style={{ padding: "20px 22px 22px", gap: 16 }}>
                    <div className="stack" style={{ gap: 6 }}>
                      <p className="title" style={{ fontSize: 18 }}>
                        {focus.you ? headline(focus) : `${focus.name} leads. Join the next round to take them on.`}
                      </p>
                      {you && leader && you.rank !== 1 && (
                        <span className="caption" style={{ fontSize: 13 }}>
                          {pctAbs(leader.portfolioReturn - you.portfolioReturn)} behind {leader.name} for first place
                        </span>
                      )}
                    </div>
                    <button type="button" className="btn btn-navy btn-block" onClick={() => setBreakdown(true)}>
                      See breakdown
                      <Icon name="chevronRight" size="sm" />
                    </button>
                    {!you && (
                      <Link className="btn btn-lime btn-block" href={`/league/${slug}`}>
                        Draft for the next round
                      </Link>
                    )}
                  </div>
                </>
              ) : (
                <WaitingForPrices kickoff={round.kickoff} />
              )}
            </section>

            <section className="card live-movers" style={{ overflow: "hidden" }} aria-labelledby="movers-h">
              <div className="card-head">
                <span id="movers-h">Market movers</span>
                <span className="spacer" />
                <span style={{ fontFamily: "var(--f-ui)", fontSize: 13, fontWeight: 600, letterSpacing: 0, textTransform: "none", color: "var(--navy-ink-2)" }}>This round</span>
              </div>
              {movers.length ? (
                <div className="stack">
                  {movers.map((m, i) => {
                    const c = COMPANY_BY_ID[m.id];
                    const mine = view.entry?.picks.includes(m.id);
                    return (
                      <button key={m.id} type="button" className={["mover", mine ? "mine" : ""].join(" ")} onClick={() => setCompany(m.id)} aria-label={`${i + 1}. ${c.name}, ${pct(m.r)} this round${mine ? ", your pick" : ""}. Open details`}>
                        <span className="score" style={{ fontSize: 22, color: "var(--ink-3)" }}>
                          {i + 1}
                        </span>
                        <CoLogo id={m.id} size="sm" />
                        <span className="stack" style={{ minWidth: 0, lineHeight: 1.2 }}>
                          <span className="row" style={{ gap: 8, fontWeight: 700, fontSize: 14.5 }}>
                            {c.name}
                            {mine && <span className="badge badge-joined pick-tag">Your pick</span>}
                          </span>
                          <span className="ticker">{c.symbol}</span>
                        </span>
                        <Delta value={m.r} className="fig-s" />
                      </button>
                    );
                  })}
                </div>
              ) : (
                <WaitingForPrices kickoff={round.kickoff} />
              )}
            </section>

          </div>
          <div className="live-col">
            <section className="card live-table" style={{ overflow: "hidden" }} aria-labelledby="lb-h">
              <div className="row wrap" style={{ gap: 14, padding: "18px 24px" }}>
                <div className="stack" style={{ gap: 4 }}>
                  <h2 className="h-3" id="lb-h">
                    League table
                  </h2>
                  <span className="caption" style={{ fontSize: 13 }}>
                    {view.managers.length} managers · ranked by return since kick-off
                  </span>
                </div>
                <span className="spacer" />
                <PriceSourcePill />
              </div>
              {view.stale && (
                <div className="banner banner-warn" style={{ margin: "0 16px 14px", fontSize: 13.5 }}>
                  <Icon name="warning" size="sm" />
                  Prices haven’t updated since {view.nowAt ? timeOfDay(view.nowAt) : "kick-off"}. If fresh prices don’t arrive by the final whistle, this round goes to review instead of being scored on old data.
                </div>
              )}
              {standings ? <LeagueTable rows={standings} mode="live" limit={10} /> : <WaitingForPrices kickoff={round.kickoff} />}
            </section>

            {leader && (
              <section className="card-night live-race" aria-labelledby="race-h" style={{ borderColor: "var(--gold-bg)", boxShadow: "0 6px 0 #B98A00" }}>
                <div className="row" style={{ gap: 14 }}>
                  <Achv icon="trophy" tone="gold" small />
                  <div className="stack" style={{ gap: 4 }}>
                    <span className="eyebrow" id="race-h" style={{ color: "var(--gold-bg)" }}>
                      Race for the prize
                    </span>
                    <span style={{ fontWeight: 700, fontSize: 15 }}>
                      ${league.prize.usd} in {prizeName} PreStock
                    </span>
                  </div>
                </div>
                <div className="race-cell">
                  <span className="cd-label" style={{ color: "var(--navy-ink-2)" }}>
                    Leader · {leader.you ? "You" : leader.name}
                  </span>
                  <Delta value={leader.portfolioReturn} className="fig-m" />
                </div>
                {you && (
                  <>
                    <div className="race-cell">
                      <span className="cd-label" style={{ color: "var(--navy-ink-2)" }}>
                        You
                      </span>
                      <Delta value={you.portfolioReturn} className="fig-m" />
                    </div>
                    <div className="race-cell">
                      <span className="cd-label" style={{ color: "var(--navy-ink-2)" }}>
                        Gap to first
                      </span>
                      <span className="fig-m" style={{ color: "#fff" }}>
                        {pctAbs(leader.portfolioReturn - you.portfolioReturn)}
                      </span>
                    </div>
                  </>
                )}
              </section>
            )}

            <Link className="card-flat row live-rules" href="/how-it-works#rules" style={{ gap: 12, minHeight: 56, padding: "0 20px", color: "var(--ink)", fontSize: 15, fontWeight: 700 }}>
              <Icon name="info" style={{ color: "var(--ink-3)" }} />
              <span style={{ flexGrow: 1 }}>League rules &amp; scoring</span>
              <Icon name="chevronRight" size="sm" style={{ color: "var(--ink-3)" }} />
            </Link>
          </div>
        </div>
      </div>

      {breakdown && focus && <SquadBreakdown view={view} s={focus} title={focus.you ? "Your squad" : `${focus.name}’s squad`} onClose={() => setBreakdown(false)} />}
      {company && <CompanySheet id={company} view={view} onClose={() => setCompany(null)} />}
    </Shell>
  );
}

const KICKOFF_WINDOW_MS = 3 * 60_000;

/** No kick-off prices yet: either they're about to land, or the window was missed. */
function WaitingForPrices({ kickoff }: { kickoff: number }) {
  const { now } = useGame();
  if (now - kickoff < KICKOFF_WINDOW_MS) {
    return (
      <div className="empty-state">
        <span className="spinner spinner-dark" aria-hidden="true" />
        <p className="title">Waiting for kick-off prices…</p>
        <p className="small muted">Starting prices come from the first PreStocks snapshots after kick-off. The table fills in within a minute.</p>
      </div>
    );
  }
  return (
    <div className="empty-state">
      <Icon name="warning" size="lg" style={{ color: "var(--ink-3)" }} />
      <p className="title">No kick-off prices for this round</p>
      <p className="small muted" style={{ maxWidth: 440 }}>
        Price collection wasn’t running in the first 3 minutes after kick-off, so this round can’t be scored fairly. It will go to review instead of using stale prices. The next round starts fresh.
      </p>
    </div>
  );
}

function Redirect({ to }: { to: string }) {
  const router = useRouter();
  useEffect(() => router.replace(to), [router, to]);
  return (
    <Shell>
      <PageSkeleton />
    </Shell>
  );
}

function PreMatch({ slug, joined, kickoffIn, kickoff, round }: { slug: string; joined: boolean; kickoffIn: number; kickoff: number; round: number }) {
  const league = LEAGUE_BY_SLUG[slug];
  return (
    <Shell>
      <section className="band band-pad">
        <span className="band-slash" style={{ right: -70, width: 200 }} aria-hidden="true" />
        <div className="container stack" style={{ position: "relative", gap: 20 }}>
          <div className="row wrap" style={{ gap: 12 }}>
            <Badge kind="soon">Pre-match</Badge>
            <span className="eyebrow" style={{ color: "var(--lime)" }}>
              Round {round} · kicks off {timeOfDay(kickoff)}
            </span>
          </div>
          <h1 className="h-1 t-page">{league.name}</h1>
          <div className="stack" style={{ gap: 10 }}>
            <span className="cd-label" style={{ color: "var(--navy-ink-2)" }}>
              Kick-off in
            </span>
            <Clock ms={kickoffIn} variant="lg" label="Kick-off in" role="timer" />
          </div>
          <p className="lead" style={{ color: "var(--navy-ink-2)", maxWidth: 560 }}>
            The live table opens at kick-off. {joined ? "Your squad is locked in." : "There’s still time to get a squad on the pitch."}
          </p>
          <div className="row wrap" style={{ gap: 12 }}>
            <Link className="btn btn-lime btn-lg" href={`/league/${slug}${joined ? "/locked" : "/draft"}`}>
              {joined ? "View my squad" : "Draft my squad"}
            </Link>
            <Link className="btn btn-ghost-night btn-lg" href={`/league/${slug}/results`}>
              Last round’s results
            </Link>
          </div>
        </div>
      </section>
    </Shell>
  );
}
