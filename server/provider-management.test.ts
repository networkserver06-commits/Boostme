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
  user: { id: 1, openId: "admin", email: "admin@example.com", name: "Admin", loginMethod: "supabase", role: "admin", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
  req: { protocol: "https", headers: {} } as TrpcContext["req"],
  res: {} as TrpcContext["res"],
});

const fakeDb = (provider = { id: 4, name: "Provider", apiUrl: "https://provider.example", apiKey: "secret", isActive: true }) => {
  const updates: any[] = [];
  const requests: any[] = [];
  return {
    updates,
    requests,
    select: () => ({ from: () => ({ where: () => ({ limit: async () => [provider] }) }) }),
    update: () => ({ set: (values: any) => ({ where: async () => { Object.assign(provider, values); updates.push(values); } }) }),
    request: async (path: string, init: any) => { requests.push({ path, init }); return null; },
    insert: () => ({ values: async () => [{ id: 8 }] }),
  };
};

describe("admin provider management", () => {
  it("updates provider metadata without overwriting the stored API key", async () => {
    const db = fakeDb(); getDbMock.mockResolvedValue(db);
    await appRouter.createCaller(adminContext()).admin.saveProvider({ id: 4, name: "Renamed", apiUrl: "https://new.example", isActive: 1 });
    expect(db.updates[0]).toEqual({ name: "Renamed", apiUrl: "https://new.example", isActive: 1 });
  });

  it("pauses a provider and only removes paused providers", async () => {
    const db = fakeDb(); getDbMock.mockResolvedValue(db);
    await appRouter.createCaller(adminContext()).admin.toggleProvider({ id: 4, isActive: false });
    expect(db.updates[0]).toEqual({ isActive: false });
    await expect(appRouter.createCaller(adminContext()).admin.removeProvider({ id: 4 })).resolves.toEqual({ success: true });
    expect(db.requests[0].path).toBe("smm_providers?id=eq.4");
  });

  it("rejects removal of an active provider", async () => {
    const db = fakeDb({ id: 4, name: "Provider", apiUrl: "https://provider.example", apiKey: "secret", isActive: true }); getDbMock.mockResolvedValue(db);
    await expect(appRouter.createCaller(adminContext()).admin.removeProvider({ id: 4 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("tests a provider connection and reports the catalog size", async () => {
    const db = fakeDb(); getDbMock.mockResolvedValue(db);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => [{ service: "1" }, { service: "2" }] }));
    await expect(appRouter.createCaller(adminContext()).admin.testProvider({ id: 4 })).resolves.toMatchObject({ ok: true, services: 2 });
    vi.unstubAllGlobals();
  });
});
