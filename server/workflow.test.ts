import { describe, expect, it, vi } from "vitest";
import { refundOrder } from "./db";
import { scheduledSyncHandler } from "./scheduled";

const response = () => {
  const result: { statusCode?: number; body?: unknown } = {};
  return { result, status(code: number) { result.statusCode = code; return this; }, json(body: unknown) { result.body = body; return body; } } as any;
};

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

  it("completes a provider order sync and updates the run count", async () => {
    const res = response();
    const runUpdates: unknown[] = [];
    const fakeDb = {
      from: (table: string) => table === "smm_providers" ? { select: () => ({ where: () => ({ limit: async () => [{ id: 3, apiUrl: "https://provider.example", apiKey: "secret" }] }) }) } : table === "orders" ? { select: async () => [{ id: 41, providerOrderId: "p-41", quantity: 1000, startCount: 0, remains: 1000, status: "pending" }], update: () => ({ where: async () => undefined }) } : { insert: async () => [{ id: 12 }], update: () => ({ where: async () => { runUpdates.push({ status: "completed", itemsProcessed: 1 }); } }) },
    };
    await scheduledSyncHandler({ path: "/api/scheduled/sync-orders", originalUrl: "/api/scheduled/sync-orders" } as any, res, { authenticate: vi.fn().mockResolvedValue({ isCron: true, taskUid: "task-12" }), getDb: vi.fn().mockResolvedValue(fakeDb), fetchProviderStatus: vi.fn().mockImplementation(async (...args) => { return { status: "Completed", remains: "0", start_count: "10" }; }) });
    expect(res.result.body).toEqual({ ok: true, runId: 12, processed: 1 });
    expect(runUpdates.at(-1)).toMatchObject({ status: "completed", itemsProcessed: 1 });
  });

  it("continues after provider polling errors and closes the run with zero processed", async () => {
    const res = response();
    const runUpdates: unknown[] = [];
    const fakeDb = {
      from: (table: string) => table === "smm_providers" ? { select: () => ({ where: () => ({ limit: async () => [{ id: 3, apiUrl: "https://provider.example", apiKey: "secret" }] }) }) } : table === "orders" ? { select: async () => [{ id: 42, providerOrderId: "p-42", quantity: 1000, startCount: 0, remains: 1000, status: "pending" }], update: () => ({ where: async () => undefined }) } : { insert: async () => [{ id: 13 }], update: () => ({ where: async () => { runUpdates.push({ status: "completed", itemsProcessed: 0 }); } }) },
    };
    await scheduledSyncHandler({ path: "/api/scheduled/sync-orders", originalUrl: "/api/scheduled/sync-orders" } as any, res, { authenticate: vi.fn().mockResolvedValue({ isCron: true, taskUid: "task-13" }), getDb: vi.fn().mockResolvedValue(fakeDb), fetchProviderStatus: vi.fn().mockRejectedValue(new Error("provider timeout")) });
    expect(res.result.body).toEqual({ ok: true, runId: 13, processed: 0 });
    expect(runUpdates.at(-1)).toMatchObject({ status: "completed", itemsProcessed: 0 });
  });

  it("creates and closes a visible sync run when no provider is configured", async () => {
    const res = response();
    const runUpdates: unknown[] = [];
    const fakeDb = {
      from: (table: string) => table === "smm_providers" ? { select: () => ({ where: () => ({ limit: async () => [] }) }) } : { insert: async () => [{ id: 9 }], update: () => ({ where: async () => { runUpdates.push({ status: "failed", errorMessage: "No active provider configured" }); } }) },
    };
    await scheduledSyncHandler({ path: "/api/scheduled/sync-orders", originalUrl: "/api/scheduled/sync-orders" } as any, res, { authenticate: vi.fn().mockResolvedValue({ isCron: true, taskUid: "task-9" }), getDb: vi.fn().mockResolvedValue(fakeDb) });
    expect(res.result.body).toEqual({ ok: true, skipped: "no-provider" });
    expect(runUpdates[0]).toMatchObject({ status: "failed", errorMessage: "No active provider configured" });
  });
});
