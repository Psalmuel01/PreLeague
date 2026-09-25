import { describe, expect, it } from "vitest";
import { settle, validatePicks } from "./settlement";
import type { Snapshot } from "./scoring";

const MIN = 60_000;
const T0 = 1_800_000_000_000;
const T1 = T0 + 15 * MIN;

function series(symbol: string, start: number, end: number, from = T0, to = T1): Snapshot[] {
  const out: Snapshot[] = [];
  const steps = (to - from) / MIN;
  for (let i = 0; i <= steps; i++) {
    out.push({ symbol, tokenPrice: start + ((end - start) * i) / steps, capturedAt: from + i * MIN });
  }
  return out;
}

const SYMBOLS = ["A", "B", "C", "D"];
const snaps = [...series("A", 100, 110), ...series("B", 100, 95), ...series("C", 50, 51), ...series("D", 10, 10)];

describe("settle", () => {
  it("ranks entries on averaged boundary prices", () => {
    const out = settle({
      startsAt: T0,
      endsAt: T1,
      symbols: SYMBOLS,
      snapshots: snaps,
      entries: [
        { wallet: "bear", picks: ["B", "C", "D"], lockedAt: T0 - MIN },
        { wallet: "bull", picks: ["A", "C", "D"], lockedAt: T0 - 2 * MIN },
      ],
    });
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.winner).toBe("bull");
    expect(out.results.map((r) => [r.wallet, r.rank])).toEqual([
      ["bull", 1],
      ["bear", 2],
    ]);
    // Start = mean of first 3 snapshots of A (100, 100.667, 101.333) = 100.667
    expect(out.startPrices.A).toBeCloseTo(100.6667, 3);
    expect(out.endPrices.A).toBeCloseTo(109.3333, 3);
  });

  it("refuses to settle when a boundary price is stale", () => {
    const gappy = snaps.filter((s) => !(s.symbol === "C" && s.capturedAt > T1 - 5 * MIN));
    const out = settle({ startsAt: T0, endsAt: T1, symbols: SYMBOLS, snapshots: gappy, entries: [] });
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.reason).toMatch(/end price for C/);
  });

  it("settles an empty league with no winner", () => {
    const out = settle({ startsAt: T0, endsAt: T1, symbols: SYMBOLS, snapshots: snaps, entries: [] });
    expect(out.ok && out.winner).toBe(null);
  });

  it("is deterministic regardless of entry order", () => {
    const entries = [
      { wallet: "x", picks: ["A", "B", "C"], lockedAt: 5 },
      { wallet: "y", picks: ["A", "B", "C"], lockedAt: 3 },
      { wallet: "z", picks: ["D", "C", "A"], lockedAt: 4 },
    ];
    const a = settle({ startsAt: T0, endsAt: T1, symbols: SYMBOLS, snapshots: snaps, entries });
    const b = settle({ startsAt: T0, endsAt: T1, symbols: SYMBOLS, snapshots: [...snaps].reverse(), entries: [...entries].reverse() });
    expect(a).toEqual(b);
    // x and y tie exactly; y locked first.
    if (a.ok) expect(a.results.findIndex((r) => r.wallet === "y")).toBeLessThan(a.results.findIndex((r) => r.wallet === "x"));
  });
});

describe("validatePicks", () => {
  const pool = ["A", "B", "C", "D"];
  it("accepts exactly three distinct pool companies", () => {
    expect(validatePicks(["A", "B", "C"], pool)).toBeNull();
  });
  it("rejects too few, too many, duplicates and outsiders", () => {
    expect(validatePicks(["A", "B"], pool)).toMatch(/exactly 3/);
    expect(validatePicks(["A", "B", "C", "D"], pool)).toMatch(/exactly 3/);
    expect(validatePicks(["A", "A", "B"], pool)).toMatch(/once/);
    expect(validatePicks(["A", "B", "Z"], pool)).toMatch(/Z/);
    expect(validatePicks("A,B,C", pool)).toMatch(/list/);
  });
});
