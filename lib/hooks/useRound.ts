"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { COMPANY_BY_ID, type CompanyId } from "@/lib/companies";
import {
  currentRound,
  lastFinishedRound,
  opponentsFor,
  roundAt,
  roundKey,
  type League,
  type Opponent,
  type RoundState,
} from "@/lib/leagues";
import { endPrice, rankEntries, startPrice } from "@/lib/scoring";
import { useGame, type Entry, type RoundPrices } from "@/components/providers/GameProvider";
import { usePrices } from "@/components/providers/PriceProvider";

const MIN = 60_000;
const LATE_CAPTURE_LIMIT_MS = 5 * MIN;

export type Manager = {
  id: string;
  name: string;
  initials: string;
  avatar: string;
  mono?: boolean;
  you: boolean;
  picks: CompanyId[];
  lockedAt: number;
};

export type Standing = Manager & {
  rank: number;
  portfolioReturn: number;
  pickReturns: number[];
  /** Places gained (+) or lost (−) at the last price update. */
  move: number;
};

export type RoundView = {
  league: League;
  round: RoundState;
  key: string;
  priceKey: string;
  entry: Entry | undefined;
  draft: CompanyId[];
  managers: Manager[];
  /** Company returns this round (null until a kick-off price exists). */
  returns: Record<CompanyId, number> | null;
  standings: Standing[] | null;
  you: Standing | null;
  boundary: RoundPrices;
  /** Current or final price per company used for the returns. */
  nowPrices: Record<CompanyId, number> | null;
  /** Round finished but final prices couldn't be established. */
  unscoreable: boolean;
};

/**
 * Everything a page needs about one round of a league: phase and clock, your
 * lineup, every manager's return and the ranked table. Pass `which` to pick
 * the current round (default), the last finished one, or a specific kick-off.
 */
