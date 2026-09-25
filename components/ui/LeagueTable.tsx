"use client";

import { useState } from "react";
import { COMPANY_BY_ID } from "@/lib/companies";
import type { Standing } from "@/lib/hooks/useRound";
import { Avatar, Delta, LogoStack, Medal, Move } from "./bits";
import { Icon } from "./Icon";

type Props = {
  rows: Standing[];
  /** "live" shows movement arrows; "final" shows medals for the podium. */
  mode: "live" | "final";
  compact?: boolean;
  limit?: number;
  expandable?: boolean;
  cols?: string;
};

export function LeagueTable({ rows, mode, compact, limit, expandable = true, cols }: Props) {
  const [expanded, setExpanded] = useState(false);
  const top = limit && !expanded ? rows.slice(0, limit) : rows;
  // Always keep your own row visible, pinned under the cut if needed.
  const you = rows.find((r) => r.you);
  const shown = you && !top.includes(you) ? [...top, you] : top;
  const style = { "--lb-cols": cols ?? (compact ? "84px minmax(0, 1fr) 140px" : "76px minmax(0, 1fr) minmax(0, 1.5fr) 110px") } as React.CSSProperties;

  return (
    <>
      <div className="lb" style={style} role="table" aria-label="League table">
        <div className="lb-head" role="row">
          <span role="columnheader">Pos</span>
          <span role="columnheader">Manager</span>
          {!compact && (
            <span role="columnheader" className="h-squad">
              Squad
            </span>
          )}
          <span role="columnheader" style={{ textAlign: "right" }}>
            Return
          </span>
        </div>
        {shown.map((r) => (
          <div key={r.id} className={["lb-row", r.you ? "you" : "", r.you && !top.includes(r) ? "pinned" : ""].join(" ")} role="row">
            <span className="lb-rank" role="cell">
              {mode === "final" && r.rank <= 3 ? (
                <Medal rank={r.rank} />
              ) : (
                <>
                  {mode === "live" && <Move n={r.move} />}
                  {r.rank}
                </>
              )}
            </span>
            <span className="lb-player" role="cell">
              <Avatar initials={r.initials} tone={r.avatar} />
              <span className={["name", r.mono ? "mono" : ""].join(" ")} style={r.mono ? { fontSize: 14 } : undefined}>
                {r.name}
              </span>
              {r.you && <span className="you-tag">You</span>}
            </span>
            {!compact && (
              <span className="lb-picks" role="cell">
                <LogoStack ids={r.picks} />
                <span className="picks-text">{r.picks.map((p) => COMPANY_BY_ID[p].name).join(" · ")}</span>
              </span>
            )}
            <span className="lb-return" role="cell">
              <Delta value={r.portfolioReturn} />
            </span>
          </div>
        ))}
      </div>
      {expandable && limit && rows.length > limit && (
        <div style={{ display: "flex", justifyContent: "center", padding: "16px 24px", borderTop: "1px solid var(--line)" }}>
          <button type="button" className="btn btn-secondary" aria-expanded={expanded} onClick={() => setExpanded((e) => !e)}>
            {expanded ? "Show top " + limit : `Show all ${rows.length} managers`}
            <Icon name={expanded ? "chevronUp" : "chevronDown"} size="sm" />
          </button>
        </div>
      )}
    </>
  );
}
