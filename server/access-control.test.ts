import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

const context = (role: "user" | "admin"): TrpcContext => ({
  user: { id: 7, openId: "test-user", email: "test@example.com", name: "Test User", loginMethod: "manus", role, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
  req: { protocol: "https", headers: {} } as TrpcContext["req"],
  res: {} as TrpcContext["res"],
});

describe("admin authorization", () => {
  it("rejects client users before admin data access", async () => {
    const caller = appRouter.createCaller(context("user"));
    await expect(caller.admin.metrics()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("allows administrators through the role gate", async () => {
    const caller = appRouter.createCaller(context("admin"));
    await expect(caller.admin.metrics()).resolves.toBeDefined();
  });

  it("protects provider catalog mapping procedures from clients", async () => {
    const caller = appRouter.createCaller(context("user"));
    await expect(caller.admin.providerCatalog({ providerId: 1 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.admin.syncProviderServices({ providerId: 1, serviceIds: ["7"], markupPercent: 150 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.admin.toggleProvider({ id: 1, isActive: true })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.admin.testProvider({ id: 1 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.admin.runSync({ kind: "catalog" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
