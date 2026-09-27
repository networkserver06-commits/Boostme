import { describe, expect, it } from "vitest";
import { HIGH_COST_RETAIL_MULTIPLIER, LOW_COST_RETAIL_MULTIPLIER, calculateTieredRetailRatePer1k, formatTieredRetailRatePer1k } from "./pricing";

describe("tiered retail pricing", () => {
  it("applies a 150% markup through the KES 20.00 threshold", () => {
    expect(LOW_COST_RETAIL_MULTIPLIER).toBe(2.5);
    expect(calculateTieredRetailRatePer1k(20)).toBe(50);
    expect(formatTieredRetailRatePer1k("0.88")).toBe("2.2000");
  });

  it("applies a 40% markup above the KES 20.00 threshold", () => {
    expect(HIGH_COST_RETAIL_MULTIPLIER).toBe(1.4);
    expect(formatTieredRetailRatePer1k(41.26)).toBe("57.7640");
  });

  it("rejects invalid provider rates rather than importing a zero value", () => {
    expect(() => calculateTieredRetailRatePer1k("not-a-number")).toThrow("invalid wholesale rate");
    expect(() => calculateTieredRetailRatePer1k(-1)).toThrow("invalid wholesale rate");
  });
});
