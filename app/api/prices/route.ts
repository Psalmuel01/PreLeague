import { collectPrices, latestQuotes, snapshotsBetween } from "@/lib/server/prices";
import { COMPANIES } from "@/lib/companies";

const FRESH_MS = 90_000;

// GET /api/prices            → latest stored token/mark prices for the draft pool
// GET /api/prices?since=<ms> → also the recorded snapshots since then (for charts)
export async function GET(request: Request) {
  let quotes = await latestQuotes();
  let source: "prestocks" | "fallback" = "prestocks";
  const newest = Math.max(0, ...quotes.map((x) => x.capturedAt));
  if (quotes.length === 0 || Date.now() - newest > FRESH_MS) {
    const board = await collectPrices();
    if (board.source === "prestocks") quotes = await latestQuotes();
    else {
      // API down: serve the last stored prices (or the built-in fallback) and say so.
      source = "fallback";
      if (quotes.length === 0) quotes = Object.values(board.quotes).map((x) => ({ ...x, capturedAt: board.capturedAt }));
    }
  }
  const since = Number(new URL(request.url).searchParams.get("since"));
  const snapshots =
    Number.isFinite(since) && since > 0 ? await snapshotsBetween(COMPANIES.map((c) => c.symbol), since, Date.now()) : undefined;
  return Response.json(
    {
      source,
      capturedAt: Math.min(...quotes.map((x) => x.capturedAt)),
      quotes: Object.fromEntries(quotes.map((x) => [x.symbol, { tokenPrice: x.tokenPrice, markPrice: x.markPrice, mint: x.mint }])),
      snapshots,
    },
    { headers: { "cache-control": "no-store" } },
  );
}
