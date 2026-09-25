import "server-only";
import { COMPANIES } from "@/lib/companies";
import { fetchPriceBoard, type PriceBoard } from "@/lib/prestocks";
import type { Snapshot } from "@/lib/scoring";
import { logJob, q } from "./db";

/** Fetch PreStocks and store one snapshot per symbol. Only live API data is stored. */
export async function collectPrices(): Promise<PriceBoard> {
  const board = await fetchPriceBoard();
  if (board.source !== "prestocks") {
    await logJob("prices", false, "PreStocks API unreachable; nothing stored");
    return board;
  }
  // Truncate to the second so a duplicate cron run in the same second is a no-op.
  const at = new Date(Math.floor(board.capturedAt / 1000) * 1000);
  const quotes = Object.values(board.quotes);
  await q(
    `insert into price_snapshots (symbol, token_price, mark_price, mint, captured_at, source)
     select * from unnest($1::text[], $2::float8[], $3::float8[], $4::text[], $5::timestamptz[], $6::text[])
     on conflict (symbol, captured_at) do nothing`,
    [
      quotes.map((x) => x.symbol),
      quotes.map((x) => x.tokenPrice),
      quotes.map((x) => x.markPrice),
      quotes.map((x) => x.mint),
      quotes.map(() => at),
      quotes.map(() => "prestocks"),
    ],
  );
  await logJob("prices", true, `${quotes.length} symbols`);
  return board;
}

export async function snapshotsBetween(symbols: string[], from: number, to: number): Promise<Snapshot[]> {
  const rows = await q<{ symbol: string; token_price: number; captured_at: Date }>(
    `select symbol, token_price, captured_at from price_snapshots
     where symbol = any($1) and captured_at between $2 and $3 order by captured_at`,
    [symbols, new Date(from), new Date(to)],
  );
  return rows.map((r) => ({ symbol: r.symbol, tokenPrice: r.token_price, capturedAt: r.captured_at.getTime() }));
}

export type LatestQuote = { symbol: string; tokenPrice: number; markPrice: number | null; mint: string | null; capturedAt: number };

export async function latestQuotes(): Promise<LatestQuote[]> {
  // One index probe per symbol (stays fast as the snapshot table grows).
  const rows = await q<{ symbol: string; token_price: number; mark_price: number | null; mint: string | null; captured_at: Date }>(
    `select s.symbol, p.token_price, p.mark_price, p.mint, p.captured_at
     from unnest($1::text[]) as s(symbol)
     cross join lateral (
       select token_price, mark_price, mint, captured_at from price_snapshots
       where symbol = s.symbol order by captured_at desc limit 1
     ) p`,
    [COMPANIES.map((c) => c.symbol)],
  );
  return rows.map((r) => ({ symbol: r.symbol, tokenPrice: r.token_price, markPrice: r.mark_price, mint: r.mint, capturedAt: r.captured_at.getTime() }));
}
