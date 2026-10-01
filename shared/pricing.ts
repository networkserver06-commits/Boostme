export const LOW_COST_RETAIL_MULTIPLIER = 2.5;
export const HIGH_COST_RETAIL_MULTIPLIER = 1.4;
export const HIGH_COST_THRESHOLD_KES = 20;
export const MIN_RETAIL_RATE_PER_1K_KES = 3;

/**
 * Returns the required retail rate per 1,000 units for a live provider rate.
 * Rates above KES 20 receive a 40% markup; all other non-negative rates receive
 * a 150% markup, with a KES 3.00 minimum retail rate per 1,000 units. Throwing on invalid input prevents silently importing a zero rate.
 */
export function calculateTieredRetailRatePer1k(wholesaleCostKes: string | number) {
  const wholesale = Number(wholesaleCostKes);
  if (!Number.isFinite(wholesale) || wholesale < 0) throw new Error("Provider returned an invalid wholesale rate");
  const multiplier = wholesale > HIGH_COST_THRESHOLD_KES ? HIGH_COST_RETAIL_MULTIPLIER : LOW_COST_RETAIL_MULTIPLIER;
  return Math.max(MIN_RETAIL_RATE_PER_1K_KES, Number((wholesale * multiplier).toFixed(4)));
}

export function formatTieredRetailRatePer1k(wholesaleCostKes: string | number) {
  return calculateTieredRetailRatePer1k(wholesaleCostKes).toFixed(4);
}
