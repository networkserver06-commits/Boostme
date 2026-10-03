import { afterEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { orders, profiles, services, setTursoClientForTesting, smmProviders, users, eq, walletTransactions } from "./db";
import { createTestDatabase } from "./testDb";

type AuthUser = NonNullable<TrpcContext["user"]>;
const context = (id: number): TrpcContext => ({
  user: { id, email: `user${id}@example.com`, name: `User ${id}`, loginMethod: "password", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() } satisfies AuthUser,
  req: { protocol: "https", headers: {} } as TrpcContext["req"],
  res: {} as TrpcContext["res"],
});

let testDb: Awaited<ReturnType<typeof createTestDatabase>>;
async function setup() {
  testDb = await createTestDatabase();
  setTursoClientForTesting(testDb.client);
  await testDb.db.insert(users).values({ id: 7, name: "User 7", email: "user7@example.com", passwordHash: "not-used" });
  await testDb.db.insert(profiles).values({ userId: 7, balance: "4.00" });
  const [provider] = await testDb.db.insert(smmProviders).values({ name: "ShakerGain", apiUrl: "https://shakergainske.com/api/v2", apiKey: "test-key", isActive: 1, supportsCancel: 1 }).returning();
  const [service] = await testDb.db.insert(services).values({ providerId: provider.id, providerServiceId: "social-1", name: "Instagram Followers", platform: "Instagram", category: "Followers", retailRatePer1k: "10.0000", wholesaleRatePer1k: "1.0000", minQuantity: 100, maxQuantity: 10000 }).returning();
  return { db: testDb.db, service };
}

afterEach(() => { setTursoClientForTesting(null); vi.unstubAllGlobals(); });

describe("customer order lifecycle procedures", () => {
  it("accepts one provider cancellation request for the owning customer and prevents duplicate submissions", async () => {
    const { db, service } = await setup();
    const [order] = await db.insert(orders).values({ userId: 7, serviceId: service.id, providerOrderId: "remote-100", targetLink: "https://instagram.com/example", quantity: 1000, charge: "10.00", status: "in_progress", remains: 1000 }).returning();
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: "Your order will be cancel asap." }) });
    vi.stubGlobal("fetch", fetchMock);
    const caller = appRouter.createCaller(context(7));

    await expect(caller.dashboard.cancelOrder({ orderId: order.id })).resolves.toMatchObject({ success: true });
    const [updated] = await db.select().from(orders).where(eq(orders.id, order.id));
    expect(updated).toMatchObject({ status: "in_progress", cancelRequestStatus: "accepted" });
    expect(updated.cancelRequestedAt).toBeInstanceOf(Date);
    expect(String(fetchMock.mock.calls[0]?.[1]?.body)).toContain("action=cancel");
    expect(String(fetchMock.mock.calls[0]?.[1]?.body)).toContain("order=remote-100");
    await expect(caller.dashboard.cancelOrder({ orderId: order.id })).rejects.toMatchObject({ code: "CONFLICT" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not disclose or cancel another customer's order", async () => {
    const { db, service } = await setup();
    const [order] = await db.insert(orders).values({ userId: 7, serviceId: service.id, providerOrderId: "remote-private", targetLink: "https://instagram.com/example", quantity: 1000, charge: "10.00", status: "in_progress" }).returning();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(appRouter.createCaller(context(8)).dashboard.cancelOrder({ orderId: order.id })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("records a rejected cancellation without changing order status and allows a later retry", async () => {
    const { db, service } = await setup();
    const [order] = await db.insert(orders).values({ userId: 7, serviceId: service.id, providerOrderId: "remote-retry", targetLink: "https://instagram.com/example", quantity: 1000, charge: "10.00", status: "in_progress" }).returning();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ error: "Order already processing" }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ success: "Cancellation request accepted" }) });
    vi.stubGlobal("fetch", fetchMock);
    const caller = appRouter.createCaller(context(7));

    await expect(caller.dashboard.cancelOrder({ orderId: order.id })).rejects.toMatchObject({ code: "BAD_GATEWAY" });
    expect(await db.select().from(orders).where(eq(orders.id, order.id))).toMatchObject([{ status: "in_progress", cancelRequestStatus: "failed", cancelRequestedAt: null }]);
    await expect(caller.dashboard.cancelOrder({ orderId: order.id })).resolves.toMatchObject({ success: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("shows provider progress and refunds undelivered value only after a requested cancellation is confirmed", async () => {
    const { db, service } = await setup();
    const [order] = await db.insert(orders).values({ userId: 7, serviceId: service.id, providerOrderId: "remote-101", targetLink: "https://instagram.com/example", quantity: 1000, charge: "10.00", status: "in_progress", startCount: 100, remains: 1000, cancelRequestStatus: "accepted", cancelRequestedAt: new Date() }).returning();
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ status: "Canceled", start_count: "400", remains: "600" }) });
    vi.stubGlobal("fetch", fetchMock);

    await expect(appRouter.createCaller(context(7)).dashboard.refreshOrderStatus({ orderId: order.id })).resolves.toMatchObject({ status: "canceled", remains: 600 });
    const [updated] = await db.select().from(orders).where(eq(orders.id, order.id));
    const [profile] = await db.select().from(profiles);
    const refundRows = await db.select().from(walletTransactions).where(eq(walletTransactions.reference, `cancel-refund-${order.id}`));
    expect(updated).toMatchObject({ status: "canceled", startCount: 400, remains: 600 });
    expect(updated.lastProviderCheckAt).toBeInstanceOf(Date);
    expect(profile.balance).toBe("10.00");
    expect(refundRows).toMatchObject([{ amount: "6.00", status: "completed" }]);
    await expect(appRouter.createCaller(context(8)).dashboard.refreshOrderStatus({ orderId: order.id })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("rate-limits repeat provider refreshes while an order is still active", async () => {
    const { db, service } = await setup();
    const [order] = await db.insert(orders).values({ userId: 7, serviceId: service.id, providerOrderId: "remote-102", targetLink: "https://instagram.com/example", quantity: 1000, charge: "10.00", status: "in_progress", remains: 900 }).returning();
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ status: "In progress", start_count: "10", remains: "890" }) });
    vi.stubGlobal("fetch", fetchMock);
    const caller = appRouter.createCaller(context(7));
    await expect(caller.dashboard.refreshOrderStatus({ orderId: order.id })).resolves.toMatchObject({ status: "in_progress", remains: 890 });
    await expect(caller.dashboard.refreshOrderStatus({ orderId: order.id })).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not call or refund through a provider without cancellation support", async () => {
    const { db, service } = await setup();
    await db.update(smmProviders).set({ supportsCancel: 0 });
    const [order] = await db.insert(orders).values({ userId: 7, serviceId: service.id, providerOrderId: "remote-103", targetLink: "https://instagram.com/example", quantity: 1000, charge: "10.00", status: "in_progress", remains: 1000 }).returning();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(appRouter.createCaller(context(7)).dashboard.cancelOrder({ orderId: order.id })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(fetchMock).not.toHaveBeenCalled();
    expect((await db.select().from(profiles))[0]?.balance).toBe("4.00");
  });
});
