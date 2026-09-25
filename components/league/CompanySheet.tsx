"use client";

import { useMemo } from "react";
import { COMPANY_BY_ID, type CompanyId } from "@/lib/companies";
import { usd } from "@/lib/format";
import type { RoundView } from "@/lib/hooks/useRound";
import { usePrices } from "@/components/providers/PriceProvider";
import { useGame } from "@/components/providers/GameProvider";
import { Avatar, Badge, Delta } from "@/components/ui/bits";
import { Icon } from "@/components/ui/Icon";
import { Sparkline } from "./Sparkline";

/** A company's round so far: return, start/now prices, price path, who picked it. */
export function CompanySheet({ id, view, onClose }: { id: CompanyId; view: RoundView; onClose: () => void }) {
  const c = COMPANY_BY_ID[id];
  const { history } = usePrices();
  const { now } = useGame();
  const start = view.boundary.start?.[c.symbol];
  const current = view.nowPrices?.[c.symbol];
  const r = view.returns?.[id];
  const mine = view.entry?.picks.includes(id);
  const pickers = view.managers.filter((m) => m.picks.includes(id));

  const points = useMemo<[number, number][]>(() => {
    const from = view.boundary.startAt;
    const to = view.round.phase === "final" ? view.round.endsAt : now;
    const pts = history.filter((s) => s.symbol === c.symbol && s.capturedAt >= from && s.capturedAt <= to).map((s) => [s.capturedAt, s.tokenPrice] as [number, number]);
    if (start && (pts.length === 0 || pts[0][0] > from)) pts.unshift([from, start]);
    if (current && view.nowAt && (pts.length === 0 || pts[pts.length - 1][0] < view.nowAt)) pts.push([view.nowAt, current]);
    return pts;
  }, [view.boundary.startAt, view.round, view.nowAt, now, c.symbol, history, start, current]);

  return (
    <>
      <div className="pl-scrim" onClick={onClose} aria-hidden="true" />
      <section className="pl-sheet as-modal stack" role="dialog" aria-modal="true" aria-label={`${c.name} this round`} style={{ gap: 16 }}>
        <div className="grabber" />
        <div className="company-hero">
          <span className="band-slash thin" style={{ right: 40, opacity: 0.9 }} aria-hidden="true" />
          <div className="kit-shirt" style={{ background: c.fill, flexShrink: 0 }}>
            <span className="mono-mark" style={{ color: c.ink }}>
              {c.mono}
            </span>
          </div>
          <div className="stack" style={{ position: "relative", gap: 6, minWidth: 0, flexGrow: 1 }}>
            <h2 className="h-2" style={{ fontSize: 38, color: "#fff" }}>
              {c.name}
            </h2>
            <span className="row wrap" style={{ gap: 8 }}>
              <span className="mono" style={{ fontSize: 11.5, color: "#fff", background: "rgba(10,20,64,.55)", padding: "3px 7px", borderRadius: 5 }}>
                {c.symbol}
              </span>
              {mine && <Badge kind="joined" style={{ height: 24, fontSize: 12.5 }}>In your squad</Badge>}
            </span>
          </div>
          <button type="button" className="icon-btn" aria-label="Close" onClick={onClose} style={{ position: "absolute", top: 10, right: 10, background: "#fff", borderRadius: "50%", color: "var(--navy)" }}>
            <Icon name="close" />
          </button>
        </div>

        <div className="row" style={{ alignItems: "flex-end", justifyContent: "space-between", gap: 12 }}>
          <div className="stack" style={{ gap: 6 }}>
            <span className="cd-label">This round</span>
            {r !== undefined ? <Delta value={r} className="fig-xl" style={{ fontSize: 56 }} /> : <span className="fig-xl">—</span>}
          </div>
          <div className="num stack" style={{ gap: 4, paddingBottom: 2, fontSize: 13, textAlign: "right" }}>
            <span>
              <span className="faint">Start</span> <span style={{ fontWeight: 700, color: "var(--ink-2)" }}>{start ? usd(start) : "—"}</span>
            </span>
            <span>
              <span className="faint">{view.round.phase === "final" ? "End" : "Now"}</span> <span style={{ fontWeight: 700 }}>{current ? usd(current) : "—"}</span>
            </span>
          </div>
        </div>

        <figure className="stack" style={{ margin: 0, gap: 6 }}>
          <Sparkline points={points} />
          <figcaption className="row" style={{ justifyContent: "space-between" }}>
            <span className="caption">Round start</span>
            <span className="caption">{view.round.phase === "final" ? "Final whistle" : "Now"}</span>
          </figcaption>
        </figure>

        <div className="stack">
          <div className="kv" style={{ borderTop: "1px solid var(--line)" }}>
            <span className="k">Picked by</span>
            <span className="v row" style={{ gap: 8 }}>
              <span className="avatars">
                {pickers.slice(0, 4).map((m) => (
                  <Avatar key={m.id} initials={m.initials} tone={m.avatar} size="sm" />
                ))}
              </span>
              {pickers.length} of {view.managers.length} managers
            </span>
          </div>
          <div className="kv" style={{ borderTop: "1px solid var(--line)" }}>
            <span className="k">About</span>
            <span style={{ fontWeight: 500, textAlign: "right" }}>{c.about}</span>
          </div>
          <div className="kv" style={{ borderTop: "1px solid var(--line)" }}>
            <span className="k">Mint</span>
            <a className="mono" style={{ fontSize: 12.5 }} href={`https://solscan.io/token/${c.mint}`} target="_blank" rel="noreferrer">
              {c.mint.slice(0, 4)}…{c.mint.slice(-4)}
            </a>
          </div>
        </div>

        <button type="button" className="btn btn-secondary btn-lg btn-block" onClick={onClose}>
          Close
        </button>
      </section>
    </>
  );
}
