const MINUS = "−";

/** Signed percentage from a fraction: 0.0283 → "+2.83%". Uses a true minus sign. */
export function pct(fraction: number, digits = 2): string {
  const v = fraction * 100;
  const rounded = Number(v.toFixed(digits));
  if (rounded === 0) return `${(0).toFixed(digits)}%`;
  return `${rounded > 0 ? "+" : MINUS}${Math.abs(rounded).toFixed(digits)}%`;
}

/** Unsigned percentage from a fraction: 0.0029 → "0.29%". */
export function pctAbs(fraction: number, digits = 2): string {
  return `${Math.abs(fraction * 100).toFixed(digits)}%`;
}

export function direction(fraction: number): "up" | "down" | "flat" {
  const v = Number((fraction * 100).toFixed(2));
  return v > 0 ? "up" : v < 0 ? "down" : "flat";
}

export function usd(n: number, digits = 2): string {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function pad2(n: number): string {
  return String(Math.max(0, Math.floor(n))).padStart(2, "0");
}

/** Split a duration into clock digits. Under an hour → mm:ss; otherwise hh:mm; over a day → d:hh. */
export function clockParts(ms: number): { parts: [string, string]; unit: "ms" | "hm" | "dh" } {
  const s = Math.max(0, Math.floor(ms / 1000));
  if (s < 3600) return { parts: [pad2(s / 60), pad2(s % 60)], unit: "ms" };
  if (s < 86400) return { parts: [pad2(s / 3600), pad2((s % 3600) / 60)], unit: "hm" };
  return { parts: [String(Math.floor(s / 86400)), pad2((s % 86400) / 3600)], unit: "dh" };
}

export function durationLabel(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h >= 24) return `${Math.floor(h / 24)} days ${h % 24} hours`;
  if (h > 0) return `${h} hours ${m} minutes`;
  return `${m} minutes ${sec} seconds`;
}

export function shortAddress(addr: string): string {
  return addr.length > 10 ? `${addr.slice(0, 4)}…${addr.slice(-4)}` : addr;
}

export function timeOfDay(ts: number): string {
  return new Date(ts).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export function kickoffLabel(ts: number, now: number): string {
  const d = new Date(ts);
  const today = new Date(now);
  const tomorrow = new Date(now + 86400000);
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (sameDay(d, today)) return timeOfDay(ts);
  if (sameDay(d, tomorrow)) return `Tomorrow ${timeOfDay(ts)}`;
  return `${d.toLocaleDateString("en-US", { weekday: "short" })} ${timeOfDay(ts)}`;
}

export function dateLabel(ts: number): string {
  return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
