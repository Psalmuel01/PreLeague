import "server-only";
import { fetchPriceBoard, type PriceBoard } from "./prestocks";
import type { Snapshot } from "./scoring";

// In-process snapshot store. Good for local dev and a single long-lived server;
// swap for the Supabase `price_snapshots` table in production (same shape).

const RETENTION_MS = 24 * 60 * 60_000;
const MIN_INTERVAL_MS = 20_000;

type Store = { snapshots: Snapshot[]; latest: PriceBoard | null; inflight: Promise<PriceBoard> | null };

const g = globalThis as unknown as { __preleagueSnapshots?: Store };
const store: Store = (g.__preleagueSnapshots ??= { snapshots: [], latest: null, inflight: null });

/** Latest board, refreshing from PreStocks at most every MIN_INTERVAL_MS. */
export async function latestBoard(): Promise<PriceBoard> {
  if (store.latest && Date.now() - store.latest.capturedAt < MIN_INTERVAL_MS) return store.latest;
  return capture();
}

/** Fetch prices now and record a snapshot per symbol (live prices only). */
export async function capture(): Promise<PriceBoard> {
  store.inflight ??= fetchPriceBoard().finally(() => {
    store.inflight = null;
  });
  const board = await store.inflight;
  store.latest = board;
  if (board.source === "prestocks") {
    for (const q of Object.values(board.quotes)) {
      store.snapshots.push({ symbol: q.symbol, tokenPrice: q.tokenPrice, capturedAt: board.capturedAt });
    }
    const cutoff = Date.now() - RETENTION_MS;
    store.snapshots = store.snapshots.filter((s) => s.capturedAt >= cutoff);
  }
  return board;
}

export function snapshotsSince(since: number): Snapshot[] {
  return store.snapshots.filter((s) => s.capturedAt >= since);
}
