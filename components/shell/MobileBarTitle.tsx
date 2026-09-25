export function MobileBarTitle({ title, sub, live }: { title: string; sub: string; live?: boolean }) {
  return (
    <div className="stack" style={{ gap: 4, minWidth: 0 }}>
      <span className="h-3" style={{ fontSize: 21, fontWeight: 800, lineHeight: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {title}
      </span>
      <span className="row" style={{ gap: 8 }}>
        {live && (
          <span className="badge badge-live" style={{ height: 20, padding: "0 7px", fontSize: 12, gap: 6 }}>
            <span className="live-dot" style={{ width: 6, height: 6 }} />
            Live
          </span>
        )}
        <span className="eyebrow" style={{ fontSize: 11, color: "var(--navy-ink-2)" }}>
          {sub}
        </span>
      </span>
    </div>
  );
}
