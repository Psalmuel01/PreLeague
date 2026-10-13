import { describe, expect, it } from "vitest";
import { LEAGUES, joinableRound, roundAt } from "./leagues";
describe("recurring schedules", () => {
  it("offers a future draft window for every league after the original launch month", () => {
    const now = Date.UTC(2026, 9, 13, 6);
    for (const league of LEAGUES) {
      const next = joinableRound(league, now)!;
      expect(next.kickoff).toBeGreaterThan(now);
      expect(next.round).toBeGreaterThan(1);
      expect(roundAt(league, next.kickoff + (league.schedule.kind === "recurring" ? league.schedule.periodMs : 0), now).round).toBe(next.round + 1);
    }
  });
});
