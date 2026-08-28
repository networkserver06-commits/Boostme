import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { chargeWallet, getActiveServices, getDb, getOrCreateProfile, getUserOrders, getUserWallet, listAdminUsers, listProviders, listSyncRuns, recordAudit, refundOrder, orders, profiles, services, smmProviders, syncRuns, syncSchedules, users, walletTransactions, eq, desc, sql } from "./db";
import { fetchProviderServices, mapCatalogService, submitProviderOrder } from "./provider";
import { createHeartbeatJob } from "./_core/heartbeat";
import { parse as parseCookie } from "cookie";

const serviceInput = z.object({
  name: z.string().min(3),
  platform: z.string().min(2),
  category: z.string().min(2),
  description: z.string().optional(),
  retailRatePer1k: z.number().nonnegative(),
  wholesaleRatePer1k: z.number().nonnegative(),
  minQuantity: z.number().int().positive(),
  maxQuantity: z.number().int().positive(),
  tags: z.string().optional(),
  providerId: z.number().int().positive().optional(),
  providerServiceId: z.string().optional(),
});

const adminOnly = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Administrator access required" });
  return next({ ctx });
});

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  public: router({
    services: publicProcedure.query(() => getActiveServices()),
    stats: publicProcedure.query(async () => {
      const db = await getDb();
      if (!db) return { orders: 0, users: 0, services: 0 };
      const [orderCount, userCount, serviceCount] = await Promise.all([
        db.select({ count: sql<number>`count(*)` }).from(orders),
        db.select({ count: sql<number>`count(*)` }).from(users),
        db.select({ count: sql<number>`count(*)` }).from(services).where(eq(services.isActive, 1)),
      ]);
      return { orders: Number(orderCount[0]?.count ?? 0), users: Number(userCount[0]?.count ?? 0), services: Number(serviceCount[0]?.count ?? 0) };
    }),
  }),
  dashboard: router({
    overview: protectedProcedure.query(async ({ ctx }) => {
      const profile = await getOrCreateProfile(ctx.user);
      const [userOrders, wallet] = await Promise.all([getUserOrders(ctx.user.id), getUserWallet(ctx.user.id)]);
      const spent = userOrders.reduce((sum, order) => sum + Number(order.charge), 0);
      return { profile, orders: userOrders.slice(0, 5), wallet: wallet.slice(0, 6), metrics: { totalOrders: userOrders.length, pendingOrders: userOrders.filter(order => ['pending', 'in_progress'].includes(order.status)).length, totalSpent: spent } };
    }),
    services: protectedProcedure.query(() => getActiveServices()),
    orders: protectedProcedure.query(({ ctx }) => getUserOrders(ctx.user.id)),
    wallet: protectedProcedure.query(({ ctx }) => getUserWallet(ctx.user.id)),
    createOrder: protectedProcedure.input(z.object({ serviceId: z.number().int().positive(), targetLink: z.string().url(), quantity: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const service = (await db.select().from(services).where(eq(services.id, input.serviceId)).limit(1))[0];
      if (!service || service.isActive !== 1) throw new TRPCError({ code: "NOT_FOUND", message: "Service is not available" });
      const host = new URL(input.targetLink).hostname.toLowerCase();
      const validHosts: Record<string, string[]> = { Instagram: ["instagram.com", "www.instagram.com"], TikTok: ["tiktok.com", "www.tiktok.com"], YouTube: ["youtube.com", "www.youtube.com", "youtu.be"] };
      const allowed = validHosts[service.platform];
      if (allowed && !allowed.some((item) => host === item || host.endsWith(`.${item}`))) throw new TRPCError({ code: "BAD_REQUEST", message: `Target URL must be a valid ${service.platform} link` });
      if (input.quantity < service.minQuantity || input.quantity > service.maxQuantity) throw new TRPCError({ code: "BAD_REQUEST", message: `Quantity must be between ${service.minQuantity.toLocaleString()} and ${service.maxQuantity.toLocaleString()}` });
      const charge = Number((Number(service.retailRatePer1k) * input.quantity / 1000).toFixed(2));
      try {
        const orderId = await chargeWallet({ userId: ctx.user.id, serviceId: input.serviceId, targetLink: input.targetLink, quantity: input.quantity, charge });
        const provider = service.providerId ? (await db.select().from(smmProviders).where(eq(smmProviders.id, service.providerId)).limit(1))[0] : undefined;
        if (provider && service.providerServiceId) {
          let providerOrder: { order: string } | undefined;
          let lastError: unknown;
          for (let attempt = 0; attempt < 3 && !providerOrder; attempt += 1) {
            try { providerOrder = await submitProviderOrder(provider.apiUrl, provider.apiKey, { service: service.providerServiceId, link: input.targetLink, quantity: input.quantity }); } catch (error) { lastError = error; }
          }
          if (!providerOrder) {
            await refundOrder({ userId: ctx.user.id, orderId, amount: charge, reason: `Provider fulfillment failed: ${String(lastError)}` });
            throw new TRPCError({ code: "BAD_GATEWAY", message: "Provider fulfillment failed; the charge was refunded" });
          }
          await db.update(orders).set({ providerOrderId: providerOrder.order, status: "in_progress" }).where(eq(orders.id, orderId));
        }
        await recordAudit({ actorUserId: ctx.user.id, action: "order.created", entityType: "order", entityId: String(orderId), details: { serviceId: input.serviceId, charge, providerSubmitted: Boolean(provider) } });
        return { orderId, charge };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Unable to create order" });
      }
    }),
    requestDeposit: protectedProcedure.input(z.object({ amount: z.number().positive(), phone: z.string().min(9) })).mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const profile = await getOrCreateProfile(ctx.user);
      await db.insert(walletTransactions).values({ userId: ctx.user.id, amount: input.amount.toFixed(2), type: "deposit", status: "pending", reference: `deposit-${Date.now()}`, paymentMethod: "M-Pesa", balanceAfter: profile?.balance ?? "0.00" });
      await recordAudit({ actorUserId: ctx.user.id, action: "wallet.deposit_requested", entityType: "wallet", details: { amount: input.amount, phone: input.phone } });
      return { status: "pending" as const };
    }),
  }),
  admin: router({
    metrics: adminOnly.query(async () => {
      const db = await getDb();
      if (!db) return { users: 0, orders: 0, revenue: 0, walletLiability: 0, activeServices: 0, failedSyncs: 0 };
      const [userCount, orderRows, profileRows, serviceCount, failedRows] = await Promise.all([
        db.select({ count: sql<number>`count(*)` }).from(users),
        db.select().from(orders),
        db.select().from(profiles),
        db.select({ count: sql<number>`count(*)` }).from(services).where(eq(services.isActive, 1)),
        db.select({ count: sql<number>`count(*)` }).from(syncRuns).where(eq(syncRuns.status, "failed")),
      ]);
      return { users: Number(userCount[0]?.count ?? 0), orders: orderRows.length, revenue: orderRows.reduce((sum, order) => sum + Number(order.charge), 0), walletLiability: profileRows.reduce((sum, profile) => sum + Number(profile.balance), 0), activeServices: Number(serviceCount[0]?.count ?? 0), failedSyncs: Number(failedRows[0]?.count ?? 0) };
    }),
    users: adminOnly.query(() => listAdminUsers()),
    orders: adminOnly.query(async () => { const db = await getDb(); return db ? db.select().from(orders).orderBy(desc(orders.createdAt)).limit(100) : []; }),
    walletActivity: adminOnly.query(async () => { const db = await getDb(); return db ? db.select().from(walletTransactions).orderBy(desc(walletTransactions.createdAt)).limit(100) : []; }),
    services: adminOnly.query(async () => { const db = await getDb(); return db ? db.select().from(services).orderBy(desc(services.createdAt)) : []; }),
    providers: adminOnly.query(() => listProviders()),
    providerCatalog: adminOnly.input(z.object({ providerId: z.number().int().positive() })).query(async ({ input }) => {
      const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const provider = (await db.select().from(smmProviders).where(eq(smmProviders.id, input.providerId)).limit(1))[0];
      if (!provider) throw new TRPCError({ code: "NOT_FOUND", message: "Provider not found" });
      const remote = await fetchProviderServices(provider.apiUrl, provider.apiKey);
      const local = await db.select().from(services).where(eq(services.providerId, provider.id));
      const mapped = new Map(local.filter(item => item.providerServiceId).map(item => [item.providerServiceId, item]));
      return remote.map(item => ({ ...item, providerServiceId: String(item.service), localService: mapped.get(String(item.service)) ?? null }));
    }),
    syncProviderServices: adminOnly.input(z.object({ providerId: z.number().int().positive(), serviceIds: z.array(z.string().min(1)).min(1), markupPercent: z.number().min(0).max(1000).default(150) })).mutation(async ({ ctx, input }) => {
      const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const provider = (await db.select().from(smmProviders).where(eq(smmProviders.id, input.providerId)).limit(1))[0];
      if (!provider) throw new TRPCError({ code: "NOT_FOUND", message: "Provider not found" });
      const remote = await fetchProviderServices(provider.apiUrl, provider.apiKey);
      const selected = remote.filter(item => input.serviceIds.includes(String(item.service)));
      let synced = 0;
      const failures: Array<{ providerServiceId: string; error: string }> = [];
      for (const item of selected) {
        const providerServiceId = String(item.service);
        try {
          const values = mapCatalogService(item, provider.id, input.markupPercent);
          const existing = (await db.select().from(services).where(eq(services.providerServiceId, providerServiceId)).limit(1))[0];
          if (existing) await db.update(services).set(values).where(eq(services.id, existing.id)); else await db.insert(services).values(values);
          synced += 1;
        } catch (error) {
          const failure = { providerServiceId, error: error instanceof Error ? error.message : String(error) };
          failures.push(failure);
          await recordAudit({ actorUserId: ctx.user.id, action: "provider.service_mapping_failed", entityType: "provider_service", entityId: providerServiceId, details: failure });
        }
      }
      await db.update(smmProviders).set({ lastSyncAt: new Date() }).where(eq(smmProviders.id, provider.id));
      await recordAudit({ actorUserId: ctx.user.id, action: "provider.services_synced", entityType: "provider", entityId: String(provider.id), details: { selected: input.serviceIds.length, synced, failures, markupPercent: input.markupPercent } });
      return { synced, requested: input.serviceIds.length, failures };
    }),
    syncRuns: adminOnly.query(() => listSyncRuns()),
    upsertService: adminOnly.input(serviceInput.extend({ id: z.number().int().positive().optional(), isActive: z.number().int().min(0).max(1).optional() })).mutation(async ({ ctx, input }) => {
      const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const values = { name: input.name, platform: input.platform, category: input.category, description: input.description, retailRatePer1k: input.retailRatePer1k.toFixed(4), wholesaleRatePer1k: input.wholesaleRatePer1k.toFixed(4), minQuantity: input.minQuantity, maxQuantity: input.maxQuantity, tags: input.tags, providerId: input.providerId, providerServiceId: input.providerServiceId, isActive: input.isActive ?? 1 };
      if (input.id) await db.update(services).set(values).where(eq(services.id, input.id)); else await db.insert(services).values(values);
      await recordAudit({ actorUserId: ctx.user.id, action: input.id ? "service.updated" : "service.created", entityType: "service", entityId: input.id ? String(input.id) : undefined });
      return { success: true };
    }),
    toggleService: adminOnly.input(z.object({ id: z.number().int().positive(), isActive: z.number().int().min(0).max(1) })).mutation(async ({ ctx, input }) => {
      const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      await db.update(services).set({ isActive: input.isActive }).where(eq(services.id, input.id));
      await recordAudit({ actorUserId: ctx.user.id, action: "service.toggled", entityType: "service", entityId: String(input.id), details: input });
      return { success: true };
    }),
    adjustBalance: adminOnly.input(z.object({ userId: z.number().int().positive(), amount: z.number(), note: z.string().min(3) })).mutation(async ({ ctx, input }) => {
      const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const profile = (await db.select().from(profiles).where(eq(profiles.userId, input.userId)).limit(1))[0];
      if (!profile) throw new TRPCError({ code: "NOT_FOUND", message: "Wallet profile not found" });
      const nextBalance = Number(profile.balance) + input.amount;
      if (nextBalance < 0) throw new TRPCError({ code: "BAD_REQUEST", message: "Balance cannot become negative" });
      await db.update(profiles).set({ balance: nextBalance.toFixed(2) }).where(eq(profiles.userId, input.userId));
      await db.insert(walletTransactions).values({ userId: input.userId, amount: input.amount.toFixed(2), type: "adjustment", status: "completed", reference: `admin-${Date.now()}`, paymentMethod: "admin", balanceAfter: nextBalance.toFixed(2) });
      await recordAudit({ actorUserId: ctx.user.id, action: "wallet.adjusted", entityType: "profile", entityId: String(input.userId), details: { ...input, nextBalance } });
      return { success: true, balance: nextBalance };
    }),
    saveProvider: adminOnly.input(z.object({ id: z.number().int().positive().optional(), name: z.string().min(2), apiUrl: z.string().url(), apiKey: z.string().min(4), isActive: z.number().int().min(0).max(1).default(1) })).mutation(async ({ ctx, input }) => {
      const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      if (input.id) await db.update(smmProviders).set({ name: input.name, apiUrl: input.apiUrl, apiKey: input.apiKey, isActive: input.isActive }).where(eq(smmProviders.id, input.id)); else await db.insert(smmProviders).values(input);
      await recordAudit({ actorUserId: ctx.user.id, action: input.id ? "provider.updated" : "provider.created", entityType: "provider", entityId: input.id ? String(input.id) : undefined });
      return { success: true };
    }),
    markDepositCompleted: adminOnly.input(z.object({ transactionId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const tx = (await db.select().from(walletTransactions).where(eq(walletTransactions.id, input.transactionId)).limit(1))[0];
      if (!tx || tx.status !== "pending") throw new TRPCError({ code: "BAD_REQUEST", message: "Deposit is not pending" });
      const profile = (await db.select().from(profiles).where(eq(profiles.userId, tx.userId)).limit(1))[0];
      if (!profile) throw new TRPCError({ code: "NOT_FOUND", message: "Wallet profile not found" });
      const nextBalance = Number(profile.balance) + Number(tx.amount);
      await db.update(profiles).set({ balance: nextBalance.toFixed(2) }).where(eq(profiles.userId, tx.userId));
      await db.update(walletTransactions).set({ status: "completed", balanceAfter: nextBalance.toFixed(2) }).where(eq(walletTransactions.id, input.transactionId));
      await recordAudit({ actorUserId: ctx.user.id, action: "wallet.deposit_completed", entityType: "wallet_transaction", entityId: String(input.transactionId) });
      return { success: true };
    }),
    provisionSyncSchedules: adminOnly.mutation(async ({ ctx }) => {
      const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const sessionToken = parseCookie(ctx.req.headers.cookie ?? "")[COOKIE_NAME] ?? "";
      const catalog = await createHeartbeatJob({ name: "orbit-sync-catalog", cron: "0 */30 * * * *", path: "/api/scheduled/sync-catalog", description: "Sync provider service catalog every 30 minutes" }, sessionToken);
      const orderStatus = await createHeartbeatJob({ name: "orbit-sync-orders", cron: "0 */10 * * * *", path: "/api/scheduled/sync-orders", description: "Sync outstanding provider orders every 10 minutes" }, sessionToken);
      await db.insert(syncSchedules).values([{ kind: "catalog", taskUid: catalog.taskUid, cron: "0 */30 * * * *", isActive: 1 }, { kind: "orders", taskUid: orderStatus.taskUid, cron: "0 */10 * * * *", isActive: 1 }]).onDuplicateKeyUpdate({ set: { taskUid: orderStatus.taskUid, cron: "0 */10 * * * *", isActive: 1 } });
      await recordAudit({ actorUserId: ctx.user.id, action: "sync.schedules_provisioned", entityType: "heartbeat", details: { catalog: catalog.taskUid, orders: orderStatus.taskUid } });
      return { catalog, orderStatus };
    }),
    runSync: adminOnly.input(z.object({ kind: z.enum(["catalog", "orders"]) })).mutation(async ({ ctx, input }) => {
      const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const [run] = await db.insert(syncRuns).values({ kind: input.kind, status: "running", itemsProcessed: 0 }).$returningId();
      await recordAudit({ actorUserId: ctx.user.id, action: `sync.${input.kind}.requested`, entityType: "sync_run", entityId: String(run.id) });
      return { runId: run.id, message: "Sync queued. Provider responses are recorded in the audit log." };
    }),
  }),
});

export type AppRouter = typeof appRouter;
