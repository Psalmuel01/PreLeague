import Image from "next/image";
import { COMPANY_BY_ID, type CompanyId } from "@/lib/companies";
import { clockParts, direction, durationLabel, pct } from "@/lib/format";
import { Icon } from "./Icon";

// Small presentational pieces of the Matchday system.

export function CoLogo({
  id,
  size,
  className,
  style,
}: {
  id: CompanyId;
  size?: "xs" | "sm" | "lg" | "xl";
  className?: string;
  style?: React.CSSProperties;
}) {
  const c = COMPANY_BY_ID[id];
  return (
    <span
      className={["logo", size ? `logo-${size}` : "", className ?? ""].filter(Boolean).join(" ")}
      style={{ background: c.fill, ...style }}
      aria-hidden="true"
    >
      <CoImg id={id} />
    </span>
  );
}

/** The company's official logo, filling its (positioned) tile. */
export function CoImg({ id, size = 64 }: { id: CompanyId; size?: number }) {
  const c = COMPANY_BY_ID[id];
  return <Image className="co-img" src={c.logo} alt="" fill sizes={`${size}px`} draggable={false} />;
}

export function LogoStack({ ids, size = "xs", label }: { ids: CompanyId[]; size?: "xs" | "sm"; label?: string }) {
  return (
    <span className="logos" aria-label={label ?? ids.map((i) => COMPANY_BY_ID[i].name).join(", ")} role="img">
      {ids.map((id) => (
        <CoLogo key={id} id={id} size={size} />
      ))}
    </span>
  );
}

export function Delta({
  value,
  className,
  style,
  digits = 2,
}: {
  value: number;
  className?: string;
  style?: React.CSSProperties;
  digits?: number;
}) {
  return (
    <span className={["delta", direction(value), className ?? ""].filter(Boolean).join(" ")} style={style}>
      {pct(value, digits)}
    </span>
  );
}

export function Move({ n }: { n: number }) {
  const kind = n > 0 ? "up" : n < 0 ? "down" : "same";
  const label = n > 0 ? `Up ${n}` : n < 0 ? `Down ${-n}` : "No change";
  return (
    <span className={`mv mv-${kind}`} role="img" aria-label={label}>
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d={kind === "up" ? "m6 14 6-6 6 6" : kind === "down" ? "m6 10 6 6 6-6" : "M6 12h12"} />
      </svg>
    </span>
  );
}

export function Avatar({
  initials,
  tone,
  size,
  style,
}: {
  initials: string;
  tone: string;
  size?: "sm" | "lg" | "xl";
  style?: React.CSSProperties;
}) {
  return (
    <span className={["avatar", size ? `avatar-${size}` : "", tone].filter(Boolean).join(" ")} style={style} aria-hidden="true">
      {initials}
    </span>
  );
}

export function Medal({ rank, size }: { rank: number; size?: number }) {
  return (
    <span
      className={`medal podium-${rank}`}
      style={size ? { width: size, height: size, fontSize: size * 0.55 } : undefined}
      aria-label={["First", "Second", "Third"][rank - 1] + " place"}
    >
      {rank}
    </span>
  );
}

export function Clock({
  ms,
  variant,
  label,
  role,
}: {
  ms: number;
  variant?: "xl" | "lg" | "board" | "sm" | "card-sm";
  label: string;
  role?: "timer";
}) {
  const { parts } = clockParts(ms);
  return (
    <div className={["clock", variant ?? ""].filter(Boolean).join(" ")} role={role} aria-label={`${label} ${durationLabel(ms)}`}>
      <span className="d" aria-hidden="true">{parts[0]}</span>
      <span className="sep" aria-hidden="true">:</span>
      <span className="d" aria-hidden="true">{parts[1]}</span>
    </div>
  );
}

export function clockUnitLabel(ms: number): string {
  const { unit } = clockParts(ms);
  return unit === "ms" ? "min : sec" : unit === "hm" ? "hr : min" : "days : hr";
}

export function PrizeLine({
  company,
  usd,
  size,
  br = true,
}: {
  company: CompanyId;
  usd: number;
  size?: "sm" | "lg";
  br?: boolean;
}) {
  const c = COMPANY_BY_ID[company];
  return (
    <div className="fact-prize">
      <CoLogo id={company} size={size} />
      <span>
        ${usd} in {c.name}
        {br ? <br /> : " "}PreStock
      </span>
    </div>
  );
}

export function Badge({
  kind,
  children,
  style,
}: {
  kind: "live" | "soon" | "done" | "full" | "joined" | "won" | "locked" | "xp" | "warn";
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <span className={`badge badge-${kind}`} style={style}>
      {kind === "live" && <span className="live-dot" />}
      {kind === "joined" && <Icon name="check" style={{ width: 14, height: 14 }} strokeWidth={2.6} />}
      {kind === "locked" && <Icon name="lock" style={{ width: 14, height: 14 }} />}
      {children}
    </span>
  );
}

export function Progress({ value, tone }: { value: number; tone?: "full" }) {
  return (
    <div className="progress" aria-hidden="true">
      <span style={{ width: `${Math.min(100, Math.max(0, value * 100))}%`, background: tone === "full" ? "var(--ink-3)" : undefined }} />
    </div>
  );
}

export function Achv({
  icon,
  tone,
  small,
  className,
  children,
}: {
  icon?: "trophy" | "chart" | "clock" | "lock";
  tone?: "gold" | "blue" | "locked";
  small?: boolean;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <span className={["achv", small ? "achv-sm" : "", tone ?? "", className ?? ""].filter(Boolean).join(" ")} aria-hidden="true">
      {icon ? <Icon name={icon} /> : children}
    </span>
  );
}
