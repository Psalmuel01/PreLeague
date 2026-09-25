import "server-only";
import { createHash } from "node:crypto";
import { COMPANY_BY_ID, type CompanyId } from "@/lib/companies";
import { shortAddress } from "@/lib/format";
import { rankEntries, startPrice } from "@/lib/scoring";
import { SCORING } from "@/lib/settlement";
import type { ManagerJSON, RoundJSON } from "@/lib/api-types";
import { q } from "./db";
import { latestQuotes, snapshotsBetween } from "./prices";
import type { LeagueRow } from "./rounds";

export function avatarTone(wallet: string): string {
  const n = parseInt(createHash("sha1").update(wallet).digest("hex").slice(0, 4), 16);
  return `av-${(n % 8) + 1}`;
}

export function displayName(wallet: string, name: string | null): string {
  if (name) return name;
  return wallet.startsWith("bot:") ? wallet.slice(4) : shortAddress(wallet);
}

export async function roundView(league: LeagueRow, viewer: string | null): Promise<RoundJSON> {
  const symbolsAll = league.pool.map((p) => COMPANY_BY_ID[p].symbol);
  const startsAtMs = league.starts_at.getTime();
  const isFinal = league.status === "completed" && league.start_prices && league.end_prices;
  const isLiveish = !isFinal && Date.now() >= startsAtMs && ["live", "settling", "review_required", "upcoming"].includes(league.status);
  const [entryRows, resultRows, snapRows, quoteRows, claimRows] = await Promise.all([
    q<{ wallet: string; picks: CompanyId[]; locked_at: Date; display_name: string | null; is_bot: boolean | null }>(
      `select e.wallet, e.picks, e.locked_at, p.display_name, p.is_bot
       from entries e left join profiles p on p.wallet = e.wallet
       where e.league_id = $1 order by e.locked_at`,
      [league.id],
    ),
    isFinal
      ? q<{ wallet: string; rank: number; score: number; pick_returns: number[] }>(
          `select wallet, rank, score, pick_returns from results where league_id = $1 order by rank`,
          [league.id],
        )
      : Promise.resolve([]),
    isLiveish ? snapshotsBetween(symbolsAll, startsAtMs, startsAtMs + SCORING.maxStalenessMs) : Promise.resolve([]),
    isLiveish ? latestQuotes() : Promise.resolve([]),
    viewer
      ? q<{ wallet: string; status: string; tx_signature: string | null; error: string | null; network: string }>(
          `select wallet, status, tx_signature, error, network from prize_claims where league_id = $1`,
          [league.id],
        )
      : Promise.resolve([]),
  ]);
  const managers: ManagerJSON[] = entryRows.map((e) => {
    const name = displayName(e.wallet, e.display_name);
    return {
      id: e.wallet,
      name,
      initials: name.replace(/[^A-Za-z0-9]/g, "").slice(0, e.display_name || e.is_bot ? 1 : 2).toUpperCase() || "?",
      avatar: e.wallet === viewer ? "av-you" : avatarTone(e.wallet),
      mono: !e.display_name && !e.is_bot,
      bot: Boolean(e.is_bot),
      you: e.wallet === viewer,
      picks: e.picks,
      lockedAt: e.locked_at.getTime(),
    };
  });

  const popularity: Record<string, number> = {};
  for (const id of league.pool) popularity[id] = managers.length ? managers.filter((m) => m.picks.includes(id)).length / managers.length : 0;

  const symbols = symbolsAll;
  const startsAt = startsAtMs;
  const endsAt = league.ends_at.getTime();
  const now = Date.now();

  let start: Record<string, number> | null = null;
  let current: Record<string, number> | null = null;
  let nowAt: number | null = null;
  let stale = false;
  let standings: RoundJSON["standings"] = null;

  if (league.status === "completed" && league.start_prices && league.end_prices) {
    start = league.start_prices;
    current = league.end_prices;
    nowAt = endsAt;
    const byWallet = Object.fromEntries(managers.map((m) => [m.id, m]));
    standings = resultRows
      .filter((r) => byWallet[r.wallet])
      .map((r) => ({ ...byWallet[r.wallet], rank: r.rank, portfolioReturn: r.score, pickReturns: r.pick_returns }));
  } else if (now >= startsAt && ["live", "settling", "review_required", "upcoming"].includes(league.status)) {
    try {
      start = Object.fromEntries(symbols.map((s) => [s, startPrice(snapRows, s, startsAt, SCORING)]));
    } catch {
      start = null; // kick-off prices not recorded yet (or missing: round will go to review)
    }
    const until = Math.min(now, endsAt);
    const relevant = quoteRows.filter((x) => symbols.includes(x.symbol));
    if (relevant.length === symbols.length) {
      current = Object.fromEntries(relevant.map((x) => [x.symbol, x.tokenPrice]));
      nowAt = Math.min(...relevant.map((x) => x.capturedAt));
      stale = until - nowAt > SCORING.maxStalenessMs;
    }
    if (start && current) {
      const returns: Record<string, number> = {};
      for (const id of league.pool) returns[id] = current[COMPANY_BY_ID[id].symbol] / start[COMPANY_BY_ID[id].symbol] - 1;
      standings = rankEntries(managers, returns).map((r) => ({ ...r }));
    }
  }

  let returns: Record<string, number> | null = null;
  if (start && current) {
    returns = {};
    for (const id of league.pool) {
      const s = COMPANY_BY_ID[id].symbol;
      returns[id] = current[s] / start[s] - 1;
    }
  }

  const claimRow = claimRows[0];

  return {
    id: league.id,
    series: league.series,
    round: league.round,
    name: league.name,
    status: league.status,
    startsAt,
    endsAt,
    maxPlayers: league.max_players,
    pool: league.pool,
    prize: { company: league.prize_symbol, usd: Number(league.prize_usd), mint: league.prize_mint },
    managers,
    entry: managers.find((m) => m.you) ?? null,
    popularity,
    prices: { start, now: current, nowAt, stale },
    returns,
    standings,
    winnerWallet: league.winner_wallet,
    reviewReason: league.review_reason,
    claim: claimRow && claimRow.wallet === viewer ? { status: claimRow.status as "pending" | "sent" | "failed", tx: claimRow.tx_signature, error: claimRow.error, network: claimRow.network } : null,
  };
}
