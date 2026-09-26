import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq, smmProviders } from "./db";
import { createTestDb } from "./testDb";

const getDbMock = vi.hoisted(() => vi.fn());
const recordAuditMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
vi.mock("./db", async () => {
  const actual = await vi.importActual<typeof import("./db")>("./db");
  return { ...actual, getDb: getDbMock, recordAudit: recordAuditMock };
});

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

const adminContext = (): TrpcContext => ({
  user: { id: 1, email: "admin@example.com", name: "Admin", loginMethod: "password", role: "admin", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
  req: { protocol: "https", headers: {}, ip: "127.0.0.1" } as TrpcContext["req"],
  res: {} as TrpcContext["res"],
});

let db: Awaited<ReturnType<typeof createTestDb>>;
let providerId: number;
beforeEach(async () => {
  db = await createTestDb();
  const [provider] = await db.insert(smmProviders).values({ name: "Provider", apiUrl: "https://provider.example", apiKey: "secret", isActive: 1 }).returning();
  providerId = provider.id;
  getDbMock.mockResolvedValue(db);
  recordAuditMock.mockResolvedValue(undefined);
});
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });

describe("admin provider management on Turso", () => {
  it("updates provider metadata without overwriting the stored API key", async () => {
    await appRouter.createCaller(adminContext()).admin.saveProvider({ id: providerId, name: "Renamed", apiUrl: "https://new.example", isActive: 1 });
    const [updated] = await db.select().from(smmProviders).where(eq(smmProviders.id, providerId));
    expect(updated).toMatchObject({ name: "Renamed", apiUrl: "https://new.example", apiKey: "secret", isActive: 1 });
  });

  it("pauses and deletes only paused providers", async () => {
    await appRouter.createCaller(adminContext()).admin.toggleProvider({ id: providerId, isActive: false });
    const [paused] = await db.select().from(smmProviders).where(eq(smmProviders.id, providerId));
    expect(paused.isActive).toBe(0);
    await expect(appRouter.createCaller(adminContext()).admin.removeProvider({ id: providerId })).resolves.toEqual({ success: true });
    expect(await db.select().from(smmProviders)).toHaveLength(0);
  });

  it("rejects removal of an active provider", async () => {
    await expect(appRouter.createCaller(adminContext()).admin.removeProvider({ id: providerId })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(await db.select().from(smmProviders)).toHaveLength(1);
  });

  it("tests a provider connection and reports the catalog size", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => [{ service: "1" }, { service: "2" }] }));
    await expect(appRouter.createCaller(adminContext()).admin.testProvider({ id: providerId })).resolves.toMatchObject({ ok: true, services: 2 });
  });
});
