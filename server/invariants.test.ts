import { describe, expect, it } from "vitest";
import { applyWalletDelta } from "./db";
import { OUTSTANDING_ORDER_STATUSES } from "./scheduled";

describe("wallet invariants", () => {
  it("rounds wallet deltas to cents", () => {
    expect(applyWalletDelta(100, -12.345)).toBe(87.66);
    expect(applyWalletDelta(10, 5)).toBe(15);
  });

  it("rejects negative balances", () => {
    expect(() => applyWalletDelta(10, -10.01)).toThrow("Balance cannot become negative");
  });
});

describe("scheduled order polling", () => {
  it("includes pending, in-progress, and partial orders", () => {
    expect(OUTSTANDING_ORDER_STATUSES).toEqual(["pending", "in_progress", "partial"]);
  });
});
