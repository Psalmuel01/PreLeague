"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { CompanyId } from "@/lib/companies";

// Client-only state: a 1-second clock for countdowns, and draft picks that
// haven't been locked yet (kept across reloads). Everything authoritative —
// leagues, lineups, prices, results — lives on the server.

type GameContext = {
  ready: boolean;
  now: number;
  drafts: Record<string, CompanyId[]>;
  setDraft: (leagueId: string, picks: CompanyId[]) => void;
};

const STORAGE_KEY = "preleague:drafts:v2";
const Ctx = createContext<GameContext | null>(null);

export function GameProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [now, setNow] = useState(0);
  const [drafts, setDrafts] = useState<Record<string, CompanyId[]>>({});

  // Hydrate from localStorage after mount, then start the clock.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setDrafts(JSON.parse(raw));
    } catch {
      // Private mode or corrupted storage: start fresh.
    }
    setNow(Date.now());
    setReady(true);
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(drafts));
    } catch {
      // Storage blocked; drafts still work for this session.
    }
  }, [drafts, ready]);

  const setDraft = useCallback((leagueId: string, picks: CompanyId[]) => {
    setDrafts((d) => ({ ...d, [leagueId]: picks }));
  }, []);

  const value = useMemo(() => ({ ready, now, drafts, setDraft }), [ready, now, drafts, setDraft]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useGame(): GameContext {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useGame must be used inside <GameProvider>");
  return ctx;
}
