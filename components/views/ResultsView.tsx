"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { COMPANY_BY_ID } from "@/lib/companies";
import { LEAGUE_BY_SLUG, joinableRound } from "@/lib/leagues";
import { pct, pctAbs, timeOfDay, usd } from "@/lib/format";
import { EARLY_BIRD_MS, levelFor, roundXp } from "@/lib/standings";
import { shareText } from "@/lib/share";
import { useRound } from "@/lib/hooks/useRound";
import { useHistory } from "@/lib/hooks/useHistory";
import { usePlayer } from "@/lib/hooks/usePlayer";
import { useGame } from "@/components/providers/GameProvider";
import { usePrices } from "@/components/providers/PriceProvider";
import { SquadBreakdown } from "@/components/league/SquadBreakdown";
import { PageSkeleton, Shell } from "@/components/shell/Shell";
import { Achv, Avatar, Badge, CoLogo, Delta, Medal } from "@/components/ui/bits";
import { Icon } from "@/components/ui/Icon";
import { LeagueTable } from "@/components/ui/LeagueTable";
import { Pitch } from "@/components/ui/Pitch";

const ORDINAL = ["first", "second", "third"];

export function ResultsView({ slug, kickoff }: { slug: string; kickoff?: number }) {
  const league = LEAGUE_BY_SLUG[slug];
  const { ready, now, claims } = useGame();
  const { simulated } = usePrices();
  const player = usePlayer();
  const you = useMemo(() => ({ name: player.displayName, initials: player.initials }), [player.displayName, player.initials]);
  const view = useRound(league, kickoff ?? "last-final", { youName: you.name, youInitials: you.initials });
  const history = useHistory(you);
  const [breakdown, setBreakdown] = useState(false);

  if (!ready || !view || !history) {
    return (
      <Shell>
        <PageSkeleton height={480} />
      </Shell>
    );
  }

  const { round, standings } = view;
  const next = joinableRound(league, now);

  if (round.phase !== "final") {
    return (
      <Shell>
        <Notice
          eyebrow={`${league.name} · Round ${round.round}`}
          title="Still in play"
          body="Results land at the final whistle. The live table updates as prices move."
          cta={{ href: `/league/${slug}/live`, label: "Watch live" }}
        />
      </Shell>
    );
  }

  if (!standings) {
    return (
      <Shell>
        <Notice
          eyebrow={`${league.name} · Round ${round.round} · Ended ${timeOfDay(round.endsAt)}`}
          title={view.unscoreable ? "Under review" : "No result on record"}
          body={
            view.unscoreable
              ? "We don’t have valid final prices for every company in this round, so it can’t be scored. Rounds without fresh prices at kick-off or the final whistle are reviewed or voided — never scored on stale prices."
              : "This round wasn’t tracked on this device, so there’s no final table to show."
          }
          cta={next ? { href: `/league/${slug}`, label: `Join Round ${next.round}` } : { href: "/leagues", label: "Browse leagues" }}
        />
      </Shell>
    );
  }

  const winner = standings[0];
  const me = view.you;
  const podium = standings.slice(0, 3);
  const prizeName = COMPANY_BY_ID[league.prize.company].name;
  const earlyBird = view.entry ? view.entry.lockedAt <= round.kickoff - EARLY_BIRD_MS : false;
  const rewards = me ? roundXp(me.rank, earlyBird) : null;
  const level = levelFor(history.xp);
  const topPct = me ? Math.max(1, Math.round((me.rank / standings.length) * 100)) : null;
  const claim = claims[view.key];

  const lead = me
    ? me.rank === 1
      ? `You win with ${pct(me.portfolioReturn)}. The prize is yours to claim.`
      : me.rank <= 3
        ? `${winner.name} wins with ${pct(winner.portfolioReturn)}. You made the podium in ${ORDINAL[me.rank - 1]}.`
        : `${winner.name} wins with ${pct(winner.portfolioReturn)}. You finished #${me.rank} of ${standings.length}.`
    : `${winner.name} wins with ${pct(winner.portfolioReturn)}.`;

  const share = () =>
    shareText(
      me ? `I finished #${me.rank} in the ${league.name} with ${pct(me.portfolioReturn)}. Think you can beat me?` : `${winner.name} won the ${league.name} with ${pct(winner.portfolioReturn)}.`,
      `/league/${slug}`,
    );

  return (
    <Shell>
      <section className="band" style={{ paddingTop: 48 }}>
        <span className="band-slash hide-sm" style={{ right: -70, width: 200 }} aria-hidden="true" />
        <span className="band-slash thin" style={{ right: 170, opacity: 0.9 }} aria-hidden="true" />
        <div className="container split" style={{ position: "relative", "--side": "500px", "--gap": "48px", "--align": "end" } as React.CSSProperties}>
          <div className="stack results-intro" style={{ gap: 20 }}>
            <div className="row wrap" style={{ gap: 12 }}>
              <span className="badge badge-joined">
                <Icon name="check" style={{ width: 14, height: 14 }} strokeWidth={3} />
                Final
              </span>
              <span className="caption" style={{ fontSize: 14 }}>
                {league.name} · Round {round.round} · Ended {timeOfDay(round.endsAt)}
                {simulated ? " · simulated prices" : ""}
              </span>
            </div>
            <h1 className="h-hero t-hero-sm">
              Final <span className="hl">whistle</span>
            </h1>
            <p className="lead" style={{ color: "var(--navy-ink-2)", maxWidth: 520 }}>
              {lead}
            </p>
            <div className="row wrap" style={{ gap: 12 }}>
              <CoLogo id={league.prize.company} style={{ boxShadow: "0 0 0 2px var(--gold-bg)" }} />
              <span style={{ fontWeight: 700 }}>
                ${league.prize.usd} in {prizeName} PreStock
              </span>
              <span className="caption" style={{ fontSize: 14 }}>
                goes to {winner.you ? "you" : winner.name}
              </span>
            </div>
          </div>

          <div className="podium" aria-label="Podium">
            {[1, 0, 2].map((i) => {
              const p = podium[i];
              if (!p) return <div key={i} />;
              const h = [200, 150, 118][i];
              return (
                <div key={p.id} className="stack" style={{ gap: 12 }}>
                  <div className="stack" style={{ alignItems: "center", gap: 4, textAlign: "center" }}>
                    {i === 0 && <Achv icon="trophy" tone="gold" small className="podium-trophy" />}
                    <Avatar initials={p.initials} tone={p.avatar} size="lg" style={{ boxShadow: i === 0 ? "0 0 0 3px var(--gold-bg)" : p.you ? "0 0 0 3px #fff" : undefined }} />
                    <span className="row" style={{ fontWeight: 700, fontSize: 16, paddingTop: 4, gap: 6 }}>
                      <span className="podium-name">{p.name}</span>
                      {p.you && <span className="you-tag">You</span>}
                    </span>
                    <Delta value={p.portfolioReturn} style={{ fontSize: 15 }} />
                  </div>
                  <div className={`podium-${i + 1} podium-block`} style={{ height: h }}>
                    <span className="score" style={{ fontSize: [88, 72, 64][i] }} aria-label={`${ORDINAL[i]} place`}>
                      {i + 1}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section style={{ paddingTop: 48 }}>
        <div className="container cols-3" style={{ gap: 24, alignItems: "stretch" }}>
          <article className="card stack" style={{ overflow: "hidden" }} aria-labelledby="winsquad-h">
            <div className="card-head">
              <span id="winsquad-h">Winner’s squad</span>
              <span className="spacer" />
              <span className="row" style={{ gap: 8, fontFamily: "var(--f-ui)", fontSize: 14, fontWeight: 700, letterSpacing: 0, textTransform: "none" }}>
                <Avatar initials={winner.initials} tone={winner.avatar} size="sm" />
                {winner.you ? "You" : winner.name}
              </span>
            </div>
            <div style={{ padding: "14px 14px 0" }}>
              <Pitch height={300} slots={winner.picks.map((id, i) => ({ id, value: winner.pickReturns[i] }))} colGap={50} rowGap={24} />
            </div>
            <div className="stack" style={{ padding: "18px 20px 20px", gap: 14, flexGrow: 1 }}>
              <div className="row" style={{ gap: 12 }}>
                <Achv icon="chart" tone="blue" small />
                <div className="stack" style={{ gap: 2, flexGrow: 1 }}>
                  <span className="title" style={{ fontSize: 16 }}>
                    Squad of the round
                  </span>
                  <span className="caption">{winner.picks.map((p) => COMPANY_BY_ID[p].name).join(" · ")}</span>
                </div>
                <Delta value={winner.portfolioReturn} className="fig-m" />
              </div>
              <div className="row" style={{ gap: 10, paddingTop: 14, borderTop: "1px solid var(--line)", marginTop: "auto" }}>
                <CoLogo id={league.prize.company} size="sm" />
                <span style={{ fontSize: 14, fontWeight: 700 }}>
                  Won ${league.prize.usd} in {prizeName} PreStock
                </span>
              </div>
            </div>
          </article>

          <article className="card stack" style={{ overflow: "hidden" }} aria-labelledby="your-result">
            <div className="card-head">
              <span>Your result</span>
              <span className="spacer" />
              {me && me.rank <= 3 && <Medal rank={me.rank} />}
            </div>
            {me ? (
              <div className="stack" style={{ padding: 22, gap: 16, flexGrow: 1 }}>
                <div className="stack" style={{ gap: 10 }}>
                  <h2 className="h-2" id="your-result">
                    You finished <span className="hl">#{me.rank}</span>
                  </h2>
                  <div className="row" style={{ alignItems: "baseline", gap: 10 }}>
                    <Delta value={me.portfolioReturn} className="fig-l" />
                    <span className="caption">Final return</span>
                  </div>
                  <p className="small muted">
                    Top {topPct}%{me.rank > 1 ? ` · ${pctAbs(winner.portfolioReturn - me.portfolioReturn)} behind ${winner.name}` : " · best in the league"}
                  </p>
                </div>
                <div className="stack" style={{ borderTop: "1px solid var(--line)" }}>
                  {me.picks.map((id, i) => (
                    <div key={id} className="row" style={{ gap: 12, minHeight: 48, borderTop: i ? "1px solid var(--line)" : 0 }}>
                      <CoLogo id={id} size="sm" />
                      <div className="stack" style={{ flexGrow: 1, lineHeight: 1.2 }}>
                        <span style={{ fontSize: 15, fontWeight: 700 }}>{COMPANY_BY_ID[id].name}</span>
                        <span className="ticker">{COMPANY_BY_ID[id].symbol}</span>
                      </div>
                      <Delta value={me.pickReturns[i]} className="fig-s" />
                    </div>
                  ))}
                </div>
                <button type="button" className="card-sunken num" onClick={() => setBreakdown(true)} style={{ marginTop: "auto", padding: "10px 14px", borderRadius: 10, fontSize: 14, fontWeight: 700, color: "var(--ink-2)", textAlign: "left" }}>
                  ({me.pickReturns.map((r) => pct(r).replace("%", "")).join(" + ")}) ÷ 3 = {pct(me.portfolioReturn)}
                </button>
              </div>
            ) : (
              <div className="empty-state" style={{ flexGrow: 1, justifyContent: "center" }}>
                <p className="title" id="your-result">
                  You weren’t in this round
                </p>
                <p className="small muted">Draft a squad for the next one and see your name on this table.</p>
                {next && (
                  <Link className="btn btn-navy" href={`/league/${slug}`}>
                    Join Round {next.round}
                  </Link>
                )}
              </div>
            )}
          </article>

          <article className="card-night stack" style={{ padding: 24, gap: 20 }} aria-labelledby="rewards-h">
            <div className="row" style={{ alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
              <div className="stack" style={{ gap: 8 }}>
                <span className="eyebrow" id="rewards-h">
                  Round rewards
                </span>
                <span className="score pop" style={{ fontSize: 60, color: "var(--lime)" }}>
                  +{rewards?.total ?? 0} XP
                </span>
              </div>
              <Badge kind="xp">Level {level.level}</Badge>
            </div>
            <div className="stack" style={{ gap: 8 }}>
              <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline", fontSize: 14 }}>
                <span style={{ fontWeight: 700 }}>{level.title}</span>
                <span className="num" style={{ color: "var(--navy-ink-2)", fontWeight: 600 }}>
                  {history.xp.toLocaleString()}
                  {level.next ? ` / ${level.next.toLocaleString()} XP` : " XP"}
                </span>
              </div>
              <div className="xp" role="progressbar" aria-label={`Level ${level.level} progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(level.progress * 100)}>
                <span style={{ width: `${Math.max(2, level.progress * 100)}%` }} />
              </div>
              {level.next && <span className="caption">{(level.next - history.xp).toLocaleString()} XP to Level {level.level + 1}</span>}
            </div>
            {rewards && rewards.parts.length > 1 && (
              <div className="row" style={{ gap: 14, padding: 14, borderRadius: 12, background: "var(--navy-2)", boxShadow: "inset 0 0 0 1px var(--navy-line)" }}>
                <Achv icon={me!.rank === 1 ? "trophy" : me!.rank <= 3 ? "chart" : "clock"} tone={me!.rank <= 3 ? "gold" : "blue"} className="pop" />
                <div className="stack" style={{ gap: 3 }}>
                  <span className="eyebrow" style={{ color: "var(--gold-bg)" }}>
                    Achievement earned
                  </span>
                  <span className="h-3" style={{ fontSize: 24 }}>
                    {rewards.parts[rewards.parts.length - 1].label}
                  </span>
                  <span className="caption">{rewards.parts.map((p) => `${p.label} +${p.xp}`).join(" · ")}</span>
                </div>
              </div>
            )}
            <div className="stack" style={{ gap: 10, marginTop: "auto" }}>
              {me?.rank === 1 ? (
                <Link className="btn btn-lime btn-lg btn-block" href={`/league/${slug}/claim?round=${round.kickoff}`}>
                  <Icon name="gift" />
                  {claim?.status === "done" ? "Prize claimed" : "Claim prize"}
                </Link>
              ) : (
                <Link className="btn btn-lime btn-lg btn-block" href={next ? `/league/${slug}` : "/leagues"}>
                  Join next league
                </Link>
              )}
              <button className="btn btn-ghost-night btn-block" type="button" onClick={share}>
                <Icon name="share" size="sm" />
                Share result
              </button>
            </div>
          </article>
        </div>
      </section>

      <section style={{ padding: "48px 0 0" }}>
        <div className="container">
          <div className="card" style={{ overflow: "hidden" }}>
            <div className="row" style={{ gap: 14, padding: "18px 24px" }}>
              <div className="stack" style={{ gap: 4 }}>
                <h2 className="h-3">Final table</h2>
                <span className="caption" style={{ fontSize: 13 }}>
                  {standings.length} managers · final returns
                </span>
              </div>
              <span className="spacer" />
              <Badge kind="done">Final</Badge>
            </div>
            <LeagueTable rows={standings} mode="final" />
          </div>
        </div>
      </section>

      <section style={{ padding: "48px 0 80px" }} id="scoring">
        <div className="container split-left" style={{ "--side": "340px", "--gap": "48px" } as React.CSSProperties}>
          <div className="stack" style={{ gap: 14 }}>
            <span className="eyebrow">Transparent scoring</span>
            <h2 className="h-2 t-h2">How this round was scored</h2>
            <p className="body">
              Kick-off and final-whistle prices are PreStocks token prices, averaged over the first and last snapshots of the round. Every squad’s score is the plain average of its three picks.
            </p>
            {view.boundary.startLate && <p className="caption">Kick-off prices were captured at {timeOfDay(view.boundary.startAt!)} (round opened late on this device).</p>}
          </div>
          <div className="card" style={{ overflow: "hidden" }}>
            <div className="bd-row bd-head scoring-grid">
              <span>Company</span>
              <span style={{ textAlign: "right" }}>Kick-off</span>
              <span style={{ textAlign: "right" }}>Final</span>
              <span style={{ textAlign: "right" }}>Return</span>
            </div>
            {[...league.pool]
              .sort((a, b) => (view.returns![b] ?? 0) - (view.returns![a] ?? 0))
              .map((id, i) => {
                const c = COMPANY_BY_ID[id];
                return (
                  <div key={id} className="bd-row scoring-grid" style={{ padding: "12px 18px", borderTop: i ? "1px solid var(--line)" : 0 }}>
                    <span className="row" style={{ gap: 10, fontWeight: 700, minWidth: 0 }}>
                      <CoLogo id={id} size="sm" className="hide-sm" />
                      {c.name}
                    </span>
                    <span className="num small faint" style={{ textAlign: "right" }}>
                      {usd(view.boundary.start![c.symbol])}
                    </span>
                    <span className="num small" style={{ textAlign: "right", fontWeight: 700 }}>
                      {usd(view.boundary.end![c.symbol])}
                    </span>
                    <span style={{ textAlign: "right" }}>
                      <Delta value={view.returns![id]} />
                    </span>
                  </div>
                );
              })}
          </div>
        </div>
      </section>

      {breakdown && me && <SquadBreakdown view={view} s={me} title="Your squad" onClose={() => setBreakdown(false)} />}
    </Shell>
  );
}

function Notice({ eyebrow, title, body, cta }: { eyebrow: string; title: string; body: string; cta: { href: string; label: string } }) {
  return (
    <section className="band band-pad">
      <span className="band-slash" style={{ right: -70, width: 200 }} aria-hidden="true" />
      <div className="container stack" style={{ position: "relative", gap: 18, maxWidth: 760 }}>
        <span className="eyebrow" style={{ color: "var(--lime)" }}>
          {eyebrow}
        </span>
        <h1 className="h-1 t-page">{title}</h1>
        <p className="lead" style={{ color: "var(--navy-ink-2)" }}>
          {body}
        </p>
        <Link className="btn btn-lime btn-lg" href={cta.href} style={{ alignSelf: "flex-start" }}>
          {cta.label}
        </Link>
      </div>
    </section>
  );
}
