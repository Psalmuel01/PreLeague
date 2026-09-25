"use client";

import { useMemo } from "react";
import type { HistoryJSON } from "@/lib/api-types";
import { LEAGUE_BY_SLUG, type League } from "@/lib/leagues";
import { EARLY_BIRD_MS, levelFor, roundXp } from "@/lib/standings";
import { useSession } from "@/components/providers/SessionProvider";

export type HistoryItem = HistoryJSON & { league: League; xp: number; earlyBird: boolean; finished: boolean };

/** Your leagues from the server, with XP, level, stats and achievements derived from results. */
export function useHistory() {
  const session = useSession();
  return useMemo(() => {
    if (!session.loaded) return null;
    const all: HistoryItem[] = session.history
      .filter((h) => LEAGUE_BY_SLUG[h.series])
      .map((h) => {
        const earlyBird = h.lockedAt <= h.startsAt - EARLY_BIRD_MS;
        const finished = ["completed", "review_required", "cancelled"].includes(h.status);
        return {
          ...h,
          league: LEAGUE_BY_SLUG[h.series],
          earlyBird,
          finished,
          xp: h.status === "completed" ? roundXp(h.rank, earlyBird).total : 0,
        };
      });
    const items = all.filter((h) => h.finished);
    const active = all.filter((h) => !h.finished).sort((a, b) => a.startsAt - b.startsAt);
    const scored = items.filter((i) => i.rank !== null && i.score !== null);
    const wins = scored.filter((i) => i.rank === 1);
    const xp = items.reduce((s, i) => s + i.xp, 0);
    return {
      items,
      active,
      stats: {
        leagues: all.length,
        wins: wins.length,
        bestFinish: scored.length ? Math.min(...scored.map((i) => i.rank!)) : null,
        avgReturn: scored.length ? scored.reduce((s, i) => s + i.score!, 0) / scored.length : null,
        prizesUsd: wins.reduce((s, i) => s + i.prize.usd, 0),
      },
      xp,
      level: levelFor(xp),
      achievements: [
        { id: "winner", title: "Round winner", caption: "Won a league", icon: "trophy" as const, tone: "gold" as const, done: wins.length > 0 },
        { id: "hattrick", title: "Hat-trick", caption: "All 3 picks green", icon: null, tone: undefined, done: scored.some((i) => i.pickReturns?.every((r) => r > 0)) },
        { id: "podium", title: "Podium finish", caption: "Finished top 3", icon: "chart" as const, tone: "blue" as const, done: scored.some((i) => i.rank! <= 3) },
        { id: "early", title: "Early bird", caption: "Locked 5 min before deadline", icon: "clock" as const, tone: undefined, done: all.some((i) => i.earlyBird) },
        { id: "streak", title: "5-round streak", caption: "Play 5 rounds", icon: "lock" as const, tone: undefined, done: all.length >= 5 },
      ],
    };
  }, [session.loaded, session.history]);
}
