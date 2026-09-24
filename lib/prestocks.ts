import "server-only";
import { COMPANIES, COMPANY_BY_SYMBOL } from "./companies";

export const PRESTOCKS_API = "https://prestocks.com/api/prestocks";

export type PriceQuote = {
  symbol: string;
  tokenPrice: number;
  markPrice: number;
  mint: string;
};

export type PriceBoard = {
  quotes: Record<string, PriceQuote>;
  capturedAt: number;
  source: "prestocks" | "fallback";
};

type ApiAsset = {
  symbol: string;
  contract_address: string;
  markPrice: number;
  tokenPrice: number;
};

// Last known prices (PreStocks API, 25 Sep 2026). Only served when the API is
// unreachable, and always flagged as `fallback` so the UI can say so.
const FALLBACK: Record<string, number> = {
  OPENAI: 1340.67,
  ANTHROPIC: 1034.56,
  SPACEX: 116.15,
  NEURALINK: 452.99,
  ANDURIL: 161.88,
  FIGUREAI: 171.74,
  KALSHI: 878.42,
  POLYMARKET: 151.69,
};

export async function fetchPriceBoard(): Promise<PriceBoard> {
  try {
    const res = await fetch(PRESTOCKS_API, {
      headers: { accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`PreStocks API ${res.status}`);
    const data = (await res.json()) as ApiAsset[];
    const quotes: Record<string, PriceQuote> = {};
    for (const a of data) {
      if (!COMPANY_BY_SYMBOL[a.symbol]) continue;
      if (!(Number.isFinite(a.tokenPrice) && a.tokenPrice > 0)) continue;
      quotes[a.symbol] = {
        symbol: a.symbol,
        tokenPrice: a.tokenPrice,
        markPrice: a.markPrice,
        mint: a.contract_address,
      };
    }
    if (Object.keys(quotes).length === 0) throw new Error("PreStocks API returned no usable prices");
    return { quotes, capturedAt: Date.now(), source: "prestocks" };
  } catch (err) {
    console.warn("[prestocks] falling back to last known prices:", err);
    return fallbackBoard();
  }
}

function fallbackBoard(): PriceBoard {
  const quotes: Record<string, PriceQuote> = {};
  for (const c of COMPANIES) {
    quotes[c.symbol] = {
      symbol: c.symbol,
      tokenPrice: FALLBACK[c.symbol],
      markPrice: FALLBACK[c.symbol],
      mint: c.mint,
    };
  }
  return { quotes, capturedAt: Date.now(), source: "fallback" };
}
