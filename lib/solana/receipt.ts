import { createHash } from "node:crypto";
export type SettlementReceipt = {
  leagueId: string; round: number; startsAt: string; endsAt: string;
  startPrices: Record<string, number>; endPrices: Record<string, number>;
  winningWallet: string | null; winningScore: number | null; settledAt: string;
};
function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") {
    if (typeof value === "number" && !Number.isFinite(value)) throw new Error("Non-finite settlement value");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  const obj = value as Record<string, unknown>;
  return `{${Object.keys(obj).sort().map(k => `${JSON.stringify(k)}:${canonical(obj[k])}`).join(",")}}`;
}
export function settlementReceipt(payload: SettlementReceipt) {
  const serialized = canonical(payload);
  return { payload, serialized, hash: createHash("sha256").update(serialized).digest("hex") };
}
