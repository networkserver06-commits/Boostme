import { normalizeServicePresentation } from "../shared/serviceCatalog";
import { formatTieredRetailRatePer1k } from "../shared/pricing";

export type ProviderService = { service?: string | number; services?: string | number; name: string; category?: string; Category?: string; type?: string; currency?: string; currency_code?: string; currencyCode?: string; rate_currency?: string; rate: string | number; min: string | number; max: string | number };
export type ProviderOrderStatus = { status: string; start_count?: string | number; remains?: string | number; charge?: string | number };

export async function providerRequest<T>(apiUrl: string, apiKey: string, body: Record<string, string | number>) {
  const response = await fetch(apiUrl, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" }, body: new URLSearchParams({ key: apiKey, ...Object.fromEntries(Object.entries(body).map(([key, value]) => [key, String(value)])) }), signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`Provider responded with HTTP ${response.status}`);
  const data = await response.json() as T | { error?: string };
  if (typeof data === "object" && data && "error" in data && data.error) throw new Error(data.error);
  return data as T;
}

export async function fetchProviderServices(apiUrl: string, apiKey: string) { return providerRequest<ProviderService[]>(apiUrl, apiKey, { action: "services" }); }

const PROVIDER_RATE_FLOORS_PER_1K: Record<string, number> = { "26949": 41.2269 };
const PROVIDER_RATE_NAME_FLOORS: Array<{ pattern: RegExp; floor: number }> = [{ pattern: /instagram.*followers.*working.*flag\s*off/i, floor: 484 }];

export function enforceProviderRateFloor(providerServiceId: string, name: string, rate: number) {
  const floor = PROVIDER_RATE_FLOORS_PER_1K[providerServiceId] ?? PROVIDER_RATE_NAME_FLOORS.find(({ pattern }) => pattern.test(name))?.floor;
  if (floor == null) return rate;
  console.warn(`[PROVIDER RATE FLOOR] ${providerServiceId} ${name}: KES ${rate} -> at least KES ${floor} per 1k`);
  return Math.max(rate, floor);
}

export function getProviderServiceId(item: ProviderService) {
  return String(item.service ?? item.services);
}

function isKesMarker(value: string) { return /^(kes|ksh|kshs|ksh\.)$/i.test(value.trim()); }
function isNonKesMarker(value: string) { return /^(usd|\$|eur|€|gbp|£)$/i.test(value.trim()); }

export function providerRateCurrency(item: ProviderService): "KES" | "UNSUPPORTED" {
  const explicit = [item.currency, item.currency_code, item.currencyCode, item.rate_currency].find(Boolean)?.trim();
  const rawRate = String(item.rate).trim();
  const marker = explicit || rawRate.match(/^(KES|KSh|KSH|USD|EUR|GBP|[$€£])/i)?.[1];
  if (!marker || isKesMarker(marker)) return "KES";
  if (isNonKesMarker(marker)) return "UNSUPPORTED";
  return "UNSUPPORTED";
}

export function mapCatalogService(item: ProviderService, providerId: number) {
  const category = item.category || item.Category || item.type || "General";
  const providerServiceId = getProviderServiceId(item);
  if (providerRateCurrency(item) === "UNSUPPORTED") {
    console.error(`[PROVIDER CURRENCY BLOCKED] ${providerServiceId} ${item.name}: unsupported non-KES rate`);
    return { providerId, providerServiceId, name: item.name, platform: category.split(" ")[0] || "Social", category, wholesaleRatePer1k: "0.0000", retailRatePer1k: "0.0000", minQuantity: Number(item.min), maxQuantity: Number(item.max), isActive: 0 };
  }
  const providerRate = Number(String(item.rate).replace(/^(KES|KSh|KSH)\s*/i, "").replaceAll(",", ""));
  if (!Number.isFinite(providerRate) || providerRate < 0) throw new Error(`Provider service ${providerServiceId} has an invalid KES rate`);
  const wholesaleRatePer1k = enforceProviderRateFloor(providerServiceId, item.name, providerRate);
  const imported = { providerId, providerServiceId, name: item.name, platform: category.split(" ")[0] || "Social", category, wholesaleRatePer1k: wholesaleRatePer1k.toFixed(4), retailRatePer1k: formatTieredRetailRatePer1k(wholesaleRatePer1k), minQuantity: Number(item.min), maxQuantity: Number(item.max), isActive: 1 };
  const normalized = normalizeServicePresentation(imported);
  return { ...imported, platform: normalized.platform, category: normalized.category };
}
export async function submitProviderOrder(apiUrl: string, apiKey: string, input: { service: string; link: string; quantity: number }) { return providerRequest<{ order: string }>(apiUrl, apiKey, { action: "add", ...input }); }
export async function fetchProviderStatus(apiUrl: string, apiKey: string, order: string) { return providerRequest<ProviderOrderStatus>(apiUrl, apiKey, { action: "status", order }); }
export async function cancelProviderOrder(apiUrl: string, apiKey: string, orders: string) { return providerRequest<unknown>(apiUrl, apiKey, { action: "cancel", orders }); }

export function mapProviderStatus(status: string): "pending" | "in_progress" | "completed" | "canceled" | "partial" | "failed" {
  const normalized = status.toLowerCase().replaceAll(" ", "_");
  if (["completed", "complete", "done"].includes(normalized)) return "completed";
  if (["canceled", "cancelled", "refunded"].includes(normalized)) return "canceled";
  if (["partial", "partially_completed"].includes(normalized)) return "partial";
  if (["in_progress", "processing", "active"].includes(normalized)) return "in_progress";
  if (["failed", "error"].includes(normalized)) return "failed";
  return "pending";
}
