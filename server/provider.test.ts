import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchProviderServices, fetchProviderStatus, mapProviderStatus, submitProviderOrder } from "./provider";

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

describe("provider REST adapter", () => {
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
});
