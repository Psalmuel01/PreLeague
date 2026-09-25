"use client";

import { Avatar, Badge } from "@/components/ui/bits";

export function LevelCard({
  name,
  initials,
  xp,
  level,
}: {
  name: string;
  initials: string;
  xp: number;
  level: { level: number; title: string; next: number | null; progress: number };
}) {
  return (
    <div
      style={{ background: "var(--navy-2)", borderRadius: 16, padding: "20px 22px", display: "flex", flexDirection: "column", gap: 14, boxShadow: "0 0 0 1px var(--navy-line)" }}
      aria-label={`Your level: Level ${level.level}, ${level.title}, ${xp} XP`}
    >
      <div className="row" style={{ gap: 14 }}>
        <Avatar initials={initials} tone="av-you" size="lg" />
        <div className="stack" style={{ gap: 4, flexGrow: 1, minWidth: 0 }}>
          <span className="title" style={{ color: "#fff" }}>
            {name}
          </span>
          <span className="eyebrow" style={{ color: "var(--lime)" }}>
            Level {level.level} · {level.title}
          </span>
        </div>
        <Badge kind="xp">Lv {level.level}</Badge>
      </div>
      <div className="xp" aria-hidden="true">
        <span style={{ width: `${Math.max(2, level.progress * 100)}%` }} />
      </div>
      <div className="row" style={{ justifyContent: "space-between", fontSize: 13 }}>
        <span className="num" style={{ fontWeight: 700, color: "#fff" }}>
          {xp.toLocaleString()} {level.next ? `/ ${level.next.toLocaleString()} XP` : "XP"}
        </span>
        {level.next && <span style={{ color: "var(--navy-ink-2)" }}>{(level.next - xp).toLocaleString()} XP to Level {level.level + 1}</span>}
      </div>
    </div>
  );
}
