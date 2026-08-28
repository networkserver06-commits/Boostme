import { describe, expect, it, vi } from "vitest";

const getDbMock = vi.hoisted(() => vi.fn());
const recordAuditMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
vi.mock("./db", async () => {
  const actual = await vi.importActual<typeof import("./db")>("./db");
  return { ...actual, getDb: getDbMock, recordAudit: recordAuditMock };
});

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

const adminContext = (): TrpcContext => ({
  user: { id: 1, openId: "admin", email: "admin@example.com", name: "Admin", loginMethod: "manus", role: "admin", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
  req: { protocol: "https", headers: {} } as TrpcContext["req"],
  res: {} as TrpcContext["res"],
});

describe("admin.syncProviderServices", () => {
  it("returns partial failures and continues syncing other selected services", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => [
      { service: "1", name: "Views", category: "Instagram Views", rate: "10", min: "100", max: "10000" },
      { service: "2", name: "Likes", category: "Instagram Likes", rate: "20", min: "50", max: "5000" },
    ] }));
    let selectCalls = 0;
    const fakeDb = {
      select: () => ({ from: () => { selectCalls += 1; return { where: () => ({ limit: async () => selectCalls === 1 ? [{ id: 9, apiUrl: "https://provider.example", apiKey: "secret" }] : [] }) }; } }),
      insert: () => ({ values: async (value: any) => { if (value?.providerServiceId === "2") throw new Error("duplicate mapping"); } }),
      update: () => ({ set: () => ({ where: async () => undefined }) }),
    };
    getDbMock.mockResolvedValue(fakeDb);
    const result = await appRouter.createCaller(adminContext()).admin.syncProviderServices({ providerId: 9, serviceIds: ["1", "2"], markupPercent: 150 });
    expect(result.synced).toBe(1);
    expect(result.requested).toBe(2);
    expect(result.failures).toEqual([{ providerServiceId: "2", error: "duplicate mapping" }]);
    expect(recordAuditMock).toHaveBeenCalledWith(expect.objectContaining({ action: "provider.service_mapping_failed", entityId: "2", entityType: "provider_service" }));
    expect(recordAuditMock).toHaveBeenCalledWith(expect.objectContaining({ action: "provider.services_synced", entityId: "9", entityType: "provider", details: expect.objectContaining({ synced: 1, failures: [{ providerServiceId: "2", error: "duplicate mapping" }] }) }));
    vi.unstubAllGlobals();
  });
});
