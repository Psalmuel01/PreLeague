"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { COMPANIES } from "@/lib/companies";
import type { Snapshot } from "@/lib/scoring";
import { simPrice } from "@/lib/sim";
import { useGame } from "./GameProvider";

export type PriceSource = "prestocks" | "fallback" | "simulated" | "loading";

type Board = {
  quotes: Record<string, { tokenPrice: number; markPrice: number; mint: string }>;
  capturedAt: number;
  source: "prestocks" | "fallback";
  snapshots?: Snapshot[];
};

type PriceContext = {
  /** Current token price by symbol (simulated when demo prices are on). */
  prices: Record<string, number>;
  /** PreStocks mark (reference) price by symbol. */
  marks: Record<string, number>;
  source: PriceSource;
  updatedAt: number | null;
  /** Price at an arbitrary time: exact in simulated mode, from recorded history otherwise. */
  history: Snapshot[];
  priceAt: (symbol: string, t: number) => number | null;
  simulated: boolean;
};

const POLL_MS = 20_000;
const HISTORY_WINDOW_MS = 3 * 60 * 60_000;

const Ctx = createContext<PriceContext | null>(null);

export function PriceProvider({ children }: { children: React.ReactNode }) {
  const { settings, now, ready } = useGame();
  const [board, setBoard] = useState<Board | null>(null);
  const [history, setHistory] = useState<Snapshot[]>([]);

  useEffect(() => {
    let cancelled = false;
    let first = true;
    async function load() {
      try {
        const since = first ? Date.now() - HISTORY_WINDOW_MS : 0;
        const res = await fetch(`/api/prices${since ? `?since=${since}` : ""}`, { cache: "no-store" });
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as Board;
        if (cancelled) return;
        setBoard(data);
        setHistory((h) => {
          const next = first && data.snapshots ? [...data.snapshots] : [...h];
          if (data.source === "prestocks") {
            for (const [symbol, q] of Object.entries(data.quotes)) {
              next.push({ symbol, tokenPrice: q.tokenPrice, capturedAt: data.capturedAt });
            }
          }
          const cutoff = Date.now() - HISTORY_WINDOW_MS;
          const seen = new Set<string>();
          return next.filter((s) => {
            const k = `${s.symbol}@${s.capturedAt}`;
            if (s.capturedAt < cutoff || seen.has(k)) return false;
            seen.add(k);
            return true;
          });
        });
        first = false;
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

  const simulated = ready && settings.simulated;
  const base = useMemo(() => {
    const out: Record<string, number> = {};
    for (const c of COMPANIES) {
      const q = board?.quotes[c.symbol];
      if (q) out[c.symbol] = q.tokenPrice;
    }
    return out;
  }, [board]);

  const prices = useMemo(() => {
    if (!simulated) return base;
    const out: Record<string, number> = {};
    for (const [s, p] of Object.entries(base)) out[s] = simPrice(s, p, now);
    return out;
  }, [base, simulated, now]);

  const priceAt = useCallback(
    (symbol: string, t: number): number | null => {
      if (simulated) {
        const b = base[symbol];
        return b ? simPrice(symbol, b, t) : null;
      }
      return null;
    },
    [simulated, base],
  );

  const marks = useMemo(() => {
    const out: Record<string, number> = {};
    for (const [s, q] of Object.entries(board?.quotes ?? {})) out[s] = q.markPrice;
    return out;
  }, [board]);

  const value = useMemo<PriceContext>(
    () => ({
      prices,
      marks,
      source: simulated ? "simulated" : board ? board.source : "loading",
      updatedAt: simulated ? now : board ? board.capturedAt : null,
      history,
      priceAt,
      simulated,
    }),
    [prices, marks, simulated, board, now, history, priceAt],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePrices(): PriceContext {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("usePrices must be used inside <PriceProvider>");
  return ctx;
}
