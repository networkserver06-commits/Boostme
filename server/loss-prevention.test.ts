import { describe, expect, it, vi } from "vitest";

const getDbMock = vi.hoisted(() => vi.fn());
const recordAuditMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
vi.mock("./db", async () => {
  const actual = await vi.importActual<typeof import("./db")>("./db");
  return { ...actual, getDb: getDbMock, recordAudit: recordAuditMock };
});

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

const customerContext = (): TrpcContext => ({
  user: { id: 7, email: "customer@example.com", name: "Customer", loginMethod: "password", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
  req: { protocol: "https", headers: {} } as TrpcContext["req"],
  res: {} as TrpcContext["res"],
});

describe("mandatory order loss prevention", () => {
  it("repairs an underpriced stored quote and requires customer review before any charge", async () => {
    const updates: unknown[] = [];
    const unsafeService = {
      id: 42,
      providerId: 9,
      providerServiceId: "likes-42",
      name: "TikTok Likes",
      platform: "TikTok",
      category: "Likes",
      wholesaleRatePer1k: "41.2600",
      retailRatePer1k: "0.8800",
      minQuantity: 100,
      maxQuantity: 100000,
      isActive: 1,
      needsResync: 0,
    };
    const fakeDb = {
      select: () => ({ from: () => ({ where: () => ({ limit: async () => [unsafeService] }) }) }),
      update: () => ({ set: (value: unknown) => ({ where: async () => { updates.push(value); } }) }),
    };
    getDbMock.mockResolvedValue(fakeDb);

    await expect(appRouter.createCaller(customerContext()).dashboard.createOrder({ serviceId: 42, targetLink: "https://www.tiktok.com/@boostme/video/123", quantity: 1000, expectedRetailRatePer1k: 0.88, expectedMinQuantity: 100, expectedMaxQuantity: 100000 })).rejects.toMatchObject({
      code: "CONFLICT",
      message: expect.stringContaining("Service price changed during checkout"),
    });

    expect(updates).toContainEqual({ wholesaleRatePer1k: "41.2600", retailRatePer1k: "49.5120" });
    expect(recordAuditMock).not.toHaveBeenCalledWith(expect.objectContaining({ action: "service.loss_blocked" }));
  });
});
