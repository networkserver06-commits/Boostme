import { describe, expect, it } from "vitest";
import { HIGH_COST_RETAIL_MULTIPLIER, LOW_COST_RETAIL_MULTIPLIER, calculateTieredRetailRatePer1k, formatTieredRetailRatePer1k } from "./pricing";

describe("tiered retail pricing", () => {
  it("applies a 50% markup through the KES 20.00 threshold", () => {
    expect(LOW_COST_RETAIL_MULTIPLIER).toBe(1.5);
    expect(calculateTieredRetailRatePer1k(20)).toBe(30);
    expect(formatTieredRetailRatePer1k("0.88")).toBe("3.0000");
  });

  it("applies a 20% markup above the KES 20.00 threshold", () => {
    expect(HIGH_COST_RETAIL_MULTIPLIER).toBe(1.2);
    expect(formatTieredRetailRatePer1k(41.26)).toBe("49.5120");
  });

  it("rejects invalid provider rates rather than importing a zero value", () => {
    expect(() => calculateTieredRetailRatePer1k("not-a-number")).toThrow("invalid wholesale rate");
    expect(() => calculateTieredRetailRatePer1k(-1)).toThrow("invalid wholesale rate");
  });
});
