import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { and, chargeWallet, getActiveServices, getDb, getOrCreateProfile, getUserByEmail, getUserOrders, getUserWallet, listAdminUsers, listProviders, listSyncRuns, recordAudit, refundOrder, settleDeposit, orders, profiles, services, smmProviders, syncRuns, syncSchedules, users, walletTransactions, eq, desc, sql } from "./db";
import { clearAuthAttempts, consumeAuthAttempt, createSession, hashPassword, normalizeEmail, readSessionToken, revokeSession, verifyPassword } from "./_core/passwordAuth";
import { cancelProviderOrder, fetchProviderServices, fetchProviderStatus, getProviderServiceId, mapCatalogService, mapProviderStatus, submitProviderOrder } from "./provider";
import { normalizeServicePresentation } from "../shared/serviceCatalog";
import { summarizeProfit } from "../shared/finance";
import { executeProviderSync } from "./scheduled";
import { createLeeTecStkPush, findLeeTecTransaction } from "./leetec";

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

const publicUser = <T extends { passwordHash?: string | null }>(user: T) => {
  const { passwordHash: _passwordHash, ...safeUser } = user;
  return safeUser;
};

const adminOnly = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Administrator access required" });
  return next({ ctx });
});

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    signup: publicProcedure.input(z.object({ name: z.string().trim().min(1).max(120), email: z.string().trim().email().max(320), password: z.string().min(8).max(256) })).mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Account service is not configured" });
      const email = normalizeEmail(input.email);
      if (!(await consumeAuthAttempt(email, ctx.req.ip || "unknown"))) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Too many account attempts. Wait 15 minutes and try again." });
      const existing = await getUserByEmail(email);
      if (existing) throw new TRPCError({ code: "CONFLICT", message: "An account with this email already exists. Sign in instead." });
      const passwordHash = await hashPassword(input.password);
      const isAdmin = Boolean(process.env.ADMIN_EMAIL?.trim()) && email === normalizeEmail(process.env.ADMIN_EMAIL!);
      try {
        const user = await db.transaction(async (tx) => {
          const [created] = await tx.insert(users).values({
            name: input.name.trim(), email, passwordHash, loginMethod: "password", role: isAdmin ? "admin" : "user",
            lastSignedIn: new Date(),
          }).returning();
          if (!created) throw new Error("Account creation failed");
          await tx.insert(profiles).values({ userId: created.id, email, balance: "0.00" });
          return created;
        });
        await createSession(user.id, ctx.res);
        await recordAudit({ actorUserId: user.id, action: "auth.account_created", entityType: "user", entityId: String(user.id), details: { admin: isAdmin } });
        return { user: publicUser(user) };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        const message = error instanceof Error ? error.message : "";
        const duplicateEmailError = /unique|constraint/i.test(message);
        if (duplicateEmailError) throw new TRPCError({ code: "CONFLICT", message: "An account with this email already exists. Sign in instead." });
        for (let attempt = 0; attempt < 3; attempt++) {
          let existing;
          try { existing = await getUserByEmail(email); } catch { break; }
          if (existing) throw new TRPCError({ code: "CONFLICT", message: "An account with this email already exists. Sign in instead." });
          if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 15 * (attempt + 1)));
        }
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Unable to create account. Please try again." });
      }
    }),
    signin: publicProcedure.input(z.object({ email: z.string().trim().email().max(320), password: z.string().min(1).max(256) })).mutation(async ({ ctx, input }) => {
      const email = normalizeEmail(input.email);
      if (!(await consumeAuthAttempt(email, ctx.req.ip || "unknown"))) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Too many sign-in attempts. Wait 15 minutes and try again." });
      const user = await getUserByEmail(email);
      if (!user || !(await verifyPassword(input.password, user.passwordHash))) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Email or password is incorrect." });
      }
      await clearAuthAttempts(email, ctx.req.ip || "unknown");
      const isAdmin = Boolean(process.env.ADMIN_EMAIL?.trim()) && email === normalizeEmail(process.env.ADMIN_EMAIL!);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Account service is not configured" });
      const now = new Date();
      const role = isAdmin ? "admin" : user.role;
      await db.update(users).set({ lastSignedIn: now, updatedAt: now, role }).where(eq(users.id, user.id));
      await createSession(user.id, ctx.res);
      await recordAudit({ actorUserId: user.id, action: "auth.signed_in", entityType: "user", entityId: String(user.id) });
      return { user: publicUser({ ...user, lastSignedIn: now, updatedAt: now, role }) };
    }),
    logout: publicProcedure.mutation(async ({ ctx }) => {
      await revokeSession(readSessionToken(ctx.req), ctx.res);
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
      return { profile, orders: userOrders.slice(0, 5), wallet: wallet.slice(0, 6), metrics: { totalOrders: userOrders.length, pendingOrders: userOrders.filter(order => ["pending", "in_progress"].includes(order.status)).length, totalSpent: spent } };
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
      const servicePlatform = normalizeServicePresentation(service).platform;
      const validHosts: Record<string, string[]> = { Instagram: ["instagram.com"], TikTok: ["tiktok.com"], YouTube: ["youtube.com", "youtu.be"], Facebook: ["facebook.com", "fb.watch", "fb.me"], X: ["x.com", "twitter.com"], WhatsApp: ["whatsapp.com", "wa.me"], Telegram: ["t.me", "telegram.me"] };
      const allowed = validHosts[servicePlatform];
      if (allowed && !allowed.some((item) => host === item || host.endsWith(`.${item}`))) throw new TRPCError({ code: "BAD_REQUEST", message: `Target URL must be a valid ${servicePlatform} link` });
      if (input.quantity < service.minQuantity || input.quantity > service.maxQuantity) throw new TRPCError({ code: "BAD_REQUEST", message: `Quantity must be between ${service.minQuantity.toLocaleString()} and ${service.maxQuantity.toLocaleString()}` });
      const charge = Number((Number(service.retailRatePer1k) * input.quantity / 1000).toFixed(2));
      const provider = service.providerId ? (await db.select().from(smmProviders).where(eq(smmProviders.id, service.providerId)).limit(1))[0] : undefined;
      try {
        const orderId = await chargeWallet({ userId: ctx.user.id, serviceId: input.serviceId, providerId: provider?.id, targetLink: input.targetLink, quantity: input.quantity, charge });
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
    refreshOrderStatus: protectedProcedure.input(z.object({ orderId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const order = (await db.select().from(orders).where(eq(orders.id, input.orderId)).limit(1))[0];
      if (!order || order.userId !== ctx.user.id) throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
      if (!order.providerOrderId || !order.providerId || ["completed", "canceled", "failed"].includes(order.status)) return order;
      const provider = (await db.select().from(smmProviders).where(eq(smmProviders.id, order.providerId)).limit(1))[0];
      if (!provider) throw new TRPCError({ code: "BAD_GATEWAY", message: "The order provider is no longer available" });
      const remote = await fetchProviderStatus(provider.apiUrl, provider.apiKey, order.providerOrderId);
      const status = mapProviderStatus(remote.status);
      await db.update(orders).set({ status, startCount: Number(remote.start_count ?? order.startCount ?? 0), remains: Number(remote.remains ?? order.remains ?? order.quantity) }).where(eq(orders.id, order.id));
      await recordAudit({ actorUserId: ctx.user.id, action: "order.status_refreshed", entityType: "order", entityId: String(order.id), details: { status, providerStatus: remote.status } });
      return (await db.select().from(orders).where(eq(orders.id, order.id)).limit(1))[0] ?? order;
    }),
    cancelOrder: protectedProcedure.input(z.object({ orderId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const order = (await db.select().from(orders).where(eq(orders.id, input.orderId)).limit(1))[0];
      if (!order || order.userId !== ctx.user.id) throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
      if (!["pending", "in_progress", "partial"].includes(order.status)) throw new TRPCError({ code: "BAD_REQUEST", message: "Only active orders can be canceled" });
      if (order.providerOrderId && order.providerId) {
        const provider = (await db.select().from(smmProviders).where(eq(smmProviders.id, order.providerId)).limit(1))[0];
        if (!provider) throw new TRPCError({ code: "BAD_GATEWAY", message: "The order provider is no longer available" });
        try { await cancelProviderOrder(provider.apiUrl, provider.apiKey, order.providerOrderId); } catch (error) { throw new TRPCError({ code: "BAD_GATEWAY", message: `Provider cancellation failed: ${error instanceof Error ? error.message : "try again"}` }); }
      }
      await refundOrder({ userId: ctx.user.id, orderId: order.id, amount: Number(order.charge), reason: "Order canceled by customer", status: "canceled" });
      await recordAudit({ actorUserId: ctx.user.id, action: "order.canceled", entityType: "order", entityId: String(order.id), details: { providerOrderId: order.providerOrderId } });
      return (await db.select().from(orders).where(eq(orders.id, order.id)).limit(1))[0];
    }),
    requestDeposit: protectedProcedure.input(z.object({ amount: z.number().int().min(50).max(150000), phone: z.string().min(9) })).mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const profile = await getOrCreateProfile(ctx.user);
      const reference = `OG-${ctx.user.id}-${Date.now()}`;
      await db.insert(walletTransactions).values({ userId: ctx.user.id, amount: input.amount.toFixed(2), type: "deposit", status: "pending", reference, paymentMethod: "M-Pesa / LeeTec", balanceAfter: profile?.balance ?? "0.00" });
      try {
        const response = await createLeeTecStkPush({ phoneNumber: input.phone, amount: input.amount, accountReference: reference });
        await recordAudit({ actorUserId: ctx.user.id, action: "wallet.deposit_requested", entityType: "wallet", entityId: reference, details: { amount: input.amount, phoneLast4: input.phone.replace(/\D/g, "").slice(-4), gateway: "leetec", response } });
        return { status: "pending" as const, reference, message: String(response.message ?? "M-Pesa prompt sent. Complete it on your phone.") };
      } catch (error) {
        await settleDeposit({ userId: ctx.user.id, reference, status: "FAILED" });
        throw new TRPCError({ code: "BAD_GATEWAY", message: error instanceof Error ? error.message : "LeeTec payment request failed" });
      }
    }),
    checkDeposit: protectedProcedure.input(z.object({ reference: z.string().min(6).max(80) })).mutation(async ({ ctx, input }) => {
      const result = await findLeeTecTransaction(input.reference);
      const settled = result.status === "PENDING" ? null : await settleDeposit({ userId: ctx.user.id, reference: input.reference, status: result.status });
      if (settled?.status === "completed") await recordAudit({ actorUserId: ctx.user.id, action: "wallet.deposit_completed", entityType: "wallet", entityId: input.reference, details: { gateway: "leetec", transaction: result.transaction } });
      if (settled?.status === "failed") await recordAudit({ actorUserId: ctx.user.id, action: "wallet.deposit_failed", entityType: "wallet", entityId: input.reference, details: { gateway: "leetec", transaction: result.transaction } });
      return { status: result.status.toLowerCase() as "pending" | "success" | "failed", reference: input.reference, balanceAfter: settled?.balanceAfter ?? null };
    }),
  }),
  admin: router({
    metrics: adminOnly.query(async () => {
      const db = await getDb();
      if (!db) return { users: 0, orders: 0, revenue: 0, grossRevenue: 0, providerCost: 0, refunds: 0, netRevenue: 0, profit: 0, marginPercent: 0, walletLiability: 0, activeServices: 0, failedSyncs: 0 };
      const [userCount, orderRows, profileRows, serviceRows, serviceCount, failedRows, refundRows] = await Promise.all([
        db.select({ count: sql<number>`count(*)` }).from(users),
        db.select().from(orders),
        db.select().from(profiles),
        db.select().from(services),
        db.select({ count: sql<number>`count(*)` }).from(services).where(eq(services.isActive, 1)),
        db.select({ count: sql<number>`count(*)` }).from(syncRuns).where(eq(syncRuns.status, "failed")),
        db.select({ amount: walletTransactions.amount }).from(walletTransactions).where(eq(walletTransactions.type, "refund")),
      ]);
      const serviceById = new Map(serviceRows.map((service) => [service.id, service]));
      const profit = summarizeProfit({ orders: orderRows.map((order) => ({ ...order, wholesaleRatePer1k: serviceById.get(order.serviceId)?.wholesaleRatePer1k ?? 0, retailRatePer1k: serviceById.get(order.serviceId)?.retailRatePer1k ?? 0 })), refunds: refundRows.map((row) => row.amount) });
      return { users: Number(userCount[0]?.count ?? 0), orders: orderRows.length, revenue: profit.grossRevenue, ...profit, walletLiability: profileRows.reduce((sum, profile) => sum + Number(profile.balance), 0), activeServices: Number(serviceCount[0]?.count ?? 0), failedSyncs: Number(failedRows[0]?.count ?? 0) };
    }),
    users: adminOnly.query(() => listAdminUsers()),
    orders: adminOnly.query(async () => { const db = await getDb(); return db ? db.select().from(orders).orderBy(desc(orders.createdAt)).limit(100) : []; }),
    walletActivity: adminOnly.query(async () => { const db = await getDb(); return db ? db.select().from(walletTransactions).orderBy(desc(walletTransactions.createdAt)).limit(100) : []; }),
    services: adminOnly.query(async () => { const db = await getDb(); const rows = db ? await db.select().from(services).orderBy(desc(services.createdAt)) : []; return rows.map(normalizeServicePresentation); }),
    providers: adminOnly.query(() => listProviders()),
    providerCatalog: adminOnly.input(z.object({ providerId: z.number().int().positive() })).query(async ({ input }) => {
      const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const provider = (await db.select().from(smmProviders).where(eq(smmProviders.id, input.providerId)).limit(1))[0];
      if (!provider) throw new TRPCError({ code: "NOT_FOUND", message: "Provider not found" });
      const remote = await fetchProviderServices(provider.apiUrl, provider.apiKey);
      const local = await db.select().from(services).where(eq(services.providerId, provider.id));
      const mapped = new Map(local.filter(item => item.providerServiceId).map(item => [item.providerServiceId, item]));
      return remote.map(item => { const providerServiceId = getProviderServiceId(item); return { ...item, providerServiceId, localService: mapped.get(providerServiceId) ?? null }; });
    }),
    syncProviderServices: adminOnly.input(z.object({ providerId: z.number().int().positive(), serviceIds: z.array(z.string().min(1)).min(1), markupPercent: z.number().min(0).max(1000).default(150) })).mutation(async ({ ctx, input }) => {
      const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const provider = (await db.select().from(smmProviders).where(eq(smmProviders.id, input.providerId)).limit(1))[0];
      if (!provider) throw new TRPCError({ code: "NOT_FOUND", message: "Provider not found" });
      const remote = await fetchProviderServices(provider.apiUrl, provider.apiKey);
      const selected = remote.filter(item => input.serviceIds.includes(getProviderServiceId(item)));
      let synced = 0;
      const failures: Array<{ providerServiceId: string; error: string }> = [];
      for (const item of selected) {
        const providerServiceId = getProviderServiceId(item);
        try {
          const values = mapCatalogService(item, provider.id, input.markupPercent);
          const existing = (await db.select().from(services).where(and(eq(services.providerId, provider.id), eq(services.providerServiceId, providerServiceId))).limit(1))[0];
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
      if (input.retailRatePer1k < input.wholesaleRatePer1k) throw new TRPCError({ code: "BAD_REQUEST", message: "Retail price cannot be lower than provider cost" });
      if (input.maxQuantity < input.minQuantity) throw new TRPCError({ code: "BAD_REQUEST", message: "Maximum quantity must be at least the minimum quantity" });
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
      await db.transaction(async tx => {
        await tx.update(profiles).set({ balance: nextBalance.toFixed(2) }).where(eq(profiles.userId, input.userId));
        await tx.insert(walletTransactions).values({ userId: input.userId, amount: input.amount.toFixed(2), type: "adjustment", status: "completed", reference: `admin-${Date.now()}`, paymentMethod: "admin", balanceAfter: nextBalance.toFixed(2) });
      });
      await recordAudit({ actorUserId: ctx.user.id, action: "wallet.adjusted", entityType: "profile", entityId: String(input.userId), details: { ...input, nextBalance } });
      return { success: true, balance: nextBalance };
    }),
    saveProvider: adminOnly.input(z.object({ id: z.number().int().positive().optional(), name: z.string().min(2), apiUrl: z.string().url(), apiKey: z.string().min(4).optional(), isActive: z.number().int().min(0).max(1).default(1) })).mutation(async ({ ctx, input }) => {
      const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      if (input.id) {
        const values = { name: input.name, apiUrl: input.apiUrl, isActive: input.isActive, ...(input.apiKey ? { apiKey: input.apiKey } : {}) };
        await db.update(smmProviders).set(values).where(eq(smmProviders.id, input.id));
      } else {
        if (!input.apiKey) throw new TRPCError({ code: "BAD_REQUEST", message: "An API key is required for a new provider" });
        await db.insert(smmProviders).values({ name: input.name, apiUrl: input.apiUrl, apiKey: input.apiKey, isActive: input.isActive });
      }
      await recordAudit({ actorUserId: ctx.user.id, action: input.id ? "provider.updated" : "provider.created", entityType: "provider", entityId: input.id ? String(input.id) : undefined });
      return { success: true };
    }),
    removeProvider: adminOnly.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const provider = (await db.select().from(smmProviders).where(eq(smmProviders.id, input.id)).limit(1))[0];
      if (!provider) throw new TRPCError({ code: "NOT_FOUND", message: "Provider not found" });
      if (provider.isActive) throw new TRPCError({ code: "BAD_REQUEST", message: "Pause the provider before removing it" });
      await db.delete(smmProviders).where(eq(smmProviders.id, input.id));
      await recordAudit({ actorUserId: ctx.user.id, action: "provider.removed", entityType: "provider", entityId: String(input.id), details: { name: provider.name } });
      return { success: true };
    }),
    toggleProvider: adminOnly.input(z.object({ id: z.number().int().positive(), isActive: z.boolean() })).mutation(async ({ ctx, input }) => {
      const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      await db.update(smmProviders).set({ isActive: input.isActive ? 1 : 0 }).where(eq(smmProviders.id, input.id));
      await recordAudit({ actorUserId: ctx.user.id, action: input.isActive ? "provider.activated" : "provider.paused", entityType: "provider", entityId: String(input.id) });
      return { success: true, isActive: input.isActive };
    }),
    testProvider: adminOnly.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const provider = (await db.select().from(smmProviders).where(eq(smmProviders.id, input.id)).limit(1))[0];
      if (!provider) throw new TRPCError({ code: "NOT_FOUND", message: "Provider not found" });
      try {
        const catalog = await fetchProviderServices(provider.apiUrl, provider.apiKey);
        await recordAudit({ actorUserId: ctx.user.id, action: "provider.connection_tested", entityType: "provider", entityId: String(provider.id), details: { services: catalog.length, ok: true } });
        return { ok: true, services: catalog.length, message: `Connection healthy · ${catalog.length} services available` };
      } catch (error) {
        await recordAudit({ actorUserId: ctx.user.id, action: "provider.connection_tested", entityType: "provider", entityId: String(provider.id), details: { ok: false, error: String(error) } });
        throw new TRPCError({ code: "BAD_GATEWAY", message: "Provider connection failed. Check the endpoint and credentials." });
      }
    }),
    markDepositCompleted: adminOnly.input(z.object({ transactionId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const tx = (await db.select().from(walletTransactions).where(eq(walletTransactions.id, input.transactionId)).limit(1))[0];
      if (!tx || tx.status !== "pending") throw new TRPCError({ code: "BAD_REQUEST", message: "Deposit is not pending" });
      const profile = (await db.select().from(profiles).where(eq(profiles.userId, tx.userId)).limit(1))[0];
      if (!profile) throw new TRPCError({ code: "NOT_FOUND", message: "Wallet profile not found" });
      const nextBalance = Number(profile.balance) + Number(tx.amount);
      await db.transaction(async transaction => {
        await transaction.update(profiles).set({ balance: nextBalance.toFixed(2) }).where(eq(profiles.userId, tx.userId));
        await transaction.update(walletTransactions).set({ status: "completed", balanceAfter: nextBalance.toFixed(2) }).where(eq(walletTransactions.id, input.transactionId));
      });
      await recordAudit({ actorUserId: ctx.user.id, action: "wallet.deposit_completed", entityType: "wallet_transaction", entityId: String(input.transactionId) });
      return { success: true };
    }),
    provisionSyncSchedules: adminOnly.mutation(async ({ ctx }) => {
      const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const schedules = [{ kind: "catalog" as const, taskUid: "vercel-cron-catalog", cron: "0 3 * * *" }, { kind: "orders" as const, taskUid: "vercel-cron-orders", cron: "30 3 * * *" }];
      for (const schedule of schedules) {
        const existing = (await db.select().from(syncSchedules).where(eq(syncSchedules.kind, schedule.kind)).limit(1))[0];
        if (existing) await db.update(syncSchedules).set({ taskUid: schedule.taskUid, cron: schedule.cron, isActive: 1 }).where(eq(syncSchedules.id, existing.id));
        else await db.insert(syncSchedules).values({ ...schedule, isActive: 1 });
      }
      await recordAudit({ actorUserId: ctx.user.id, action: "sync.schedules_provisioned", entityType: "vercel_cron", details: { schedules } });
      return { schedules };
    }),
    runSync: adminOnly.input(z.object({ kind: z.enum(["catalog", "orders"]) })).mutation(async ({ ctx, input }) => {
      await recordAudit({ actorUserId: ctx.user.id, action: `sync.${input.kind}.requested`, entityType: "sync_run", details: { trigger: "admin" } });
      try {
        const result = await executeProviderSync(input.kind, { actorUserId: ctx.user.id, taskUid: `admin-${ctx.user.id}-${Date.now()}` });
        return { ...result, message: result.skipped === "no-provider" ? "No active provider is configured." : `${result.processed} ${input.kind} item${result.processed === 1 ? "" : "s"} synchronized.` };
      } catch (error) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? error.message : "Synchronization failed" });
      }
    }),
  }),
});

export type AppRouter = typeof appRouter;
