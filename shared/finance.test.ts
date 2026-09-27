import { describe, expect, it } from "vitest";
import { calculateOrderEconomics, calculateServiceEconomics, summarizeProfit } from "./finance";

describe("finance calculations", () => {
  it("calculates revenue, provider cost, profit, and margin per 1k", () => {
    expect(calculateServiceEconomics({ quantity: 1000, retailRatePer1k: "35.00", wholesaleRatePer1k: "12.50" })).toMatchObject({ revenue: 35, providerCost: 12.5, profit: 22.5, marginPercent: 64.29 });
  });

  it("excludes failed and canceled orders from realized revenue and cost", () => {
    expect(calculateOrderEconomics({ quantity: 1000, charge: 35, retailRatePer1k: 35, wholesaleRatePer1k: 12.5, status: "canceled" })).toMatchObject({ revenue: 0, providerCost: 0, profit: 0, estimatedProfit: 22.5 });
  });

  it("subtracts refunds from net profit", () => {
    expect(summarizeProfit({ orders: [{ quantity: 1000, charge: 35, retailRatePer1k: 35, wholesaleRatePer1k: 12.5, status: "completed" }], refunds: [5] })).toMatchObject({ grossRevenue: 35, providerCost: 12.5, refunds: 5, netRevenue: 30, profit: 17.5, marginPercent: 50 });
  });

  it("does not turn a fully refunded cancellation into a loss", () => {
    expect(summarizeProfit({ orders: [{ quantity: 1000, charge: 35, retailRatePer1k: 35, wholesaleRatePer1k: 12.5, status: "canceled" }], refunds: [35] })).toMatchObject({ grossRevenue: 35, providerCost: 0, netRevenue: 0, profit: 0 });
  });
});
