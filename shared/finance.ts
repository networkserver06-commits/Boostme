export type ServiceEconomicsInput = {
  quantity: number;
  retailRatePer1k: number | string;
  wholesaleRatePer1k: number | string;
};

export type OrderEconomics = ServiceEconomicsInput & {
  charge: number | string;
  status?: string | null;
};

const cents = (value: number) => Math.round((Number.isFinite(value) ? value : 0) * 100);
const fromCents = (value: number) => Number((value / 100).toFixed(2));

export function calculateServiceEconomics(input: ServiceEconomicsInput) {
  const quantity = Math.max(0, Math.trunc(input.quantity));
  const retail = Number(input.retailRatePer1k) || 0;
  const wholesale = Number(input.wholesaleRatePer1k) || 0;
  const revenueCents = cents(retail * quantity / 1000);
  const costCents = cents(wholesale * quantity / 1000);
  const profitCents = revenueCents - costCents;
  return {
    revenue: fromCents(revenueCents),
    providerCost: fromCents(costCents),
    profit: fromCents(profitCents),
    marginPercent: revenueCents > 0 ? Number((profitCents / revenueCents * 100).toFixed(2)) : 0,
  };
}

export function calculateCheckoutEconomics(input: { quantity: number; retailRatePer1k: number | string; wholesaleRatePer1k: number | string }) {
  const quantity = Math.max(0, Math.trunc(input.quantity));
  const wholesaleCostForQty = Number((quantity / 1000 * (Number(input.wholesaleRatePer1k) || 0)).toFixed(2));
  const retailAmountCalculated = Number((quantity / 1000 * (Number(input.retailRatePer1k) || 0)).toFixed(2));
  const finalRetailCharged = Math.max(retailAmountCalculated, 10);
  const estimatedProfit = Number((finalRetailCharged - wholesaleCostForQty).toFixed(2));
  return { wholesaleCostForQty, retailAmountCalculated, finalRetailCharged, estimatedProfit, isValid: Number.isFinite(wholesaleCostForQty) && Number.isFinite(finalRetailCharged) && finalRetailCharged > wholesaleCostForQty && estimatedProfit >= 1 };
}

export function calculateOrderEconomics(order: OrderEconomics) {
  const service = calculateServiceEconomics(order);
  const chargeCents = cents(Number(order.charge));
  const costCents = cents(service.providerCost);
  const realized = !["canceled", "failed"].includes(order.status ?? "");
  return {
    billed: fromCents(chargeCents),
    revenue: fromCents(realized ? chargeCents : 0),
    providerCost: fromCents(realized ? costCents : 0),
    profit: fromCents(realized ? chargeCents - costCents : 0),
    estimatedProfit: fromCents(chargeCents - costCents),
  };
}

/** Calculates from values captured at checkout; historical orders must not be re-priced from today's catalog. */
export function calculateRecordedOrderEconomics(input: { quantity: number; charge: number | string; wholesaleCostKes?: number | string | null; retailPaidKes?: number | string | null; status?: string | null }) {
  const quantity = Math.max(0, Math.trunc(Number(input.quantity) || 0));
  const charge = Number(input.retailPaidKes ?? input.charge) || 0;
  const providerCost = Number(input.wholesaleCostKes) || 0;
  const realized = !["canceled", "failed"].includes(input.status ?? "");
  const profit = Number((charge - providerCost).toFixed(2));
  return {
    quantity,
    billed: Number((Number(input.charge) || 0).toFixed(2)),
    revenue: Number((realized ? charge : 0).toFixed(2)),
    providerCost: Number((realized ? providerCost : 0).toFixed(2)),
    profit: Number((realized ? profit : 0).toFixed(2)),
    estimatedProfit: profit,
    marginPercent: charge > 0 ? Number((profit / charge * 100).toFixed(2)) : 0,
    isLoss: realized && profit < 0,
  };
}

export function summarizeProfit(input: { orders: OrderEconomics[]; refunds?: Array<number | string> }) {
  const rows = input.orders.map(calculateOrderEconomics);
  const grossRevenueCents = rows.reduce((sum, row) => sum + cents(row.billed), 0);
  const providerCostCents = rows.reduce((sum, row) => sum + cents(row.providerCost), 0);
  const refundsCents = (input.refunds ?? []).reduce<number>((sum, amount) => sum + cents(Number(amount)), 0);
  const netRevenueCents = grossRevenueCents - refundsCents;
  const profitCents = netRevenueCents - providerCostCents;
  return {
    grossRevenue: fromCents(grossRevenueCents),
    providerCost: fromCents(providerCostCents),
    refunds: fromCents(refundsCents),
    netRevenue: fromCents(netRevenueCents),
    profit: fromCents(profitCents),
    marginPercent: grossRevenueCents > 0 ? Number((profitCents / grossRevenueCents * 100).toFixed(2)) : 0,
  };
}
