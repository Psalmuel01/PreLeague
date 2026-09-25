"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CompanyId } from "@/lib/companies";
import type { League, Phase, RoundState } from "@/lib/leagues";
import type { LeagueStatus, ManagerJSON, RoundJSON, StandingJSON } from "@/lib/api-types";
import { useGame } from "@/components/providers/GameProvider";
import { useSession } from "@/components/providers/SessionProvider";

export type Manager = ManagerJSON;

export type Standing = StandingJSON & {
  /** Places gained (+) or lost (−) at the last price update. */
  move: number;
};

export type RoundView = {
  league: League;
  id: string;
  status: LeagueStatus;
  round: RoundState;
  entry: Manager | null;
  managers: Manager[];
  returns: Record<CompanyId, number> | null;
  standings: Standing[] | null;
  you: Standing | null;
  /** Kick-off and (when final) settlement prices by symbol. */
  boundary: { start?: Record<string, number>; end?: Record<string, number>; startAt: number };
  /** Current (live) or settlement (final) price per symbol. */
  nowPrices: Record<string, number> | null;
  nowAt: number | null;
  stale: boolean;
  popularity: Record<string, number>;
  prize: RoundJSON["prize"];
  maxPlayers: number;
  winnerWallet: string | null;
  claim: RoundJSON["claim"];
  /** Round could not be scored (missing prices) and is under review. */
  unscoreable: boolean;
  reviewReason: string | null;
  refresh: () => Promise<void>;
};

type Which = "current" | "next" | "live" | "last" | string;

type SeriesResponse = { round: RoundJSON | null; liveId: string | null; nextId: string | null; lastId: string | null };

/** A round of a league from the server, polled while it matters. `which` may be a league id. */
export function useRound(league: League, which: Which = "current") {
  const { now, ready } = useGame();
  const session = useSession();
  const [data, setData] = useState<SeriesResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/series/${league.slug}?which=${encodeURIComponent(which)}`, { cache: "no-store" });
      if (!res.ok) throw new Error((await res.json()).error ?? res.statusText);
      setData((await res.json()) as SeriesResponse);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [league.slug, which]);

  const status = data?.round?.status;
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on mount, then poll
    load();
    const every = status === "live" || status === "settling" ? 10_000 : 30_000;
    const id = setInterval(load, every);
    return () => clearInterval(id);
  }, [load, status, session.wallet]);

  const json = data?.round ?? null;
  const moves = useRankMoves(json?.id ?? "", json?.standings ?? null);

  const view = useMemo<RoundView | null>(() => {
    if (!json || !ready) return null;
    const round = toRoundState(json, now);
    const standings = json.standings?.map((s) => ({ ...s, move: moves[s.id] ?? 0 })) ?? null;
    return {
      league,
      id: json.id,
      status: json.status,
      round,
      entry: json.entry,
      managers: json.managers,
      returns: json.returns as Record<CompanyId, number> | null,
      standings,
      you: standings?.find((s) => s.you) ?? null,
      boundary: {
        start: json.prices.start ?? undefined,
        end: json.status === "completed" ? json.prices.now ?? undefined : undefined,
        startAt: json.startsAt,
      },
      nowPrices: json.prices.now,
      nowAt: json.prices.nowAt,
      stale: json.prices.stale,
      popularity: json.popularity,
      prize: json.prize,
      maxPlayers: json.maxPlayers,
      winnerWallet: json.winnerWallet,
      claim: json.claim,
      unscoreable: json.status === "review_required" || json.status === "cancelled",
      reviewReason: json.reviewReason,
      refresh: load,
    };
  }, [json, ready, now, moves, league, load]);

  return { view, loaded: data !== null || error !== null, error, ids: { live: data?.liveId ?? null, next: data?.nextId ?? null, last: data?.lastId ?? null }, refresh: load };
}

/** Clock state for a round summary from the server. */
export function toRoundState(r: { round: number; status: LeagueStatus; startsAt: number; endsAt: number }, now: number): RoundState {
  const phase: Phase =
    r.status === "upcoming" && now < r.startsAt ? "upcoming" : (r.status === "live" || r.status === "upcoming") && now < r.endsAt ? "live" : "final";
  return {
    round: r.round,
    phase,
    kickoff: r.startsAt,
    endsAt: r.endsAt,
    remaining: phase === "upcoming" ? r.startsAt - now : phase === "live" ? r.endsAt - now : 0,
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
    if (!before) return;
    const changed = ranked.some((r) => before[r.id] !== undefined && before[r.id] !== r.rank);
    if (changed) setMoves(Object.fromEntries(ranked.map((r) => [r.id, (before[r.id] ?? r.rank) - r.rank])));
  }, [key, ranked]);
  return moves;
}
