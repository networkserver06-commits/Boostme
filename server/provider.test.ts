import { afterEach, describe, expect, it, vi } from "vitest";
import { cancelProviderOrder, enforceProviderRateFloor, fetchProviderServices, fetchProviderStatus, getProviderPricingContext, mapCatalogService, mapProviderStatus, providerRateCurrency, submitProviderOrder, supportsDocumentedCancellation } from "./provider";

afterEach(() => vi.unstubAllGlobals());

describe("provider status mapping", () => {
  it("normalizes common provider progress states", () => {
    expect(mapProviderStatus("In progress")).toBe("in_progress");
    expect(mapProviderStatus("Processing")).toBe("in_progress");
    expect(mapProviderStatus("Completed")).toBe("completed");
    expect(mapProviderStatus("Canceled")).toBe("canceled");
    expect(mapProviderStatus("Partial")).toBe("partial");
  });

  it("fails safely to pending for unknown provider states", () => {
    expect(mapProviderStatus("queued_by_vendor")).toBe("pending");
  });
});

describe("provider service mapping", () => {
  it("does not allow the known 26949 service below its provider floor", () => {
    expect(enforceProviderRateFloor("26949", "TikTok Likes", 0.3537)).toBe(41.2269);
    expect(mapCatalogService({ service: "26949", name: "TikTok Likes", category: "TikTok Likes", rate: "0.3537", min: "1000", max: "500000" }, 1)).toMatchObject({ wholesaleRatePer1k: "41.2269", retailRatePer1k: "49.4723" });
  });

  it("protects the confirmed Instagram Working / Flag OFF service rate", () => {
    expect(enforceProviderRateFloor("247", "Instagram - Followers [ Working ] [ Flag OFF ✅ ]", 5.3063)).toBe(484);
    expect(mapCatalogService({ service: "247", name: "Instagram - Followers [ Working ] [ Flag OFF ✅ ]", category: "Instagram Followers", rate: "5.3063", min: "10", max: "1000000" }, 1)).toMatchObject({ wholesaleRatePer1k: "484.0000", retailRatePer1k: "580.8000" });
  });

  it("normalizes a remote service and applies the low-cost tier multiplier", () => {
    expect(mapCatalogService({ service: "7", name: "Reels views", category: "Instagram Views", rate: "12.5", min: "100", max: "50000" }, 3)).toMatchObject({ providerId: 3, providerServiceId: "7", platform: "Instagram", wholesaleRatePer1k: "12.5000", retailRatePer1k: "18.7500", minQuantity: 100, maxQuantity: 50000, isActive: 1 });
  });

  it("supports ShakerGain’s documented services and Category aliases", () => {
    const context = getProviderPricingContext("ShakerGain", "https://shakergainske.com/api/v2");
    expect(context.currency).toBe("USD");
    expect(mapCatalogService({ services: "1", name: "Data Entry", Category: "Seo", rate: 1, min: "10", max: "100000", type: "Default" }, 8, context)).toMatchObject({ providerId: 8, providerServiceId: "1", platform: "Seo", category: "Seo", wholesaleRatePer1k: "130.0000", retailRatePer1k: "156.0000" });
  });

  it("converts a ShakerGain API rate to the exact KES wholesale equivalent", () => {
    expect(mapCatalogService({ service: "27503", name: "Instagram Followers | Emergency", category: "Instagram Followers", rate: "0.07253846", min: "10", max: "100000", type: "Default" }, 8, { currency: "USD", usdToKes: 130 })).toMatchObject({ wholesaleRatePer1k: "9.4300", retailRatePer1k: "14.1450" });
  });

  it("accepts KES/KSh rates and blocks USD rates instead of treating dollars as KES", () => {
    expect(providerRateCurrency({ service: "1", name: "KES service", currency: "KSh", rate: "41.26", min: "1", max: "100" })).toBe("KES");
    expect(providerRateCurrency({ service: "2", name: "USD service", currency: "USD", rate: "41.26", min: "1", max: "100" })).toBe("UNSUPPORTED");
    expect(mapCatalogService({ service: "2", name: "USD service", currency: "USD", rate: "41.26", min: "1", max: "100" }, 8)).toMatchObject({ wholesaleRatePer1k: "0.0000", retailRatePer1k: "0.0000", isActive: 0 });
  });
});

describe("provider REST adapter", () => {
  it("recognizes only the documented ShakerGain API host for cancellation support", () => {
    expect(supportsDocumentedCancellation("https://shakergainske.com/api/v2")).toBe(true);
    expect(supportsDocumentedCancellation("https://api.shakergainske.com/v2")).toBe(true);
    expect(supportsDocumentedCancellation("https://notshakergainske.com/api")).toBe(false);
    expect(supportsDocumentedCancellation("not a url")).toBe(false);
  });

  it("sends the expected action payloads", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ order: "p-123" }) });
    vi.stubGlobal("fetch", fetchMock);
    await submitProviderOrder("https://provider.example/api", "secret", { service: "7", link: "https://instagram.com/p/abc", quantity: 1000 });
    const body = String(fetchMock.mock.calls[0]?.[1]?.body);
    expect(body).toContain("action=add");
    expect(body).toContain("service=7");
    expect(body).toContain("quantity=1000");
  });

  it("supports catalog and status responses", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => [{ service: "1", name: "Views", rate: "2", min: "100", max: "10000" }] })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ status: "Completed", remains: "0" }) });
    vi.stubGlobal("fetch", fetchMock);
    await expect(fetchProviderServices("https://provider.example/api", "secret")).resolves.toHaveLength(1);
    await expect(fetchProviderStatus("https://provider.example/api", "secret", "p-123")).resolves.toMatchObject({ status: "Completed" });
  });

  it("sends the documented cancellation action and parses the provider acknowledgement", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: "Cancellation request accepted" }) });
    vi.stubGlobal("fetch", fetchMock);
    await expect(cancelProviderOrder("https://shakergainske.com/api/v2", "secret", "p-123")).resolves.toMatchObject({ success: "Cancellation request accepted" });
    const body = String(fetchMock.mock.calls[0]?.[1]?.body);
    expect(body).toContain("action=cancel");
    expect(body).toContain("order=p-123");
  });
});
