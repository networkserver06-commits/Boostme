import { afterEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { orders, profiles, services, setTursoClientForTesting, smmProviders, users } from "./db";
import { createTestDatabase } from "./testDb";

type AuthUser = NonNullable<TrpcContext["user"]>;
const context: TrpcContext = {
  user: { id: 7, email: "buyer@example.com", name: "Buyer", loginMethod: "password", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() } satisfies AuthUser,
  req: { protocol: "https", headers: {} } as TrpcContext["req"],
  res: {} as TrpcContext["res"],
};

let testDb: Awaited<ReturnType<typeof createTestDatabase>>;
async function setup() {
  testDb = await createTestDatabase();
  setTursoClientForTesting(testDb.client);
  await testDb.db.insert(users).values({ id: 7, name: "Buyer", email: "buyer@example.com", passwordHash: "unused" });
  await testDb.db.insert(profiles).values({ userId: 7, balance: "100.00" });
  const [provider] = await testDb.db.insert(smmProviders).values({ name: "Provider One", apiUrl: "https://provider.example/api/v2", apiKey: "test-key", isActive: 1 }).returning();
  const [service] = await testDb.db.insert(services).values({ providerId: provider.id, providerServiceId: "fb-100", name: "Facebook Followers", platform: "Facebook", category: "Followers", retailRatePer1k: "50.7800", wholesaleRatePer1k: "42.3167", minQuantity: 100, maxQuantity: 100000, isActive: 1 }).returning();
  return { db: testDb.db, service };
}
const response = (body: unknown) => ({ ok: true, json: async () => body });
const providerCatalog = (rate: string) => [{ service: "fb-100", name: "Facebook Followers", category: "Facebook Followers", rate, min: "100", max: "100000" }];

afterEach(() => {
  setTursoClientForTesting(null);
  vi.unstubAllGlobals();
});

describe("order quote validation", () => {
  it("places a small order with positive rounded contribution instead of blocking it at an arbitrary KES 1 threshold", async () => {
    const { db, service } = await setup();
    const fetchMock = vi.fn().mockImplementation(async (_url, init) => {
      const body = String(init?.body ?? "");
      if (body.includes("action=services")) return response(providerCatalog("42.3167"));
      if (body.includes("action=add")) return response({ order: "provider-order-1" });
      throw new Error(`Unexpected provider action: ${body}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await appRouter.createCaller(context).dashboard.createOrder({
      serviceId: service.id,
      targetLink: "https://www.facebook.com/share/example",
      quantity: 118,
      expectedRetailRatePer1k: 50.78,
      expectedMinQuantity: 100,
      expectedMaxQuantity: 100000,
    });

    expect(result).toMatchObject({ charge: 5.99 });
    const [profile] = await db.select().from(profiles);
    const [order] = await db.select().from(orders);
    expect(profile.balance).toBe("94.01");
    expect(order).toMatchObject({ status: "in_progress", providerOrderId: "provider-order-1", charge: "5.99", quantity: 118 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("refreshes changed live pricing and requires a new review without charging or submitting", async () => {
    const { db, service } = await setup();
    const fetchMock = vi.fn().mockResolvedValue(response(providerCatalog("45.0000")));
    vi.stubGlobal("fetch", fetchMock);

    await expect(appRouter.createCaller(context).dashboard.createOrder({
      serviceId: service.id,
      targetLink: "https://www.facebook.com/share/example",
      quantity: 100,
      expectedRetailRatePer1k: 50.78,
      expectedMinQuantity: 100,
      expectedMaxQuantity: 100000,
    })).rejects.toMatchObject({ code: "CONFLICT", message: expect.stringContaining("Service price changed during checkout") });

    const [profile] = await db.select().from(profiles);
    const orderRows = await db.select().from(orders);
    const [updatedService] = await db.select().from(services);
    expect(profile.balance).toBe("100.00");
    expect(orderRows).toHaveLength(0);
    expect(updatedService).toMatchObject({ wholesaleRatePer1k: "45.0000", retailRatePer1k: "54.0000", needsResync: 0 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("refreshes changed provider quantity bounds and requires a new review without charging", async () => {
    const { db, service } = await setup();
    const changedLimits = [{ ...providerCatalog("42.3167")[0], min: "200" }];
    const fetchMock = vi.fn().mockResolvedValue(response(changedLimits));
    vi.stubGlobal("fetch", fetchMock);

    await expect(appRouter.createCaller(context).dashboard.createOrder({
      serviceId: service.id,
      targetLink: "https://www.facebook.com/share/example",
      quantity: 100,
      expectedRetailRatePer1k: 50.78,
      expectedMinQuantity: 100,
      expectedMaxQuantity: 100000,
    })).rejects.toMatchObject({ code: "CONFLICT", message: expect.stringContaining("Service limits changed during checkout") });

    const [profile] = await db.select().from(profiles);
    const orderRows = await db.select().from(orders);
    const [updatedService] = await db.select().from(services);
    expect(profile.balance).toBe("100.00");
    expect(orderRows).toHaveLength(0);
    expect(updatedService).toMatchObject({ minQuantity: 200, maxQuantity: 100000 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
