import { describe, expect, it } from "vitest";
import { calculateCheckoutEconomics, calculateOrderEconomics, calculateRecordedOrderEconomics, calculateServiceEconomics, summarizeProfit } from "./finance";

describe("finance calculations", () => {
	it("applies the KSh 10 floor and rejects unsafe margins", () => {
		expect(calculateCheckoutEconomics({ quantity: 50, retailRatePer1k: 0.5, wholesaleRatePer1k: 0.1 })).toMatchObject({ retailAmountCalculated: 0.15, finalRetailCharged: 10, wholesaleCostForQty: 0.01, estimatedProfit: 9.99, isValid: true });
		expect(calculateCheckoutEconomics({ quantity: 1000, retailRatePer1k: 10, wholesaleRatePer1k: 10 })).toMatchObject({ isValid: false });
		expect(calculateCheckoutEconomics({ quantity: 1000, retailRatePer1k: 10.99, wholesaleRatePer1k: 10 })).toMatchObject({ isValid: false });
	});

  it("calculates revenue, provider cost, profit, and margin per 1k", () => {
    expect(calculateServiceEconomics({ quantity: 1000, retailRatePer1k: "35.00", wholesaleRatePer1k: "12.50" })).toMatchObject({ revenue: 35, providerCost: 12.5, profit: 22.5, marginPercent: 64.29 });
  });

  it("excludes failed and canceled orders from realized revenue and cost", () => {
    expect(calculateOrderEconomics({ quantity: 1000, charge: 35, retailRatePer1k: 35, wholesaleRatePer1k: 12.5, status: "canceled" })).toMatchObject({ revenue: 0, providerCost: 0, profit: 0, estimatedProfit: 22.5 });
  });

  it("subtracts refunds from net profit", () => {
    expect(summarizeProfit({ orders: [{ quantity: 1000, charge: 35, retailRatePer1k: 35, wholesaleRatePer1k: 12.5, status: "completed" }], refunds: [5] })).toMatchObject({ grossRevenue: 35, providerCost: 12.5, refunds: 5, netRevenue: 30, profit: 17.5, marginPercent: 58.33 });
  });

	it("does not turn a fully refunded cancellation into a loss", () => {
		expect(summarizeProfit({ orders: [{ quantity: 1000, charge: 35, retailRatePer1k: 35, wholesaleRatePer1k: 12.5, status: "canceled" }], refunds: [35] })).toMatchObject({ grossRevenue: 0, providerCost: 0, netRevenue: 0, profit: 0 });
	});

  it("uses the wholesale and retail values captured at checkout", () => {
    expect(calculateRecordedOrderEconomics({ quantity: 1000, charge: "0.88", retailPaidKes: 0.88, wholesaleCostKes: 41.26, status: "completed" })).toMatchObject({ revenue: 0.88, providerCost: 41.26, profit: -40.38, marginPercent: -4588.64, isLoss: true });
    expect(calculateRecordedOrderEconomics({ quantity: 1000, charge: "57.76", retailPaidKes: 57.76, wholesaleCostKes: 41.26, status: "completed" })).toMatchObject({ profit: 16.5, isLoss: false });
  });
  it("normalizes invalid numeric inputs and cancellation spelling", () => {
    expect(calculateOrderEconomics({ quantity: 1000, charge: -20, retailRatePer1k: -35, wholesaleRatePer1k: 12.5, status: "CANCELLED" })).toMatchObject({ billed: 0, revenue: 0, providerCost: 0, profit: 0 });
    expect(summarizeProfit({ orders: [{ quantity: 1000, charge: 35, retailRatePer1k: 35, wholesaleRatePer1k: 12.5, status: "completed" }], refunds: [-5, "not-a-number"] })).toMatchObject({ refunds: 0, netRevenue: 35, profit: 22.5 });
  });
  it("never calculates a new retail rate below KES 3 per 1k", () => {
    expect(calculateServiceEconomics({ quantity: 1000, retailRatePer1k: 0.5, wholesaleRatePer1k: 0.1 })).toMatchObject({ revenue: 3, providerCost: 0.1, profit: 2.9 });
  });
});
