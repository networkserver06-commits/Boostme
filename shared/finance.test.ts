import { describe, expect, it } from "vitest";
import {
  calculateCheckoutEconomics,
  calculateOrderEconomics,
  calculateRecordedOrderEconomics,
  calculateServiceEconomics,
  minimumQuantityForOrderProfit,
  summarizeProfit,
} from "./finance";

describe("finance calculations", () => {
  it("calculates exact charges and enforces the KES 1 minimum contribution", () => {
    expect(
      calculateCheckoutEconomics({
        quantity: 50,
        retailRatePer1k: 0.5,
        wholesaleRatePer1k: 0.1,
      })
    ).toMatchObject({
      retailAmountCalculated: 0.15,
      finalRetailCharged: 0.15,
      wholesaleCostForQty: 0.01,
      estimatedProfit: 0.14,
      isValid: false,
    });
    expect(
      calculateCheckoutEconomics({
        quantity: 1000,
        retailRatePer1k: 10,
        wholesaleRatePer1k: 10,
      })
    ).toMatchObject({ isValid: false });
    expect(
      calculateCheckoutEconomics({
        quantity: 1000,
        retailRatePer1k: 10.99,
        wholesaleRatePer1k: 10,
      })
    ).toMatchObject({ estimatedProfit: 0.99, isValid: false });
    expect(
      calculateCheckoutEconomics({
        quantity: 1000,
        retailRatePer1k: 10,
        wholesaleRatePer1k: 10.01,
      })
    ).toMatchObject({ isValid: false });
  });

  it("finds the minimum safe quantity after cent rounding", () => {
    const retailRatePer1k = 50.78;
    const wholesaleRatePer1k = 42.3167;
    expect(minimumQuantityForOrderProfit({ minQuantity: 100, maxQuantity: 100000, retailRatePer1k, wholesaleRatePer1k })).toBe(118);
    expect(calculateCheckoutEconomics({ quantity: 100, retailRatePer1k, wholesaleRatePer1k })).toMatchObject({ estimatedProfit: 0.85, isValid: false });
    expect(calculateCheckoutEconomics({ quantity: 118, retailRatePer1k, wholesaleRatePer1k })).toMatchObject({ estimatedProfit: 1, isValid: true });
  });

  it("calculates revenue, provider cost, profit, and margin per 1k", () => {
    expect(
      calculateServiceEconomics({
        quantity: 1000,
        retailRatePer1k: "35.00",
        wholesaleRatePer1k: "12.50",
      })
    ).toMatchObject({
      revenue: 35,
      providerCost: 12.5,
      profit: 22.5,
      marginPercent: 64.29,
    });
  });

  it("excludes failed and canceled orders from realized revenue and cost", () => {
    expect(
      calculateOrderEconomics({
        quantity: 1000,
        charge: 35,
        retailRatePer1k: 35,
        wholesaleRatePer1k: 12.5,
        status: "canceled",
      })
    ).toMatchObject({
      revenue: 0,
      providerCost: 0,
      profit: 0,
      estimatedProfit: 22.5,
    });
  });

  it("subtracts refunds from net profit", () => {
    expect(
      summarizeProfit({
        orders: [
          {
            quantity: 1000,
            charge: 35,
            retailRatePer1k: 35,
            wholesaleRatePer1k: 12.5,
            status: "completed",
          },
        ],
        refunds: [5],
      })
    ).toMatchObject({
      grossRevenue: 35,
      providerCost: 12.5,
      refunds: 5,
      netRevenue: 30,
      profit: 17.5,
      marginPercent: 58.33,
    });
  });

  it("does not turn a fully refunded cancellation into a loss", () => {
    expect(
      summarizeProfit({
        orders: [
          {
            quantity: 1000,
            charge: 35,
            retailRatePer1k: 35,
            wholesaleRatePer1k: 12.5,
            status: "canceled",
          },
        ],
        refunds: [35],
      })
    ).toMatchObject({
      grossRevenue: 0,
      providerCost: 0,
      netRevenue: 0,
      profit: 0,
    });
  });

  it("uses the wholesale and retail values captured at checkout", () => {
    expect(
      calculateRecordedOrderEconomics({
        quantity: 1000,
        charge: "0.88",
        retailPaidKes: 0.88,
        wholesaleCostKes: 41.26,
        status: "completed",
      })
    ).toMatchObject({
      revenue: 0.88,
      providerCost: 41.26,
      profit: -40.38,
      marginPercent: -4588.64,
      isLoss: true,
    });
    expect(
      calculateRecordedOrderEconomics({
        quantity: 1000,
        charge: "57.76",
        retailPaidKes: 57.76,
        wholesaleCostKes: 41.26,
        status: "completed",
      })
    ).toMatchObject({ profit: 16.5, isLoss: false });
  });
  it("uses captured costs and refunds when aggregating historical orders", () => {
    expect(
      summarizeProfit({
        orders: [
          {
            quantity: 1000,
            charge: "57.76",
            retailRatePer1k: 99,
            wholesaleRatePer1k: 1,
            retailPaidKes: 57.76,
            wholesaleCostKes: 41.26,
            refundAmount: 10,
            status: "completed",
          },
        ],
      })
    ).toMatchObject({
      grossRevenue: 57.76,
      providerCost: 41.26,
      refunds: 10,
      netRevenue: 47.76,
      profit: 6.5,
      marginPercent: 13.61,
    });
  });
  it("shows net profit after a completed partial refund", () => {
    expect(
      calculateRecordedOrderEconomics({
        quantity: 1000,
        charge: "57.76",
        retailPaidKes: 57.76,
        wholesaleCostKes: 41.26,
        refundAmount: 10,
        status: "completed",
      })
    ).toMatchObject({
      revenue: 57.76,
      refund: 10,
      netRevenue: 47.76,
      profit: 6.5,
      marginPercent: 13.61,
      isLoss: false,
    });
  });
  it("normalizes invalid numeric inputs and cancellation spelling", () => {
    expect(
      calculateOrderEconomics({
        quantity: 1000,
        charge: -20,
        retailRatePer1k: -35,
        wholesaleRatePer1k: 12.5,
        status: "CANCELLED",
      })
    ).toMatchObject({ billed: 0, revenue: 0, providerCost: 0, profit: 0 });
    expect(
      summarizeProfit({
        orders: [
          {
            quantity: 1000,
            charge: 35,
            retailRatePer1k: 35,
            wholesaleRatePer1k: 12.5,
            status: "completed",
          },
        ],
        refunds: [-5, "not-a-number"],
      })
    ).toMatchObject({ refunds: 0, netRevenue: 35, profit: 22.5 });
    const invalid = calculateRecordedOrderEconomics({
      quantity: 1000,
      charge: "not-a-number",
      retailPaidKes: "also-invalid",
      wholesaleCostKes: "bad",
      refundAmount: "bad",
      status: "completed",
    });
    expect(
      Object.values(invalid).every(
        value => typeof value !== "number" || Number.isFinite(value)
      )
    ).toBe(true);
  });
  it("never calculates a new retail rate below KES 3 per 1k", () => {
    expect(
      calculateServiceEconomics({
        quantity: 1000,
        retailRatePer1k: 0.5,
        wholesaleRatePer1k: 0.1,
      })
    ).toMatchObject({ revenue: 3, providerCost: 0.1, profit: 2.9 });
  });
});
