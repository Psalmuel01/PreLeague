import { describe, expect, it } from "vitest";
import { sumExpr } from "./format";

describe("sumExpr", () => {
  it("writes negative terms as a minus, never '+ −'", () => {
    expect(sumExpr([0.0218, 0, -0.0001])).toBe("+2.18 + 0.00 − 0.01");
    expect(sumExpr([-0.0032, 0.0015, 0])).toBe("−0.32 + 0.15 + 0.00");
  });
});
