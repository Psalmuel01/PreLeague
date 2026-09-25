"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { Snapshot } from "@/lib/scoring";

export type PriceSource = "prestocks" | "fallback" | "loading";

type Board = {
  quotes: Record<string, { tokenPrice: number; markPrice: number | null; mint: string | null }>;
  capturedAt: number;
  source: "prestocks" | "fallback";
  snapshots?: Snapshot[];
};

type PriceContext = {
  /** Latest stored PreStocks token price by symbol. */
  prices: Record<string, number>;
  /** PreStocks mark (reference) price by symbol. */
  marks: Record<string, number>;
  source: PriceSource;
  updatedAt: number | null;
  /** Recorded snapshots (last few hours) for price charts. */
  history: Snapshot[];
};

const POLL_MS = 20_000;
const HISTORY_WINDOW_MS = 3 * 60 * 60_000;
const Ctx = createContext<PriceContext | null>(null);

export function PriceProvider({ children }: { children: React.ReactNode }) {
  const [board, setBoard] = useState<Board | null>(null);
  const [history, setHistory] = useState<Snapshot[]>([]);

  useEffect(() => {
    let cancelled = false;
    let since = Date.now() - HISTORY_WINDOW_MS;
    async function load() {
      try {
        const res = await fetch(`/api/prices?since=${since}`, { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as Board;
        if (cancelled) return;
        setBoard(data);
        if (data.snapshots?.length) {
          since = Math.max(...data.snapshots.map((s) => s.capturedAt)) + 1;
          const cutoff = Date.now() - HISTORY_WINDOW_MS;
          setHistory((h) => [...h, ...data.snapshots!].filter((s) => s.capturedAt >= cutoff));
        }
      } catch {
        // Keep the last board; the source pill shows its age.
      }
    }
    load();
    const id = setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const value = useMemo<PriceContext>(() => {
    const prices: Record<string, number> = {};
    const marks: Record<string, number> = {};
    for (const [s, q] of Object.entries(board?.quotes ?? {})) {
      prices[s] = q.tokenPrice;
      if (q.markPrice) marks[s] = q.markPrice;
    }
    return { prices, marks, source: board ? board.source : "loading", updatedAt: board?.capturedAt ?? null, history };
  }, [board, history]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePrices(): PriceContext {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("usePrices must be used inside <PriceProvider>");
  return ctx;
}
