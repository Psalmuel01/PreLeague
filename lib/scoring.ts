// PreLeague scoring engine. Pure functions, no I/O, so results are reproducible
// from stored price snapshots.
//
//   r_i  = (P_end,i − P_start,i) / P_start,i
//   R_p  = (r_1 + r_2 + r_3) / 3                 (equal weight)
//
// Boundary prices are trailing/leading averages of snapshots, and any asset
// without a fresh snapshot near a boundary makes the round unscoreable
// rather than silently using an old price.

export type Snapshot = {
  symbol: string;
  tokenPrice: number;
  capturedAt: number; // epoch ms
};

export type BoundaryOptions = {
  /** How many snapshots to average at the boundary. */
  samples?: number;
  /** Snapshots further than this from the boundary are ignored. */
  maxStalenessMs?: number;
};

export class StalePriceError extends Error {
  constructor(
    public symbol: string,
    public side: "start" | "end",
  ) {
    super(`No valid ${side} price for ${symbol} within the staleness window`);
    this.name = "StalePriceError";
  }
}

const DEFAULT_SAMPLES = 3;
const DEFAULT_STALENESS_MS = 2 * 60_000;

/** Average of the first `samples` snapshots at or after `at` (kick-off price). */
export function startPrice(
  snapshots: Snapshot[],
  symbol: string,
  at: number,
  opts: BoundaryOptions = {},
): number {
  const samples = opts.samples ?? DEFAULT_SAMPLES;
  const maxStale = opts.maxStalenessMs ?? DEFAULT_STALENESS_MS;
  const valid = snapshots
    .filter(
      (s) =>
        s.symbol === symbol &&
        isValidPrice(s.tokenPrice) &&
        s.capturedAt >= at &&
        s.capturedAt - at <= maxStale,
    )
    .sort((a, b) => a.capturedAt - b.capturedAt)
    .slice(0, samples);
  if (valid.length === 0) throw new StalePriceError(symbol, "start");
  return mean(valid.map((s) => s.tokenPrice));
}

/** Average of the last `samples` snapshots at or before `at` (final-whistle price). */
export function endPrice(
  snapshots: Snapshot[],
  symbol: string,
  at: number,
  opts: BoundaryOptions = {},
): number {
  const samples = opts.samples ?? DEFAULT_SAMPLES;
  const maxStale = opts.maxStalenessMs ?? DEFAULT_STALENESS_MS;
  const valid = snapshots
    .filter(
      (s) =>
        s.symbol === symbol &&
        isValidPrice(s.tokenPrice) &&
        s.capturedAt <= at &&
        at - s.capturedAt <= maxStale,
    )
    .sort((a, b) => b.capturedAt - a.capturedAt)
    .slice(0, samples);
  if (valid.length === 0) throw new StalePriceError(symbol, "end");
  return mean(valid.map((s) => s.tokenPrice));
}

export function assetReturn(start: number, end: number): number {
  if (!isValidPrice(start) || !isValidPrice(end)) {
    throw new RangeError(`Invalid prices: start=${start} end=${end}`);
  }
  return (end - start) / start;
}

/** Equal-weight portfolio return. */
export function portfolioReturn(returns: number[]): number {
  if (returns.length === 0) throw new RangeError("Portfolio needs at least one pick");
  return mean(returns);
}

/** How much one pick adds to an equal-weight squad of `size` picks. */
export function contribution(assetRet: number, size = 3): number {
  return assetRet / size;
}

export type Entry<Id extends string = string> = {
  id: string;
  picks: Id[];
  lockedAt: number;
};

export type RankedEntry<E extends Entry> = E & {
  rank: number;
  portfolioReturn: number;
  pickReturns: number[];
};

/**
 * Rank entries by portfolio return. Ties break on the best single pick, then
 * the second-best pick, then the earlier lineup lock. Deterministic for any
 * input order.
 */
export function rankEntries<Id extends string, E extends Entry<Id>>(
  entries: E[],
  returns: Record<Id, number>,
): RankedEntry<E>[] {
  const scored = entries.map((entry) => {
    const pickReturns = entry.picks.map((p) => {
      const r = returns[p];
      if (r === undefined || !Number.isFinite(r)) throw new RangeError(`Missing return for ${p}`);
      return r;
    });
    return {
      entry,
      pickReturns,
      total: portfolioReturn(pickReturns),
      best: [...pickReturns].sort((a, b) => b - a),
    };
  });

  scored.sort(
    (a, b) =>
      cmpDesc(a.total, b.total) ||
      cmpDesc(a.best[0], b.best[0]) ||
      cmpDesc(a.best[1] ?? 0, b.best[1] ?? 0) ||
      a.entry.lockedAt - b.entry.lockedAt ||
      a.entry.id.localeCompare(b.entry.id),
  );

  return scored.map((s, i) => ({
    ...s.entry,
    pickReturns: s.pickReturns,
    portfolioReturn: s.total,
    rank: i + 1,
  }));
}

// Compare at 1e-12 so float noise from averaging doesn't decide a tie.
function cmpDesc(a: number, b: number): number {
  const d = b - a;
  return Math.abs(d) < 1e-12 ? 0 : d;
}

function mean(xs: number[]): number {
  return xs.reduce((s, x) => s + x, 0) / xs.length;
}

function isValidPrice(p: number): boolean {
  return Number.isFinite(p) && p > 0;
}
