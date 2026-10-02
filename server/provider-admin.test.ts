import { describe, expect, it, vi } from "vitest";
import { eq, orders, services, smmProviders, syncRuns } from "./db";
import { createTestDb } from "./testDb";
import { executeProviderSync } from "./scheduled";

const dbDependency = (db: Awaited<ReturnType<typeof createTestDb>>) => vi.fn().mockResolvedValue(db) as any;

async function seedProvider(db: Awaited<ReturnType<typeof createTestDb>>) {
  const [provider] = await db.insert(smmProviders).values({ name: "Test provider", apiUrl: "https://provider.example", apiKey: "private-test-key", isActive: 1 }).returning();
  return provider;
}

describe("Turso-backed provider synchronization", () => {
  it("imports and persists catalog services and closes a sync run", async () => {
    const db = await createTestDb();
    const provider = await seedProvider(db);
    const result = await executeProviderSync("catalog", {
      actorUserId: 9,
      getDb: dbDependency(db),
      fetchProviderServices: vi.fn().mockResolvedValue([{ service: "42", name: "Views", category: "Instagram Views", rate: "10", min: "100", max: "100000" }]),
      recordAudit: vi.fn() as any,
    });
    expect(result).toMatchObject({ processed: 1 });
    expect(await db.select().from(services).where(eq(services.providerId, provider.id))).toMatchObject([{ providerServiceId: "42", name: "Views", isActive: 1 }]);
    expect(await db.select().from(syncRuns)).toMatchObject([{ status: "completed", itemsProcessed: 1 }]);
  });

  it("replaces corrupted rates using the tier engine and disables missing mapped services", async () => {
    const db = await createTestDb();
    const provider = await seedProvider(db);
    const [mapped] = await db.insert(services).values({ providerId: provider.id, providerServiceId: "42", name: "TikTok Likes", platform: "TikTok", category: "Likes", wholesaleRatePer1k: "0.8800", retailRatePer1k: "0.8800", minQuantity: 100, maxQuantity: 100000, isActive: 1 }).returning();
    const [missing] = await db.insert(services).values({ providerId: provider.id, providerServiceId: "removed-99", name: "Removed service", platform: "TikTok", category: "Likes", wholesaleRatePer1k: "2.0000", retailRatePer1k: "5.0000", minQuantity: 100, maxQuantity: 100000, isActive: 1 }).returning();

    await executeProviderSync("catalog", {
      getDb: dbDependency(db),
      fetchProviderServices: vi.fn().mockResolvedValue([{ service: "42", name: "TikTok Likes", category: "TikTok Likes", rate: "41.26", min: "100", max: "100000" }]),
      recordAudit: vi.fn() as any,
    });

    expect(await db.select().from(services).where(eq(services.id, mapped.id))).toMatchObject([{ wholesaleRatePer1k: "41.2600", retailRatePer1k: "49.5120", needsResync: 0, isActive: 1 }]);
    expect(await db.select().from(services).where(eq(services.id, missing.id))).toMatchObject([{ needsResync: 1, isActive: 0 }]);
  });

  it("records a visible failed run and skips when no provider is configured", async () => {
    vi.stubEnv("BASE_URL", "");
    vi.stubEnv("API_KEY", "");
    const db = await createTestDb();
    const fetchProviderServices = vi.fn();
    const result = await executeProviderSync("catalog", { getDb: dbDependency(db), fetchProviderServices, recordAudit: vi.fn() as any });
    expect(result).toMatchObject({ processed: 0, skipped: "no-provider" });
    expect(fetchProviderServices).not.toHaveBeenCalled();
    expect(await db.select().from(syncRuns)).toMatchObject([{ status: "failed", itemsProcessed: 0 }]);
    vi.unstubAllEnvs();
  });

  it("updates provider-order status through libSQL", async () => {
    const db = await createTestDb();
    const provider = await seedProvider(db);
    const [order] = await db.insert(orders).values({ userId: 3, serviceId: 1, providerOrderId: "p-41", targetLink: "https://instagram.com/test", quantity: 1000, charge: "2.00", startCount: 0, remains: 1000, status: "pending" }).returning();
    const result = await executeProviderSync("orders", {
      getDb: dbDependency(db),
      fetchProviderStatus: vi.fn().mockResolvedValue({ status: "Completed", remains: "0", start_count: "10" }),
      recordAudit: vi.fn() as any,
    });
    expect(result.processed).toBe(1);
    expect(await db.select().from(orders).where(eq(orders.id, order.id))).toMatchObject([{ status: "completed", remains: 0, startCount: 10 }]);
    expect(await db.select().from(syncRuns)).toMatchObject([{ providerId: provider.id, kind: "orders", status: "completed", itemsProcessed: 1 }]);
  });
});
