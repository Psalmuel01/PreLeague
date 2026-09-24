import { describe, expect, it } from "vitest";
import {
  StalePriceError,
  assetReturn,
  contribution,
  endPrice,
  portfolioReturn,
  rankEntries,
  startPrice,
  type Snapshot,
} from "./scoring";

const MIN = 60_000;

describe("assetReturn", () => {
  it("is the percentage change", () => {
    expect(assetReturn(1320, 1359.6)).toBeCloseTo(0.03, 10);
    expect(assetReturn(1030, 1024.85)).toBeCloseTo(-0.005, 10);
  });

  it("rejects zero, negative and non-finite prices", () => {
    expect(() => assetReturn(0, 10)).toThrow(RangeError);
    expect(() => assetReturn(10, -1)).toThrow(RangeError);
    expect(() => assetReturn(NaN, 10)).toThrow(RangeError);
  });
});

describe("portfolioReturn", () => {
  it("equal-weights the picks (brief example: +6, +3, −1 → +2.67%)", () => {
    expect(portfolioReturn([0.06, 0.03, -0.01])).toBeCloseTo(0.026667, 5);
  });

  it("matches the How-it-works example (+6, +3, −3 → +2.00%)", () => {
    expect(portfolioReturn([0.06, 0.03, -0.03])).toBeCloseTo(0.02, 10);
  });

  it("contributions sum to the portfolio return", () => {
    const rs = [0.042, 0.021, 0.022];
    const sum = rs.reduce((s, r) => s + contribution(r), 0);
    expect(sum).toBeCloseTo(portfolioReturn(rs), 12);
  });
});

describe("boundary prices", () => {
  const t0 = 1_000_000;
  const snaps: Snapshot[] = [
    { symbol: "SPACEX", tokenPrice: 100, capturedAt: t0 - MIN }, // before kick-off: ignored for start
    { symbol: "SPACEX", tokenPrice: 110, capturedAt: t0 },
    { symbol: "SPACEX", tokenPrice: 112, capturedAt: t0 + MIN },
    { symbol: "SPACEX", tokenPrice: 114, capturedAt: t0 + 2 * MIN },
    { symbol: "SPACEX", tokenPrice: 999, capturedAt: t0 + 3 * MIN }, // beyond 3 samples
    { symbol: "OPENAI", tokenPrice: 1300, capturedAt: t0 },
  ];

  it("start price averages the first N snapshots at or after kick-off", () => {
    expect(startPrice(snaps, "SPACEX", t0)).toBeCloseTo(112, 10);
  });

  it("end price averages the last N snapshots at or before the whistle", () => {
    expect(endPrice(snaps, "SPACEX", t0 + 2 * MIN)).toBeCloseTo(112, 10);
  });

  it("ignores snapshots for other symbols and invalid prices", () => {
    const withBad = [...snaps, { symbol: "SPACEX", tokenPrice: 0, capturedAt: t0 }];
    expect(startPrice(withBad, "SPACEX", t0, { samples: 1 })).toBe(110);
  });

  it("throws instead of using a stale price", () => {
    expect(() => startPrice(snaps, "OPENAI", t0 + 10 * MIN)).toThrow(StalePriceError);
    expect(() => endPrice(snaps, "OPENAI", t0 + 10 * MIN, { maxStalenessMs: 5 * MIN })).toThrow(
      StalePriceError,
    );
  });
});

describe("rankEntries", () => {
  const returns = { a: 0.05, b: 0.02, c: -0.01, d: 0.03, e: 0.0, f: 0.04 };

  it("orders by portfolio return, highest first", () => {
    const ranked = rankEntries(
      [
        { id: "low", picks: ["c", "e", "b"], lockedAt: 1 },
        { id: "high", picks: ["a", "d", "f"], lockedAt: 2 },
      ],
      returns,
    );
    expect(ranked.map((r) => [r.id, r.rank])).toEqual([
      ["high", 1],
      ["low", 2],
    ]);
    expect(ranked[0].portfolioReturn).toBeCloseTo(0.04, 10);
  });

  it("breaks a tie on the best single pick", () => {
    // Both average 0.02: [0.05, 0.02, -0.01] vs [0.03, 0.03, 0.0]
    const ranked = rankEntries(
      [
        { id: "steady", picks: ["d", "d", "e"], lockedAt: 1 },
        { id: "spiky", picks: ["a", "b", "c"], lockedAt: 2 },
      ],
      returns,
    );
    expect(ranked[0].id).toBe("spiky");
  });

  it("then on the second-best pick, then the earlier lock", () => {
    const r = { x: 0.06, y: 0.0, z: 0.03, w: 0.03 };
    // [0.06, 0.03, 0.00] vs [0.06, 0.00, 0.03]: identical sorted → falls to lock time
    const ranked = rankEntries(
      [
        { id: "late", picks: ["x", "z", "y"], lockedAt: 20 },
        { id: "early", picks: ["x", "y", "w"], lockedAt: 10 },
      ],
      r,
    );
    expect(ranked.map((e) => e.id)).toEqual(["early", "late"]);
  });

  it("is independent of input order", () => {
    const entries = [
      { id: "1", picks: ["a", "b", "c"], lockedAt: 5 },
      { id: "2", picks: ["d", "e", "f"], lockedAt: 3 },
      { id: "3", picks: ["a", "d", "f"], lockedAt: 4 },
    ];
    const forward = rankEntries(entries, returns).map((e) => e.id);
    const reversed = rankEntries([...entries].reverse(), returns).map((e) => e.id);
    expect(forward).toEqual(reversed);
  });

  it("refuses to score a pick with no return", () => {
    expect(() => rankEntries([{ id: "1", picks: ["nope"], lockedAt: 0 }], returns)).toThrow(
      RangeError,
    );
  });
});
