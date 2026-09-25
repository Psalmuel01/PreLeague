// Pure settlement: given a round's boundary times, its snapshots and entries,
// decide the frozen boundary prices and final ranking — or why it can't be scored.

import { StalePriceError, endPrice, rankEntries, startPrice, type Snapshot } from "./scoring";

export const SCORING = {
  samples: 3,
  /** A boundary price must come from snapshots within this window. */
  maxStalenessMs: 3 * 60_000,
} as const;

export type SettleInput = {
  startsAt: number;
  endsAt: number;
  symbols: string[];
  snapshots: Snapshot[];
  entries: { wallet: string; picks: string[]; lockedAt: number }[];
};

export type SettleOutput =
  | {
      ok: true;
      startPrices: Record<string, number>;
      endPrices: Record<string, number>;
      returns: Record<string, number>;
      results: { wallet: string; rank: number; score: number; picks: string[]; pickReturns: number[] }[];
      winner: string | null;
    }
  | { ok: false; reason: string };

export function boundaryPrices(
  snapshots: Snapshot[],
  symbols: string[],
  at: number,
  side: "start" | "end",
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const s of symbols) {
    out[s] = (side === "start" ? startPrice : endPrice)(snapshots, s, at, SCORING);
  }
  return out;
}

export function settle(input: SettleInput): SettleOutput {
  let startPrices: Record<string, number>;
  let endPrices: Record<string, number>;
  try {
    startPrices = boundaryPrices(input.snapshots, input.symbols, input.startsAt, "start");
    endPrices = boundaryPrices(input.snapshots, input.symbols, input.endsAt, "end");
  } catch (err) {
    if (err instanceof StalePriceError) {
      return { ok: false, reason: `No valid ${err.side} price for ${err.symbol} within ${SCORING.maxStalenessMs / 60_000} minutes of the ${err.side === "start" ? "kick-off" : "final whistle"}` };
    }
    throw err;
  }
  const returns: Record<string, number> = {};
  for (const s of input.symbols) returns[s] = endPrices[s] / startPrices[s] - 1;

  const ranked = rankEntries(
    input.entries.map((e) => ({ id: e.wallet, picks: e.picks, lockedAt: e.lockedAt })),
    returns,
  );
  return {
    ok: true,
    startPrices,
    endPrices,
    returns,
    results: ranked.map((r) => ({ wallet: r.id, rank: r.rank, score: r.portfolioReturn, picks: r.picks, pickReturns: r.pickReturns })),
    winner: ranked[0]?.id ?? null,
  };
}

/** Validate a submitted lineup against the league's pool. Returns an error message or null. */
export function validatePicks(picks: unknown, pool: string[], required = 3): string | null {
  if (!Array.isArray(picks) || !picks.every((p) => typeof p === "string")) return "Picks must be a list of companies";
  if (picks.length !== required) return `Pick exactly ${required} companies`;
  if (new Set(picks).size !== picks.length) return "Each company can only be picked once";
  const bad = picks.find((p) => !pool.includes(p));
  if (bad) return `${bad} isn’t in this league’s draft pool`;
  return null;
}
