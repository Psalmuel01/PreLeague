"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { CompanyId } from "@/lib/companies";

// Player-side state for the MVP, persisted to localStorage. Lineups are also
// signed with the player's wallet; a backend (Supabase `entries`) replaces this
// store once it exists.

export type Entry = {
  picks: CompanyId[];
  lockedAt: number;
  wallet?: string;
  signature?: string;
  message?: string;
};

/** Boundary prices captured for a round (keyed by symbol). */
export type RoundPrices = {
  start?: Record<string, number>;
  startAt?: number;
  /** Kick-off price was captured after kick-off (viewer opened the round late). */
  startLate?: boolean;
  end?: Record<string, number>;
  endAt?: number;
};

export type Claim = { status: "pending" | "done" | "failed"; at: number; tx?: string; simulated?: boolean };

export type Settings = {
  /** Show the demo panel. */
  demo: boolean;
  /** Use simulated prices instead of the PreStocks feed. */
  simulated: boolean;
  /** Demo clock offset in ms, to jump between round phases. */
  timeOffset: number;
};

type State = {
  entries: Record<string, Entry>;
  drafts: Record<string, CompanyId[]>;
  prices: Record<string, RoundPrices>;
  claims: Record<string, Claim>;
  name?: string;
  settings: Settings;
};

const STORAGE_KEY = "preleague:v1";
const EMPTY: State = {
  entries: {},
  drafts: {},
  prices: {},
  claims: {},
  settings: { demo: false, simulated: false, timeOffset: 0 },
};

type GameContext = State & {
  ready: boolean;
  now: number;
  setDraft: (key: string, picks: CompanyId[]) => void;
  lockEntry: (key: string, entry: Entry) => void;
  setRoundPrices: (key: string, patch: RoundPrices) => void;
  setClaim: (key: string, claim: Claim) => void;
  setName: (name: string) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  resetAll: () => void;
};

const Ctx = createContext<GameContext | null>(null);

export function GameProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<State>(EMPTY);
  const [ready, setReady] = useState(false);
  const [wallNow, setWallNow] = useState(0);
  const loaded = useRef(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<State>;
        setState({ ...EMPTY, ...parsed, settings: { ...EMPTY.settings, ...parsed.settings } });
      }
    } catch {
      // Private mode or corrupted storage: start fresh.
    }
    const params = new URLSearchParams(window.location.search);
    if (params.has("demo")) {
      setState((s) => ({ ...s, settings: { ...s.settings, demo: params.get("demo") !== "0" } }));
    }
    loaded.current = true;
    setWallNow(Date.now());
    setReady(true);
    const id = setInterval(() => setWallNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!loaded.current) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Storage full or blocked; state still works for this session.
    }
  }, [state]);

  const setDraft = useCallback((key: string, picks: CompanyId[]) => {
    setState((s) => ({ ...s, drafts: { ...s.drafts, [key]: picks } }));
  }, []);
  const lockEntry = useCallback((key: string, entry: Entry) => {
    setState((s) => ({ ...s, entries: { ...s.entries, [key]: entry } }));
  }, []);
  const setRoundPrices = useCallback((key: string, patch: RoundPrices) => {
    setState((s) => ({ ...s, prices: { ...s.prices, [key]: { ...s.prices[key], ...patch } } }));
  }, []);
  const setClaim = useCallback((key: string, claim: Claim) => {
    setState((s) => ({ ...s, claims: { ...s.claims, [key]: claim } }));
  }, []);
  const setName = useCallback((name: string) => {
    setState((s) => ({ ...s, name: name.trim() || undefined }));
  }, []);
  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setState((s) => ({ ...s, settings: { ...s.settings, ...patch } }));
  }, []);
  const resetAll = useCallback(() => {
    setState({ ...EMPTY, settings: { ...EMPTY.settings, demo: true } });
  }, []);

  const value = useMemo<GameContext>(
    () => ({
      ...state,
      ready,
      now: wallNow + state.settings.timeOffset,
      setDraft,
      lockEntry,
      setRoundPrices,
      setClaim,
      setName,
      updateSettings,
      resetAll,
    }),
    [state, ready, wallNow, setDraft, lockEntry, setRoundPrices, setClaim, setName, updateSettings, resetAll],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useGame(): GameContext {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useGame must be used inside <GameProvider>");
  return ctx;
}
