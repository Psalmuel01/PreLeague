"use client";

import { usePrices } from "@/components/providers/PriceProvider";
import { useGame } from "@/components/providers/GameProvider";

/** Where the numbers come from, and how fresh they are. */
export function PriceSourcePill({ style }: { style?: React.CSSProperties }) {
  const { source, updatedAt } = usePrices();
  const { now, settings } = useGame();
  const wallNow = now - settings.timeOffset;
  const age = updatedAt ? Math.max(0, Math.round((wallNow - updatedAt) / 1000)) : null;
  const text =
    source === "prestocks"
      ? `Live PreStocks prices · updated ${age}s ago`
      : source === "simulated"
        ? "Simulated prices (demo mode)"
        : source === "fallback"
          ? "PreStocks API unreachable · last known prices"
          : "Loading prices…";
  return (
    <span className={`source-pill caption ${source}`} style={style} aria-live="polite">
      <span className="dot" aria-hidden="true" />
      {text}
    </span>
  );
}
