import { describe, expect, it } from "vitest";
import { settlementReceipt, type SettlementReceipt } from "./receipt";
const payload: SettlementReceipt = { leagueId: "sprint-r1", round: 1, startsAt: "2026-10-13T12:00:00.000Z", endsAt: "2026-10-13T12:15:00.000Z", startPrices: { SPACEX: 10, OPENAI: 5 }, endPrices: { SPACEX: 12, OPENAI: 6 }, winningWallet: "wallet", winningScore: 0.2, settledAt: "2026-10-13T12:16:00.000Z" };
describe("settlement commitment", () => {
  it("is stable across object insertion order and JSON database round trips", () => {
    const reordered = { ...payload, startPrices: { OPENAI: 5, SPACEX: 10 } };
    expect(settlementReceipt(reordered).hash).toBe(settlementReceipt(JSON.parse(JSON.stringify(payload))).hash);
  });
  it("commits to the winner, price boundaries, score, and timestamps", () => {
    for (const change of [{ winningWallet: "other" }, { winningScore: 0.1 }, { startPrices: { SPACEX: 11, OPENAI: 5 } }, { endsAt: "changed" }]) expect(settlementReceipt({ ...payload, ...change }).hash).not.toBe(settlementReceipt(payload).hash);
  });
  it("rejects non-finite prices", () => { expect(() => settlementReceipt({ ...payload, endPrices: { OPENAI: Infinity } })).toThrow(); });
});
