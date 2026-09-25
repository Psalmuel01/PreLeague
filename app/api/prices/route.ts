import { after } from "next/server";
import { maybeTick } from "@/lib/server/rounds";
import { collectPrices, latestQuotes, snapshotsBetween } from "@/lib/server/prices";
import { COMPANIES } from "@/lib/companies";

const STALE_MS = 5 * 60_000;

// GET /api/prices            → latest stored token/mark prices for the draft pool
// GET /api/prices?since=<ms> → also the recorded snapshots since then (for charts)
export async function GET(request: Request) {
  after(() => maybeTick());
  let quotes = await latestQuotes();
  let source: "prestocks" | "fallback" = "prestocks";
  // Only fetch PreStocks inline on a cold database; otherwise serve stored prices
  // immediately and let the background tick (after()) refresh them.
  if (quotes.length === 0) {
    const board = await collectPrices();
    if (board.source === "prestocks") quotes = await latestQuotes();
    else {
      source = "fallback";
      quotes = Object.values(board.quotes).map((x) => ({ ...x, capturedAt: board.capturedAt }));
    }
  } else if (Date.now() - Math.max(...quotes.map((x) => x.capturedAt)) > STALE_MS) {
    source = "fallback"; // stored prices are old (API or scheduler down); the UI says so
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
