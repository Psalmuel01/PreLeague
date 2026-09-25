"use client";

import { useMemo } from "react";
import { LEAGUE_BY_SLUG, roundAt, type League, type RoundState } from "@/lib/leagues";
import { EARLY_BIRD_MS, companyReturns, levelFor, managersFor, roundXp, standingsFor, type Ranked } from "@/lib/standings";
import { useGame, type Entry } from "@/components/providers/GameProvider";

export type HistoryItem = {
  key: string;
  league: League;
  round: RoundState;
  entry: Entry;
  /** Null when final prices weren't captured, so the round can't be scored. */
  standings: Ranked[] | null;
  you: Ranked | null;
  winner: Ranked | null;
  simulated: boolean;
  xp: number;
  earlyBird: boolean;
};

export function useHistory(you: { name: string; initials: string }) {
  const { entries, prices, claims, now, ready } = useGame();

  return useMemo(() => {
    const items: HistoryItem[] = [];
    const active: { key: string; league: League; round: RoundState; entry: Entry }[] = [];
    if (!ready) return null;

    for (const [key, entry] of Object.entries(entries)) {
      const [slug, ko] = key.split("@");
      const league = LEAGUE_BY_SLUG[slug];
      if (!league) continue;
      const round = roundAt(league, Number(ko), now);
      if (round.phase !== "final") {
        active.push({ key, league, round, entry });
        continue;
      }
      const real = prices[key];
      const sim = prices[`${key}:sim`];
      const bp = real?.start && real?.end ? real : sim?.start && sim?.end ? sim : undefined;
      const standings = bp ? standingsFor(managersFor(league, round.kickoff, entry, you), companyReturns(league, bp.start, bp.end)) : null;
      const mine = standings?.find((s) => s.you) ?? null;
      const earlyBird = entry.lockedAt <= round.kickoff - EARLY_BIRD_MS;
      items.push({
        key,
        league,
        round,
        entry,
        standings,
        you: mine,
        winner: standings?.[0] ?? null,
        simulated: bp === sim && Boolean(sim),
        earlyBird,
        xp: roundXp(mine?.rank ?? null, earlyBird).total,
      });
    }

    items.sort((a, b) => b.round.kickoff - a.round.kickoff);
    active.sort((a, b) => a.round.kickoff - b.round.kickoff);

    const scored = items.filter((i) => i.you);
    const wins = scored.filter((i) => i.you!.rank === 1);
    const xp = items.reduce((s, i) => s + i.xp, 0);
    const prizesUsd = wins.reduce((s, i) => s + i.league.prize.usd, 0);
    const claimedUsd = wins.filter((i) => claims[i.key]?.status === "done").reduce((s, i) => s + i.league.prize.usd, 0);

    return {
      items,
      active,
      stats: {
        leagues: items.length + active.length,
        wins: wins.length,
        bestFinish: scored.length ? Math.min(...scored.map((i) => i.you!.rank)) : null,
        avgReturn: scored.length ? scored.reduce((s, i) => s + i.you!.portfolioReturn, 0) / scored.length : null,
        prizesUsd,
        claimedUsd,
      },
      xp,
      level: levelFor(xp),
      achievements: [
        { id: "winner", title: "Round winner", caption: "Won a league", icon: "trophy" as const, tone: "gold" as const, done: wins.length > 0 },
        { id: "hattrick", title: "Hat-trick", caption: "All 3 picks green", icon: null, tone: undefined, done: scored.some((i) => i.you!.pickReturns.every((r) => r > 0)) },
        { id: "podium", title: "Podium finish", caption: "Finished top 3", icon: "chart" as const, tone: "blue" as const, done: scored.some((i) => i.you!.rank <= 3) },
        { id: "early", title: "Early bird", caption: "Locked 5 min before deadline", icon: "clock" as const, tone: undefined, done: Object.entries(entries).some(([k, e]) => e.lockedAt <= Number(k.split("@")[1]) - EARLY_BIRD_MS) },
        { id: "streak", title: "5-round streak", caption: "Play 5 rounds in a row", icon: "lock" as const, tone: undefined, done: items.length + active.length >= 5 },
      ],
    };
  }, [entries, prices, claims, now, ready, you]);
}
