export type ProviderService = { service: string | number; name: string; category?: string; type?: string; rate: string | number; min: string | number; max: string | number };
export type ProviderOrderStatus = { status: string; start_count?: string | number; remains?: string | number; charge?: string | number };

export async function providerRequest<T>(apiUrl: string, apiKey: string, body: Record<string, string | number>) {
  const response = await fetch(apiUrl, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" }, body: new URLSearchParams({ key: apiKey, ...Object.fromEntries(Object.entries(body).map(([key, value]) => [key, String(value)])) }) });
  if (!response.ok) throw new Error(`Provider responded with HTTP ${response.status}`);
  const data = await response.json() as T | { error?: string };
  if (typeof data === "object" && data && "error" in data && data.error) throw new Error(data.error);
  return data as T;
}

export async function fetchProviderServices(apiUrl: string, apiKey: string) { return providerRequest<ProviderService[]>(apiUrl, apiKey, { action: "services" }); }

export function mapCatalogService(item: ProviderService, providerId: number, markupPercent: number) {
  return { providerId, providerServiceId: String(item.service), name: item.name, platform: item.category?.split(" ")[0] || "Social", category: item.category || item.type || "General", wholesaleRatePer1k: Number(item.rate).toFixed(4), retailRatePer1k: (Number(item.rate) * (1 + markupPercent / 100)).toFixed(4), minQuantity: Number(item.min), maxQuantity: Number(item.max), isActive: 1 };
}
export async function submitProviderOrder(apiUrl: string, apiKey: string, input: { service: string; link: string; quantity: number }) { return providerRequest<{ order: string }>(apiUrl, apiKey, { action: "add", ...input }); }
export async function fetchProviderStatus(apiUrl: string, apiKey: string, order: string) { return providerRequest<ProviderOrderStatus>(apiUrl, apiKey, { action: "status", order }); }

export function mapProviderStatus(status: string): "pending" | "in_progress" | "completed" | "canceled" | "partial" | "failed" {
  const normalized = status.toLowerCase().replaceAll(" ", "_");
  if (["completed", "complete", "done"].includes(normalized)) return "completed";
  if (["canceled", "cancelled", "refunded"].includes(normalized)) return "canceled";
  if (["partial", "partially_completed"].includes(normalized)) return "partial";
  if (["in_progress", "processing", "active"].includes(normalized)) return "in_progress";
  if (["failed", "error"].includes(normalized)) return "failed";
  return "pending";
}