export function useRound(
  league: League,
  which: "current" | "last-final" | number = "current",
  opts: { youName?: string; youInitials?: string } = {},
): RoundView | null {
  const game = useGame();
  const { prices, history, priceAt, simulated } = usePrices();
  const { now, ready } = game;

  const round = useMemo<RoundState | null>(() => {
    if (!ready) return null;
    if (which === "current") return currentRound(league, now);
    if (which === "last-final") return lastFinishedRound(league, now);
    return roundAt(league, which, now);
  }, [ready, league, which, now]);

  const key = round ? roundKey(league, round.kickoff) : "";
  const priceKey = `${key}${simulated ? ":sim" : ""}`;
  const entry = key ? game.entries[key] : undefined;
  const boundary = useMemo(() => game.prices[priceKey] ?? {}, [game.prices, priceKey]);
  const { setRoundPrices } = game;

  // Capture kick-off and final-whistle prices for this round once available.
  useEffect(() => {
    if (!round || round.phase === "upcoming") return;
    const symbols = league.pool.map((id) => COMPANY_BY_ID[id].symbol);
    if (Object.keys(prices).length === 0) return;

    if (!boundary.start) {
      const start = boundaryPrices(symbols, (s) =>
        simulated ? priceAt(s, round.kickoff) : safe(() => startPrice(history, s, round.kickoff)),
      );
      if (start) {
        setRoundPrices(priceKey, { start, startAt: round.kickoff });
      } else if (round.phase === "live" || now - round.endsAt < LATE_CAPTURE_LIMIT_MS) {
        const late = boundaryPrices(symbols, (s) => prices[s] ?? null);
        if (late) setRoundPrices(priceKey, { start: late, startAt: now, startLate: true });
      }
    }

    if (round.phase === "final" && boundary.start && !boundary.end) {
      const end = boundaryPrices(symbols, (s) =>
        simulated ? priceAt(s, round.endsAt) : safe(() => endPrice(history, s, round.endsAt)),
      );
      if (end) {
        setRoundPrices(priceKey, { end, endAt: round.endsAt });
      } else if (now - round.endsAt < LATE_CAPTURE_LIMIT_MS) {
        const late = boundaryPrices(symbols, (s) => prices[s] ?? null);
        if (late) setRoundPrices(priceKey, { end: late, endAt: now });
      }
    }
  }, [round, league.pool, prices, history, priceAt, simulated, boundary, priceKey, now, setRoundPrices]);

  const managers = useMemo<Manager[]>(() => {
    if (!round) return [];
    const opp: Manager[] = opponentsFor(league).map((o: Opponent) => ({
      id: o.id,
      name: o.name,
      initials: o.initials,
      avatar: o.avatar,
      mono: Boolean(o.wallet),
      you: false,
      picks: o.picks,
      lockedAt: round.kickoff - o.lockedMinsBefore * MIN,
    }));
    if (entry) {
      opp.push({
        id: "you",
        name: opts.youName ?? "You",
        initials: opts.youInitials ?? "Y",
        avatar: "av-you",
        you: true,
        picks: entry.picks,
        lockedAt: entry.lockedAt,
      });
    }
    return opp;
  }, [round, league, entry, opts.youName, opts.youInitials]);

  const nowPrices = useMemo<Record<CompanyId, number> | null>(() => {
    if (!round || round.phase === "upcoming") return null;
    const source = round.phase === "final" ? boundary.end : prices;
    if (!source) return null;
    const out = {} as Record<CompanyId, number>;
    for (const id of league.pool) {
      const p = source[COMPANY_BY_ID[id].symbol];
      if (!p) return null;
      out[id] = p;
    }
    return out;
  }, [round, boundary.end, prices, league.pool]);

  const returns = useMemo<Record<CompanyId, number> | null>(() => {
    if (!boundary.start || !nowPrices) return null;
    const out = {} as Record<CompanyId, number>;
    for (const id of league.pool) {
      const start = boundary.start[COMPANY_BY_ID[id].symbol];
      if (!start) return null;
      out[id] = nowPrices[id] / start - 1;
    }
    return out;
  }, [boundary.start, nowPrices, league.pool]);

  const ranked = useMemo(() => (returns ? rankEntries(managers, returns) : null), [managers, returns]);
  const moves = useRankMoves(key, ranked);

  const standings = useMemo<Standing[] | null>(
    () => ranked?.map((r) => ({ ...r, move: moves[r.id] ?? 0 })) ?? null,
    [ranked, moves],
  );

  if (!round) return null;
  return {
    league,
    round,
    key,
    priceKey,
    entry,
    draft: game.drafts[key] ?? [],
    managers,
    returns,
    standings,
    you: standings?.find((s) => s.you) ?? null,
    boundary,
    nowPrices,
    unscoreable: round.phase === "final" && !boundary.end && now - round.endsAt >= LATE_CAPTURE_LIMIT_MS,
  };
}

/** Rank change per manager at the most recent reorder; sticky until the next one. */
function useRankMoves(key: string, ranked: { id: string; rank: number }[] | null) {
  const prev = useRef<{ key: string; ranks: Record<string, number> } | null>(null);
  const [moves, setMoves] = useState<Record<string, number>>({});
  useEffect(() => {
    if (!ranked) return;
    const ranks = Object.fromEntries(ranked.map((r) => [r.id, r.rank]));
    const before = prev.current?.key === key ? prev.current.ranks : null;
    prev.current = { key, ranks };
    if (!before) {
      setMoves({});
      return;
    }
    const changed = ranked.some((r) => before[r.id] !== undefined && before[r.id] !== r.rank);
    if (changed) {
      setMoves(Object.fromEntries(ranked.map((r) => [r.id, (before[r.id] ?? r.rank) - r.rank])));
    }
  }, [key, ranked]);
  return moves;
}

function boundaryPrices(symbols: string[], get: (s: string) => number | null): Record<string, number> | null {
  const out: Record<string, number> = {};
  for (const s of symbols) {
    const p = get(s);
    if (p === null || !Number.isFinite(p) || p <= 0) return null;
    out[s] = p;
  }
  return out;
}

function safe(fn: () => number): number | null {
  try {
    return fn();
  } catch {
    return null;
  }
}
