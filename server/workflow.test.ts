import { describe, expect, it, vi } from "vitest";
import { orders, profiles, services, smmProviders, syncRuns, walletTransactions, eq } from "./db";
import { createTestDb } from "./testDb";
import { refundOrder } from "./db";
import { executeProviderSync, scheduledSyncHandler } from "./scheduled";
import { applyProviderOrderStatus } from "./orderLifecycle";

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

  it("checks each existing order against the provider assigned to its service", async () => {
    const db = await createTestDb();
    const [firstProvider] = await db.insert(smmProviders).values({ name: "First", apiUrl: "https://first.example/api", apiKey: "first-key", isActive: 1 }).returning();
    const [secondProvider] = await db.insert(smmProviders).values({ name: "Second", apiUrl: "https://second.example/api", apiKey: "second-key", isActive: 0 }).returning();
    const [firstService] = await db.insert(services).values({ providerId: firstProvider.id, providerServiceId: "f-1", name: "First service", platform: "Instagram", category: "Followers", wholesaleRatePer1k: "1.00", retailRatePer1k: "2.00", minQuantity: 100, maxQuantity: 1000 }).returning();
    const [secondService] = await db.insert(services).values({ providerId: secondProvider.id, providerServiceId: "s-1", name: "Second service", platform: "TikTok", category: "Followers", wholesaleRatePer1k: "1.00", retailRatePer1k: "2.00", minQuantity: 100, maxQuantity: 1000 }).returning();
    await db.insert(orders).values([
      { userId: 2, serviceId: firstService.id, providerOrderId: "first-order", targetLink: "https://instagram.com/test", quantity: 100, charge: "0.20", status: "in_progress", remains: 100 },
      { userId: 3, serviceId: secondService.id, providerOrderId: "second-order", targetLink: "https://tiktok.com/test", quantity: 100, charge: "0.20", status: "in_progress", remains: 100 },
    ]);
    const fetchStatus = vi.fn().mockResolvedValue({ status: "In progress", remains: "50" });
    const result = await executeProviderSync("orders", { getDb: dbDependency(db), fetchProviderStatus: fetchStatus });
    expect(result.processed).toBe(2);
    expect(fetchStatus.mock.calls.map((call) => [call[0], call[2]])).toEqual([["https://first.example/api", "first-order"], ["https://second.example/api", "second-order"]]);
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

  it("completes an empty order sync when no provider is configured", async () => {
    vi.stubEnv("BASE_URL", "");
    vi.stubEnv("API_KEY", "");
    const db = await createTestDb();
    const res = response();
    await scheduledSyncHandler({ path: "/api/scheduled/sync-orders", originalUrl: "/api/scheduled/sync-orders" } as any, res, { authenticate: vi.fn().mockResolvedValue({ isCron: true, taskUid: "task-9" }), getDb: dbDependency(db) });
    expect(res.result.body).toMatchObject({ ok: true, processed: 0 });
    expect(await db.select().from(syncRuns)).toMatchObject([{ status: "completed", itemsProcessed: 0 }]);
    vi.unstubAllEnvs();
  });
});

describe("provider order progress and cancellation accounting", () => {
  it("updates progress and credits only the undelivered share after confirmed cancellation", async () => {
    const db = await createTestDb();
    await db.insert(profiles).values({ userId: 22, balance: "4.00" });
    await db.insert(orders).values({ userId: 22, serviceId: 1, providerOrderId: "remote-22", targetLink: "https://instagram.com/post", quantity: 1000, charge: "10.00", status: "in_progress", startCount: 100, remains: 1000, cancelRequestStatus: "accepted", cancelRequestedAt: new Date() });
    const [order] = await db.select().from(orders);

    await expect(applyProviderOrderStatus(db, order.id, { status: "Canceled", start_count: "400", remains: "600" })).resolves.toMatchObject({ updated: true, refund: 6 });
    const [updated] = await db.select().from(orders);
    const [profile] = await db.select().from(profiles);
    const refunds = await db.select().from(walletTransactions).where(eq(walletTransactions.reference, `cancel-refund-${order.id}`));
    expect(updated).toMatchObject({ status: "canceled", startCount: 400, remains: 600 });
    expect(updated.lastProviderCheckAt).toBeInstanceOf(Date);
    expect(profile.balance).toBe("10.00");
    expect(refunds).toMatchObject([{ amount: "6.00", type: "refund", status: "completed" }]);
    await expect(applyProviderOrderStatus(db, order.id, { status: "Canceled", start_count: "400", remains: "600" })).resolves.toMatchObject({ refund: 0 });
    expect(await db.select().from(walletTransactions).where(eq(walletTransactions.reference, `cancel-refund-${order.id}`))).toHaveLength(1);
  });

  it("credits the undelivered portion for a provider-confirmed cancellation even without a customer request", async () => {
    const db = await createTestDb();
    await db.insert(profiles).values({ userId: 23, balance: "4.00" });
    await db.insert(orders).values({ userId: 23, serviceId: 1, providerOrderId: "remote-23", targetLink: "https://instagram.com/post", quantity: 1000, charge: "10.00", status: "in_progress", remains: 1000 });
    const [order] = await db.select().from(orders);
    await applyProviderOrderStatus(db, order.id, { status: "Canceled", remains: "400" });
    expect((await db.select().from(profiles))[0]?.balance).toBe("8.00");
    expect(await db.select().from(walletTransactions)).toMatchObject([{ amount: "4.00", type: "refund", reference: `cancel-refund-${order.id}` }]);
  });
});
