"use client";

import { useState } from "react";
import { useGame } from "@/components/providers/GameProvider";
import { usePrices } from "@/components/providers/PriceProvider";
import { DEFAULT_LEAGUE, currentRound } from "@/lib/leagues";
import { timeOfDay } from "@/lib/format";
import { Icon } from "@/components/ui/Icon";

// Demo controls for recording a walkthrough: jump the clock between round
// phases and optionally switch to (clearly labelled) simulated prices.
// Shown when the app is opened with ?demo, hidden with ?demo=0.
export function DemoPanel() {
  const { settings, updateSettings, now, ready, resetAll } = useGame();
  const { simulated } = usePrices();
  const [open, setOpen] = useState(false);
  if (!ready || !settings.demo) return null;

  const round = currentRound(DEFAULT_LEAGUE, now);
  const jumpTo = (target: number) => updateSettings({ timeOffset: settings.timeOffset + (target - now) });

  return (
    <div className="demo-panel">
      {open ? (
        <div className="card" role="dialog" aria-label="Demo controls">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <span className="eyebrow">Demo controls</span>
            <button type="button" className="icon-btn" aria-label="Close demo controls" onClick={() => setOpen(false)} style={{ width: 36, height: 36 }}>
              <Icon name="close" size="sm" />
            </button>
          </div>
          <div className="small muted">
            Clock {settings.timeOffset ? "shifted" : "real"} · {timeOfDay(now)} · {DEFAULT_LEAGUE.name} R{round.round} {round.phase}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => jumpTo(round.phase === "upcoming" ? round.kickoff - 20_000 : round.kickoff + 30 * 60_000 - 20_000)}>
              Deadline −20s
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => jumpTo(round.phase === "live" ? round.endsAt - 30_000 : round.kickoff + 60_000)}>
              {round.phase === "live" ? "Whistle −30s" : "Kick off"}
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => jumpTo(round.phase === "live" ? round.endsAt + 5_000 : round.kickoff + 5 * 60_000)} >
              {round.phase === "live" ? "Full time" : "+5 min"}
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => updateSettings({ timeOffset: 0 })} disabled={!settings.timeOffset}>
              Real time
            </button>
          </div>
          <label className="row" style={{ justifyContent: "space-between", gap: 12, fontSize: 14, fontWeight: 700 }}>
            Simulated prices
            <button
              type="button"
              role="switch"
              className="toggle"
              aria-checked={simulated}
              onClick={() => updateSettings({ simulated: !settings.simulated })}
            />
          </label>
          <p className="caption">Simulated prices are labelled everywhere they appear. Real play uses the PreStocks API.</p>
          <button type="button" className="btn btn-ghost btn-sm" onClick={resetAll}>
            Reset local data
          </button>
        </div>
      ) : (
        <button type="button" className="demo-fab" aria-label="Open demo controls" onClick={() => setOpen(true)}>
          DEMO
        </button>
      )}
    </div>
  );
}
