"use client";

import Link from "next/link";
import { useState } from "react";
import { LEAGUE_BY_SLUG, type League } from "@/lib/leagues";
import { dateLabel } from "@/lib/format";
import { toRoundState, useRound } from "@/lib/hooks/useRound";
import { useLeagues } from "@/lib/hooks/useLeagues";
import { useHistory, type HistoryItem } from "@/lib/hooks/useHistory";
import { usePlayer } from "@/lib/hooks/usePlayer";
import { useGame } from "@/components/providers/GameProvider";
import { PageSkeleton, Shell } from "@/components/shell/Shell";
import { LeagueFacts } from "@/components/league/LeagueFacts";
import { LevelCard } from "@/components/league/LevelCard";
import { Achv, Avatar, Badge, Delta, Medal, PrizeLine } from "@/components/ui/bits";
import { Icon } from "@/components/ui/Icon";
import { LeagueTable } from "@/components/ui/LeagueTable";

type Tab = "live" | "upcoming" | "completed";

function dayLabel(ts: number, now: number) {
  const d = new Date(ts);
  if (d.toDateString() === new Date(now).toDateString()) return "Today";
  if (d.toDateString() === new Date(now + 86400000).toDateString()) return "Tomorrow";
  return d.toLocaleDateString("en-US", { weekday: "long" });
}

export function LeaguesView() {
  const { ready, now } = useGame();
  const player = usePlayer();
  const history = useHistory();
  const series = useLeagues();
  const [tab, setTab] = useState<Tab>("upcoming");

  if (!ready || !history || !series) {
    return (
      <Shell>
        <PageSkeleton height={312} />
      </Shell>
    );
  }

  const live = series.filter((x) => x.live && LEAGUE_BY_SLUG[x.slug]).map((x) => ({ league: LEAGUE_BY_SLUG[x.slug], id: x.live!.id }));
  const upcoming = series
    .filter((x) => x.next && LEAGUE_BY_SLUG[x.slug])
    .map((x) => ({ league: LEAGUE_BY_SLUG[x.slug], round: toRoundState(x.next!, now), managers: x.next!.managers, joined: x.next!.joined }))
    .sort((a, b) => a.round.kickoff - b.round.kickoff);
  // Your finished rounds.
  const completed = history.items;

  const groups: { label: string; rows: typeof upcoming }[] = [];
  for (const u of upcoming) {
    const label = dayLabel(u.round.kickoff, now);
    const g = groups.find((x) => x.label === label);
    if (g) g.rows.push(u);
    else groups.push({ label, rows: [u] });
  }

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: "live", label: "Live", count: live.length },
    { id: "upcoming", label: "Upcoming", count: upcoming.length },
    { id: "completed", label: "Completed", count: completed.length },
  ];

  return (
    <Shell>
      <section className="band band-pad">
        <span className="band-slash" style={{ right: -70, width: 200 }} aria-hidden="true" />
        <span className="band-slash thin" style={{ right: 170, opacity: 0.9 }} aria-hidden="true" />
        <div className="container split" style={{ position: "relative", "--side": "420px", "--gap": "56px" } as React.CSSProperties}>
          <div className="stack" style={{ gap: 16 }}>
            <span className="eyebrow" style={{ color: "var(--lime)", fontSize: 16 }}>
              Free to enter
            </span>
            <h1 className="h-1 t-page">Leagues</h1>
            <p className="lead" style={{ color: "var(--navy-ink-2)", maxWidth: 560 }}>
              Draft three private companies, beat the room, win real PreStocks.
            </p>
          </div>
          <LevelCard name={player.displayName} initials={player.initials} xp={history.xp} level={history.level} />
        </div>
      </section>

      <section className="overlap" style={{ paddingBottom: 72 }}>
        <div className="container stack" style={{ gap: 28 }}>
          <div className="card row wrap" style={{ minHeight: 76, padding: "12px 18px 12px 14px", gap: 16 }}>
            <div className="seg" role="group" aria-label="Filter leagues by status">
              {tabs.map((t) => (
                <button key={t.id} type="button" className={["seg-item", tab === t.id ? "on" : ""].join(" ")} aria-pressed={tab === t.id} onClick={() => setTab(t.id)}>
                  {t.id === "live" && <span className="live-dot" />}
                  {t.label}
                  <span className="seg-count">{t.count}</span>
                </button>
              ))}
            </div>
            <span className="spacer" />
            <span className="small muted row hide-sm" style={{ gap: 8 }}>
              <Icon name="info" size="sm" />
              Squads are virtual — you never buy what you draft.
            </span>
          </div>

          {tab === "upcoming" &&
            groups.map((g) => (
              <div key={g.label} className="stack" style={{ gap: 12 }}>
                <span className="eyebrow">{g.label}</span>
                {g.rows.map(({ league, round, managers, joined }) => (
                  <LeagueFacts
                    key={league.slug}
                    league={league}
                    round={round}
                    managers={managers}
                    joined={joined}
                    variant="list"
                    highlight={league.featured && league.slug !== "stocklana-sprint" ? "navy" : undefined}
                  />
                ))}
              </div>
            ))}

          {tab === "live" && (
            <div className="stack" style={{ gap: 12 }}>
              <span className="eyebrow">In play now</span>
              {live.length === 0 && <EmptyCard title="Nothing in play right now" body="The next round kicks off soon — draft your squad from Upcoming." />}
              {live.map(({ league, id }) => (
                <LiveLeagueCard key={id} league={league} id={id} />
              ))}
            </div>
          )}

          {tab === "completed" && (
            <div className="stack" style={{ gap: 12 }}>
              <span className="eyebrow">Final whistle</span>
              {completed.length === 0 && <EmptyCard title="No finished rounds yet" body="Your results land here after the final whistle." />}
              {completed.map((item) => (
                <CompletedCard key={item.leagueId} item={item} />
              ))}
            </div>
          )}
        </div>
      </section>
    </Shell>
  );
}

function EmptyCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="card empty-state">
      <Icon name="clock" size="lg" style={{ color: "var(--ink-3)" }} />
      <p className="title">{title}</p>
      <p className="small muted">{body}</p>
    </div>
  );
}

function LiveLeagueCard({ league, id }: { league: League; id: string }) {
  const { view } = useRound(league, id);
  if (!view) return null;
  return (
    <article className="card" style={{ overflow: "hidden" }}>
      <div style={{ borderBottom: "1px solid var(--line)" }}>
        <LeagueFacts league={league} round={view.round} managers={view.managers.length} joined={Boolean(view.entry)} variant="list" bare />
      </div>
      {view.standings ? (
        <LeagueTable rows={view.standings} mode="final" compact limit={3} expandable={false} />
      ) : (
        <div className="caption" style={{ padding: "16px 20px" }}>
          Waiting for the first prices of the round…
        </div>
      )}
      {!view.entry && (
        <div className="caption row" style={{ gap: 8, minHeight: 52, padding: "0 20px", borderTop: "1px solid var(--line)", background: "#F8F9FC" }}>
          <Icon name="info" size="sm" />
          You’re not in this round. Join an upcoming league to get a squad on the pitch.
        </div>
      )}
    </article>
  );
}

function CompletedCard({ item }: { item: HistoryItem }) {
  const { league, winner } = item;
  const won = item.rank === 1;
  const review = item.status !== "completed";
  return (
    <article
      className="card facts"
      style={{ "--cols": "minmax(0, 1.3fr) minmax(0, 1fr) 170px minmax(0, 1fr) 220px", borderColor: won ? "var(--gold-bg)" : undefined } as React.CSSProperties}
    >
      <div className="fact head">
        <div className="row" style={{ gap: 8 }}>
          {won ? <Badge kind="won">You won</Badge> : review ? <Badge kind="warn">{item.status === "cancelled" ? "Cancelled" : "Under review"}</Badge> : <Badge kind="done">Completed</Badge>}
          <span className="caption">
            {league.format} · {dateLabel(item.startsAt)}
          </span>
        </div>
        <h2 className="h-3" style={{ fontSize: 30 }}>
          {league.name} · R{item.round}
        </h2>
        {won && (
          <span className="caption row" style={{ gap: 8 }}>
            <Achv icon="trophy" tone="gold" small />
            Round winner badge earned
          </span>
        )}
      </div>
      <div className="fact" style={{ flexDirection: "row", alignItems: "center", gap: 12, background: won ? "var(--gold-tint)" : undefined }}>
        {winner ? (
          <>
            <Medal rank={1} size={36} />
            <Avatar initials={winner.initials} tone={winner.avatar} size="lg" />
            <div className="stack" style={{ gap: 2, minWidth: 0 }}>
              <span className="eyebrow" style={won ? { color: "var(--gold)" } : undefined}>
                Winner
              </span>
              <span className="title row" style={{ gap: 8 }}>
                {winner.name}
                {winner.you && <span className="you-tag">You</span>}
              </span>
            </div>
          </>
        ) : (
          <span className="small muted">{review ? "No result — prices were missing at a scoring boundary." : "No winner"}</span>
        )}
      </div>
      <div className="fact" style={{ justifyContent: "center", gap: 6 }}>
        <span className="cd-label">Your return</span>
        {item.score !== null ? <Delta value={item.score} className="fig-m" /> : <span className="fig-m">—</span>}
        {item.rank && (
          <span className="caption">
            Finished #{item.rank} of {item.managers}
          </span>
        )}
      </div>
      <div className="fact" style={{ justifyContent: "center" }}>
        <span className="cd-label">{won ? "Prize won" : "Prize"}</span>
        <PrizeLine company={item.prize.company} usd={item.prize.usd} />
      </div>
      <div className="fact cta">
        <Link className={`btn ${won && item.claim !== "sent" ? "btn-lime" : "btn-secondary"} btn-block`} href={`/league/${league.slug}/${won && item.claim !== "sent" ? "claim" : "results"}?round=${item.leagueId}`}>
          {won ? (item.claim === "sent" ? "View results" : "Claim prize") : "View results"}
        </Link>
      </div>
    </article>
  );
}
