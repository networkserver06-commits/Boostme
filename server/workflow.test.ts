import { describe, expect, it, vi } from "vitest";
import { orders, profiles, syncRuns, walletTransactions, eq } from "./db";
import { createTestDb } from "./testDb";
import { refundOrder } from "./db";
import { scheduledSyncHandler } from "./scheduled";

const response = () => {
  const result: { statusCode?: number; body?: unknown } = {};
  return { result, status(code: number) { result.statusCode = code; return this; }, json(body: unknown) { result.body = body; return body; } } as any;
};
const dbDependency = (db: Awaited<ReturnType<typeof createTestDb>>) => vi.fn().mockResolvedValue(db) as any;

describe("refundOrder", () => {
  it("updates the profile, marks the order failed, and inserts a refund ledger entry", async () => {
    const updates: unknown[] = [];
    const inserts: unknown[] = [];
    const tx = {
      select: () => ({ from: () => ({ where: () => ({ limit: async () => [{ balance: "25.00" }] }) }) }),
      update: () => ({ set: (value: unknown) => ({ where: async () => { updates.push(value); } }) }),
      insert: () => ({ values: async (value: unknown) => { inserts.push(value); } }),
    };
    const fakeDb = { transaction: (callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx) };
    await expect(refundOrder({ userId: 7, orderId: 11, amount: 12.5, reason: "provider failed" }, fakeDb)).resolves.toBe("37.50");
    expect(updates).toContainEqual({ balance: "37.50" });
    expect(updates).toContainEqual({ status: "failed", errorMessage: "provider failed" });
    expect(inserts[0]).toMatchObject({ amount: "12.50", type: "refund", status: "completed", balanceAfter: "37.50" });
  });
});

describe("scheduledSyncHandler", () => {
  it("rejects non-cron callers directly", async () => {
    const res = response();
    await scheduledSyncHandler({ path: "/api/scheduled/sync-orders", originalUrl: "/api/scheduled/sync-orders" } as any, res, { authenticate: vi.fn().mockResolvedValue({ isCron: false }) });
    expect(res.result).toEqual({ statusCode: 403, body: { error: "cron-only" } });
  });

  it("completes a provider order sync and persists the run count", async () => {
    const db = await createTestDb();
    await db.insert((await import("./db")).smmProviders).values({ name: "Provider", apiUrl: "https://provider.example", apiKey: "secret", isActive: 1 });
    await db.insert(orders).values({ userId: 2, serviceId: 1, providerOrderId: "p-41", targetLink: "https://instagram.com/test", quantity: 1000, charge: "1.25", startCount: 0, remains: 1000, status: "pending" });
    const res = response();
    await scheduledSyncHandler({ path: "/api/scheduled/sync-orders", originalUrl: "/api/scheduled/sync-orders" } as any, res, { authenticate: vi.fn().mockResolvedValue({ isCron: true, taskUid: "task-12" }), getDb: dbDependency(db), fetchProviderStatus: vi.fn().mockResolvedValue({ status: "Completed", remains: "0", start_count: "10" }) });
    expect(res.result.body).toMatchObject({ ok: true, processed: 1 });
    expect(await db.select().from(syncRuns)).toMatchObject([{ status: "completed", itemsProcessed: 1 }]);
    expect(await db.select().from(orders)).toMatchObject([{ status: "completed" }]);
  });

  it("continues after provider polling errors and closes the run with zero processed", async () => {
    const db = await createTestDb();
    await db.insert((await import("./db")).smmProviders).values({ name: "Provider", apiUrl: "https://provider.example", apiKey: "secret", isActive: 1 });
    await db.insert(orders).values({ userId: 2, serviceId: 1, providerOrderId: "p-42", targetLink: "https://instagram.com/test", quantity: 1000, charge: "1.25", startCount: 0, remains: 1000, status: "pending" });
    const res = response();
    await scheduledSyncHandler({ path: "/api/scheduled/sync-orders", originalUrl: "/api/scheduled/sync-orders" } as any, res, { authenticate: vi.fn().mockResolvedValue({ isCron: true, taskUid: "task-13" }), getDb: dbDependency(db), fetchProviderStatus: vi.fn().mockRejectedValue(new Error("provider timeout")) });
    expect(res.result.body).toMatchObject({ ok: true, processed: 0 });
    expect(await db.select().from(syncRuns)).toMatchObject([{ status: "completed", itemsProcessed: 0 }]);
  });

  it("records a failed sync run when no provider is configured", async () => {
    vi.stubEnv("BASE_URL", "");
    vi.stubEnv("API_KEY", "");
    const db = await createTestDb();
    const res = response();
    await scheduledSyncHandler({ path: "/api/scheduled/sync-orders", originalUrl: "/api/scheduled/sync-orders" } as any, res, { authenticate: vi.fn().mockResolvedValue({ isCron: true, taskUid: "task-9" }), getDb: dbDependency(db) });
    expect(res.result.body).toEqual({ ok: true, skipped: "no-provider" });
    expect(await db.select().from(syncRuns)).toMatchObject([{ status: "failed", errorMessage: "No active provider configured" }]);
    vi.unstubAllEnvs();
  });
});
