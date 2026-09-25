"use client";

import Link from "next/link";
import type { League, RoundState } from "@/lib/leagues";
import { opponentsFor } from "@/lib/leagues";
import { kickoffLabel } from "@/lib/format";
import { useGame } from "@/components/providers/GameProvider";
import { Badge, Clock, LogoStack, PrizeLine, Progress } from "@/components/ui/bits";
import { Icon } from "@/components/ui/Icon";

export function managerCount(league: League, joined: boolean) {
  const count = league.fullOverride ? league.capacity : Math.min(league.capacity, opponentsFor(league).length + (joined ? 1 : 0));
  return { count, capacity: league.capacity, full: count >= league.capacity };
}

export type LeagueAction = {
  label: string;
  href?: string;
  note: string;
  tone: "navy" | "secondary" | "disabled";
  icon?: "chart" | "chevronRight";
};

export function leagueAction(league: League, round: RoundState, joined: boolean, now: number): LeagueAction {
  const base = `/league/${league.slug}`;
  const { full } = managerCount(league, joined);
  if (round.phase === "live") {
    return {
      label: "Watch live",
      href: `${base}/live`,
      note: joined ? "Your squad is on the pitch" : "Table updates as prices move",
      tone: "navy",
      icon: "chart",
    };
  }
  if (joined) {
    return { label: "View squad", href: `${base}/locked`, note: "You’re in this one", tone: "secondary", icon: "chevronRight" };
  }
  if (full) return { label: "League full", note: `All ${league.capacity} spots taken`, tone: "disabled" };
  return {
    label: "Join league",
    href: base,
    note: `Free entry · locks ${kickoffLabel(round.kickoff, now)}`,
    tone: "navy",
  };
}

/** The horizontal league card: identity, clock, prize, managers, action. */
export function LeagueFacts({
  league,
  round,
  variant,
  eyebrowBadges,
  highlight,
  bare,
}: {
  league: League;
  round: RoundState;
  variant: "home" | "list";
  eyebrowBadges?: React.ReactNode;
  highlight?: "navy";
  /** Render without card chrome, for nesting inside another card. */
  bare?: boolean;
}) {
  const { entries, now } = useGame();
  const joined = Boolean(entries[`${league.slug}@${round.kickoff}`]);
  const { count, capacity, full } = managerCount(league, joined);
  const action = leagueAction(league, round, joined, now);
  const durationMin = league.schedule.durationMs / 60_000;

  const cols =
    variant === "home"
      ? "minmax(0, 1.3fr) minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr) auto"
      : "minmax(0, 1.4fr) 210px minmax(0, 1fr) 190px 220px";

  return (
    <article
      className={bare ? "facts" : "card facts"}
      style={
        {
          "--cols": cols,
          boxShadow: highlight === "navy" ? "0 0 0 2px var(--navy), var(--ledge-white)" : undefined,
          borderColor: highlight === "navy" ? "var(--navy)" : undefined,
        } as React.CSSProperties
      }
    >
      <div className="fact head">
        <div className="row wrap" style={{ gap: 8 }}>
          {eyebrowBadges ?? (
            <>
              {round.phase === "live" ? <Badge kind="live">Live</Badge> : <Badge kind="soon">{league.featured && variant === "home" ? "Featured" : "Upcoming"}</Badge>}
              {joined && <Badge kind="joined">Joined</Badge>}
              <span className="caption">Free entry · {durationMin < 60 ? `${durationMin} min` : league.format}</span>
            </>
          )}
        </div>
        <h2 className={variant === "home" ? "h-2" : "h-3"} style={{ fontSize: variant === "home" ? "clamp(30px, 3vw, 38px)" : 30 }}>
          {league.name}
        </h2>
        {variant === "list" && (
          <div className="row" style={{ gap: 10 }}>
            <LogoStack ids={league.pool.slice(0, 4)} />
            <span className="caption">
              Round {round.round} · {league.format} · {league.poolNote}
            </span>
          </div>
        )}
      </div>

      <div className="fact">
        {round.phase === "live" ? (
          <>
            <span className="cd-label">Time left</span>
            <Clock ms={round.remaining} label="Time left" />
          </>
        ) : round.remaining < 24 * 3600_000 ? (
          <>
            <span className="cd-label">Deadline in</span>
            <Clock ms={round.remaining} label="Deadline in" />
          </>
        ) : (
          <>
            <span className="cd-label">Kick-off</span>
            <span className="fig-m">{kickoffLabel(round.kickoff, now)}</span>
            <span className="caption">{league.runs}</span>
          </>
        )}
      </div>

      <div className="fact">
        <span className="cd-label">Prize</span>
        <PrizeLine company={league.prize.company} usd={league.prize.usd} />
      </div>

      <div className="fact">
        <span className="cd-label">Managers</span>
        <span className="fig-m">
          {count}
          <span className="fig-of"> / {capacity}</span>
        </span>
        <Progress value={count / capacity} tone={full ? "full" : undefined} />
      </div>

      <div className={["fact", "cta", action.tone === "navy" ? "lime" : action.tone === "disabled" ? "muted" : ""].join(" ")}>
        {action.href ? (
          <Link className={`btn ${action.tone === "navy" ? "btn-navy" : "btn-secondary"} btn-block ${variant === "home" ? "btn-lg" : ""}`} href={action.href}>
            {action.icon === "chart" && <Icon name="chart" />}
            {action.label}
            {action.icon === "chevronRight" && <Icon name="chevronRight" size="sm" />}
          </Link>
        ) : (
          <button type="button" className="btn btn-block" disabled>
            {action.label}
          </button>
        )}
        <span className="caption cta-note">{action.note}</span>
      </div>
    </article>
  );
}
