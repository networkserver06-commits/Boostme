import type { Request, Response } from "express";
import { and, ensureEnvironmentProvider, desc, eq, getDb, orders, recordAudit, services, smmProviders, syncRuns } from "./db";
import { fetchProviderServices, fetchProviderStatus, getProviderServiceId, mapCatalogService, mapProviderStatus } from "./provider";

export const OUTSTANDING_ORDER_STATUSES = ["pending", "in_progress", "partial"] as const;
export const isAuthorizedCron = (user: { isCron?: boolean; taskUid?: string }) => Boolean(user.isCron && user.taskUid);
export const syncResult = (processed: number, error?: unknown) => error ? { status: "failed" as const, itemsProcessed: processed, errorMessage: String(error) } : { status: "completed" as const, itemsProcessed: processed };

type CronUser = { isCron: true; taskUid: string };
type SyncDeps = { authenticate?: (req: Request) => Promise<CronUser>; getDb?: typeof getDb; fetchProviderServices?: typeof fetchProviderServices; fetchProviderStatus?: typeof fetchProviderStatus };
type SyncKind = "catalog" | "orders";
type AuditWriter = typeof recordAudit;

export async function executeProviderSync(kind: SyncKind, options: { taskUid?: string; actorUserId?: number; getDb?: typeof getDb; fetchProviderServices?: typeof fetchProviderServices; fetchProviderStatus?: typeof fetchProviderStatus; recordAudit?: AuditWriter } = {}) {
  const db = await (options.getDb ?? getDb)();
  if (!db) throw new Error("database-unavailable");
  const getServices = options.fetchProviderServices ?? fetchProviderServices;
  const getStatus = options.fetchProviderStatus ?? fetchProviderStatus;
  const audit = options.recordAudit ?? recordAudit;
  const provider = (await db.select().from(smmProviders).where(eq(smmProviders.isActive, 1)).limit(1))[0] ?? await ensureEnvironmentProvider(db);
  const [run] = await db.insert(syncRuns).values({ providerId: provider?.id ?? null, kind, status: "running", itemsProcessed: 0 }).returning();
  if (!provider) {
    if (run) await db.update(syncRuns).set({ status: "failed", errorMessage: "No active provider configured", finishedAt: new Date() }).where(eq(syncRuns.id, run.id));
    return { runId: run?.id ?? null, processed: 0, skipped: "no-provider" as const };
  }
  let processed = 0;
  try {
    if (kind === "catalog") {
      const catalog = await getServices(provider.apiUrl, provider.apiKey);
      const localCatalog = await db.select().from(services).where(eq(services.providerId, provider.id));
      const localByProviderServiceId = new Map(localCatalog.filter((service) => service.providerServiceId).map((service) => [service.providerServiceId!, service]));
      const liveProviderServiceIds = new Set<string>();
      for (const item of catalog) {
        const providerServiceId = getProviderServiceId(item);
        liveProviderServiceIds.add(providerServiceId);
        const existing = localByProviderServiceId.get(providerServiceId);
        const values = mapCatalogService(item, provider.id);
        const safe = Number(values.wholesaleRatePer1k) > 0 && Number(values.retailRatePer1k) > 0;
        if (existing) await db.update(services).set({ ...values, isActive: safe ? 1 : 0, needsResync: safe ? 0 : 1 }).where(eq(services.id, existing.id));
        else await db.insert(services).values({ ...values, isActive: safe ? 1 : 0, needsResync: safe ? 0 : 1 });
        processed += 1;
      }
      // A mapped service absent from the live provider catalog cannot be priced safely.
      for (const service of localCatalog) {
        if (service.providerServiceId && !liveProviderServiceIds.has(service.providerServiceId)) {
          await db.update(services).set({ isActive: 0, needsResync: 1 }).where(eq(services.id, service.id));
        }
      }
      await db.update(smmProviders).set({ lastSyncAt: new Date() }).where(eq(smmProviders.id, provider.id));
    } else {
      const allOrders = await db.select().from(orders);
      const outstanding = allOrders.filter((order) => !order.status || OUTSTANDING_ORDER_STATUSES.includes(order.status as (typeof OUTSTANDING_ORDER_STATUSES)[number]));
      for (const order of outstanding) {
        if (!order.providerOrderId) continue;
        try {
          const orderProvider = order.providerId === provider.id ? provider : order.providerId ? (await db.select().from(smmProviders).where(eq(smmProviders.id, order.providerId)).limit(1))[0] : provider;
          if (!orderProvider) continue;
          const status = await getStatus(orderProvider.apiUrl, orderProvider.apiKey, order.providerOrderId);
          await db.update(orders).set({ status: mapProviderStatus(status.status), startCount: Number(status.start_count ?? order.startCount ?? 0), remains: Number(status.remains ?? order.remains ?? order.quantity) }).where(eq(orders.id, order.id));
          processed += 1;
        } catch (error) {
          await audit({ actorUserId: options.actorUserId, action: "sync.order_failed", entityType: "order", entityId: String(order.id), details: { error: String(error) } });
        }
      }
    }
    if (run) await db.update(syncRuns).set({ ...syncResult(processed), finishedAt: new Date() }).where(eq(syncRuns.id, run.id));
    await audit({ actorUserId: options.actorUserId, action: `sync.${kind}.completed`, entityType: "sync_run", entityId: String(run?.id ?? "unknown"), details: { processed, taskUid: options.taskUid, trigger: options.actorUserId ? "admin" : "cron" } });
    return { runId: run?.id ?? null, processed };
  } catch (error) {
    if (run) await db.update(syncRuns).set({ ...syncResult(processed, error), finishedAt: new Date() }).where(eq(syncRuns.id, run.id));
    await audit({ actorUserId: options.actorUserId, action: `sync.${kind}.failed`, entityType: "sync_run", entityId: String(run?.id ?? "unknown"), details: { processed, taskUid: options.taskUid, error: String(error) } });
    throw error;
  }
}

async function authenticateVercelCron(req: Request): Promise<CronUser> {
  // Existing production projects use JWT_SECRET; retain CRON_SECRET as the preferred
  // dedicated value while allowing the documented deployment configuration to work.
  const expected = process.env.CRON_SECRET || process.env.JWT_SECRET;
  const authorization = req.headers.authorization;
  const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!expected || token !== expected) throw new Error("Unauthorized scheduled request");
  return { isCron: true, taskUid: req.headers["x-task-uid"]?.toString() || "vercel-cron" };
}

export async function scheduledSyncHandler(req: Request, res: Response, deps: SyncDeps = {}) {
  const authenticate = deps.authenticate ?? authenticateVercelCron;
  const timestamp = new Date().toISOString();
  try {
    const user = await authenticate(req);
    if (!isAuthorizedCron(user)) return res.status(403).json({ error: "cron-only" });
    const kind = req.path.endsWith("catalog") ? "catalog" : "orders";
    const result = await executeProviderSync(kind, { taskUid: user.taskUid, getDb: deps.getDb, fetchProviderServices: deps.fetchProviderServices, fetchProviderStatus: deps.fetchProviderStatus });
    if (result.skipped) return res.json({ ok: true, skipped: result.skipped });
    return res.json({ ok: true, ...result });
  } catch (error) {
    return res.status(500).json({ error: String(error), timestamp, context: { url: req.originalUrl } });
  }
}
