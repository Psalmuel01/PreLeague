"use client";

import Link from "next/link";
import { COMPANIES, type CompanyId } from "@/lib/companies";
import { DEFAULT_LEAGUE } from "@/lib/leagues";
import { toRoundState, useRound } from "@/lib/hooks/useRound";
import { useLeagues } from "@/lib/hooks/useLeagues";
import { useGame } from "@/components/providers/GameProvider";
import { PageSkeleton, Shell } from "@/components/shell/Shell";
import { LeagueFacts } from "@/components/league/LeagueFacts";
import { PriceSourcePill } from "@/components/league/PriceSourcePill";
import { Badge, CoLogo } from "@/components/ui/bits";
import { Icon } from "@/components/ui/Icon";
import { LeagueTable } from "@/components/ui/LeagueTable";
import { Pitch, type Slot } from "@/components/ui/Pitch";

const EXAMPLE: CompanyId[] = ["openai", "anthropic", "spacex"];

export function HomeView() {
  const league = DEFAULT_LEAGUE;
  const { ready, now } = useGame();
  const { view: current } = useRound(league, "current");
  const { view: last } = useRound(league, "last");
  const series = useLeagues()?.find((x) => x.slug === league.slug);

  if (!ready || !current) {
    return (
      <Shell>
        <PageSkeleton height={600} />
      </Shell>
    );
  }

  const { round } = current;
  const live = round.phase === "live";
  // The table shows the live round, or the last final table between rounds.
  const table = live && current.standings ? current : last?.standings ? last : null;

  let squad: { title: string; slots: Slot[] };
  if (current.entry) {
    squad = {
      title: `Your squad · ${league.name}`,
      slots: current.entry.picks.map((id) => ({ id, value: current.returns?.[id] ?? "33.3%" })),
    };
  } else if (live && current.standings?.[0]) {
    const leader = current.standings[0];
    squad = {
      title: `Leader · ${leader.name}`,
      slots: leader.picks.map((id, i) => ({ id, value: leader.pickReturns[i] })),
    };
  } else {
    squad = { title: "Example squad", slots: EXAMPLE.map((id) => ({ id, value: "33.3%" })) };
  }

  // The card offers the next open round unless you're already playing the live one.
  const next = series?.next;
  const card =
    (live && current.entry) || !next
      ? { round, managers: current.managers.length, joined: Boolean(current.entry) }
      : { round: toRoundState(next, now), managers: next.managers, joined: next.joined };

  return (
    <Shell>
      <section className="band band-pad" style={{ paddingBottom: 110 }}>
        <span className="band-slash hide-sm" style={{ right: -60, width: 220 }} aria-hidden="true" />
        <span className="band-slash thin" style={{ right: 200, opacity: 0.9 }} aria-hidden="true" />
        <div className="container split" style={{ position: "relative", "--side": "520px", "--gap": "56px", "--align": "center" } as React.CSSProperties}>
          <div className="stack" style={{ gap: 24 }}>
            <div className="row wrap" style={{ gap: 10 }}>
              {live ? <Badge kind="live">Round {round.round} live</Badge> : <Badge kind="soon">Round {round.round} · drafting</Badge>}
              <span className="eyebrow hide-sm" style={{ color: "var(--lime)", fontSize: 16 }}>
                Fantasy sports for private companies
              </span>
            </div>
            <h1 className="h-hero t-hero">
              Draft tomorrow’s <span className="hl">winners.</span>
            </h1>
            <p className="lead" style={{ maxWidth: 520, color: "var(--navy-ink-2)" }}>
              Pick a squad of three private companies, score on their real market moves, and win actual PreStocks.
            </p>
            <div className="row wrap" style={{ gap: 12, paddingTop: 6 }}>
              <Link className="btn btn-lime btn-lg" href={live && current.entry ? `/league/${league.slug}/live` : `/league/${league.slug}`}>
                {live && current.entry ? "Watch your squad" : "Join live league"}
              </Link>
              <Link className="btn btn-ghost-night btn-lg hide-sm" href="/how-it-works">
                How it works
              </Link>
            </div>
          </div>
          <Pitch
            className="hide-md"
            height={440}
            slots={squad.slots}
            tag={<span className="badge">{squad.title}</span>}
            padTop={36}
            rowGap={30}
          />
        </div>
      </section>

      <section className="overlap">
        <div className="container">
          <LeagueFacts league={league} round={card.round} managers={card.managers} joined={card.joined} variant="home" />
        </div>
      </section>

      <section className="show-md" style={{ paddingTop: 28 }}>
        <div className="container stack" style={{ gap: 12 }}>
          <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline" }}>
            <h2 className="h-3">{current.entry ? "Your squad" : "Pick your squad"}</h2>
            <Link href="/how-it-works" className="link-row" style={{ minHeight: 44, fontSize: 14 }}>
              How it works
              <Icon name="chevronRight" size="sm" />
            </Link>
          </div>
          <Pitch height={240} mini slots={squad.slots} colGap={80} />
          <p className="small muted">Three picks, equal weight. Your score is their average return.</p>
        </div>
      </section>

      <section style={{ padding: "64px 0 24px" }}>
        <div className="container row pool-row" style={{ gap: 28 }}>
          <span className="eyebrow" style={{ flexShrink: 0 }}>
            In the draft pool
          </span>
          <div className="pool-strip">
            {COMPANIES.map((c) => (
              <div key={c.id} className="card-flat pool-chip">
                <CoLogo id={c.id} size="sm" />
                {c.name}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={{ padding: "56px 0 72px" }}>
        <div className="container stack" style={{ gap: 32 }}>
          <div className="row wrap" style={{ alignItems: "flex-end", justifyContent: "space-between", gap: 16 }}>
            <h2 className="h-1 t-section">
              Three picks. One round. <span className="hl">Real</span> results.
            </h2>
            <Link href="/how-it-works" className="link-row hide-sm">
              How scoring works
              <Icon name="chevronRight" size="sm" />
            </Link>
          </div>
          <ol className="cols-3">
            {[
              ["Draft your squad", "Pick three private companies you think will outperform. Every pick counts equally."],
              ["Score on real moves", "Your squad scores with real PreStock prices. You never buy what you draft."],
              ["Top the table, win", "Highest return at the final whistle wins a real PreStock prize, sent to your wallet."],
            ].map(([title, body], i) => (
              <li key={title} className="card step-card">
                <span className="score step-num">{i + 1}</span>
                <div className="stack" style={{ gap: 8 }}>
                  <h3 className="h-3">{title}</h3>
                  <p className="body">{body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section style={{ padding: "0 0 88px" }}>
        <div className="container split-left" style={{ "--side": "340px", "--gap": "48px" } as React.CSSProperties}>
          <div className="stack" style={{ gap: 18, paddingTop: 8 }}>
            {live ? <Badge kind="live" style={{ alignSelf: "flex-start" }}>Live table</Badge> : <Badge kind="done" style={{ alignSelf: "flex-start" }}>Last round</Badge>}
            <h2 className="h-2 t-h2">Every point is a real market move.</h2>
            <p className="body">Your score is the average return of your three picks. The table updates as prices move.</p>
            <PriceSourcePill />
            <Link className="btn btn-secondary" href={`/league/${league.slug}/${live ? "live" : "results"}`} style={{ alignSelf: "flex-start" }}>
              {live ? "Open live table" : "See last results"}
            </Link>
          </div>
          <div className="card" style={{ overflow: "hidden" }}>
            {table?.standings ? (
              <LeagueTable rows={table.standings} mode={live ? "live" : "final"} limit={5} expandable={false} cols="84px minmax(0, 1.1fr) minmax(0, 1.4fr) 140px" />
            ) : (
              <div className="empty-state">
                <Icon name="clock" size="lg" style={{ color: "var(--ink-3)" }} />
                <p className="title">No finished round on record yet</p>
                <p className="small muted">
                  The table fills once Round {card.round.round} kicks off and prices start moving.
                </p>
              </div>
            )}
          </div>
        </div>
      </section>
    </Shell>
  );
}
