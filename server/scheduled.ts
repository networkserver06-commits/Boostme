import type { Request, Response } from "express";
import { eq, sql } from "drizzle-orm";
import { sdk } from "./_core/sdk";
import { getDb, orders, recordAudit, services, smmProviders, syncRuns } from "./db";
import { fetchProviderServices, fetchProviderStatus, mapProviderStatus } from "./provider";

export const OUTSTANDING_ORDER_STATUSES = ["pending", "in_progress", "partial"] as const;
export const isAuthorizedCron = (user: { isCron?: boolean; taskUid?: string }) => Boolean(user.isCron && user.taskUid);
export const syncResult = (processed: number, error?: unknown) => error ? { status: "failed" as const, itemsProcessed: processed, errorMessage: String(error) } : { status: "completed" as const, itemsProcessed: processed };

type SyncDeps = { authenticate?: typeof sdk.authenticateRequest; getDb?: typeof getDb; fetchProviderServices?: typeof fetchProviderServices; fetchProviderStatus?: typeof fetchProviderStatus };

export async function scheduledSyncHandler(req: Request, res: Response, deps: SyncDeps = {}) {
  const authenticate = deps.authenticate ?? sdk.authenticateRequest.bind(sdk);
  const getDatabase = deps.getDb ?? getDb;
  const getServices = deps.fetchProviderServices ?? fetchProviderServices;
  const getStatus = deps.fetchProviderStatus ?? fetchProviderStatus;
  const timestamp = new Date().toISOString();
  try {
    const user = await authenticate(req);
    if (!isAuthorizedCron(user)) return res.status(403).json({ error: "cron-only" });
    const db = await getDatabase();
    if (!db) return res.status(500).json({ error: "database-unavailable" });
    const kind = req.path.endsWith("catalog") ? "catalog" : "orders";
    const provider = (await db.select().from(smmProviders).where(eq(smmProviders.isActive, 1)).limit(1))[0];
    const [run] = await db.insert(syncRuns).values({ providerId: provider?.id, kind, status: "running", itemsProcessed: 0 }).$returningId();
    if (!provider) {
      await db.update(syncRuns).set({ status: "failed", errorMessage: "No active provider configured", finishedAt: new Date() }).where(eq(syncRuns.id, run.id));
      return res.json({ ok: true, skipped: "no-provider" });
    }
    let processed = 0;
    if (kind === "catalog") {
      const catalog = await getServices(provider.apiUrl, provider.apiKey);
      for (const item of catalog) {
        const existing = (await db.select().from(services).where(eq(services.providerServiceId, String(item.service))).limit(1))[0];
        const values = { providerId: provider.id, providerServiceId: String(item.service), name: item.name, platform: item.category?.split(" ")[0] || "Social", category: item.category || item.type || "General", wholesaleRatePer1k: Number(item.rate).toFixed(4), retailRatePer1k: (Number(item.rate) * 2.5).toFixed(4), minQuantity: Number(item.min), maxQuantity: Number(item.max), isActive: 1 };
        if (existing) await db.update(services).set(values).where(eq(services.id, existing.id)); else await db.insert(services).values(values);
        processed += 1;
      }
      await db.update(smmProviders).set({ lastSyncAt: new Date() }).where(eq(smmProviders.id, provider.id));
    } else {
      const outstanding = await db.select().from(orders).where(sql`${orders.status} in ('pending', 'in_progress', 'partial')`);
      for (const order of outstanding) {
        if (!order.providerOrderId) continue;
        try {
          const status = await getStatus(provider.apiUrl, provider.apiKey, order.providerOrderId);
          await db.update(orders).set({ status: mapProviderStatus(status.status), startCount: Number(status.start_count ?? order.startCount ?? 0), remains: Number(status.remains ?? order.remains ?? order.quantity) }).where(eq(orders.id, order.id));
          processed += 1;
        } catch (error) {
          await recordAudit({ action: "sync.order_failed", entityType: "order", entityId: String(order.id), details: { error: String(error) } });
        }
      }
    }
    await db.update(syncRuns).set({ ...syncResult(processed), finishedAt: new Date() }).where(eq(syncRuns.id, run.id));
    await recordAudit({ action: `sync.${kind}.completed`, entityType: "sync_run", entityId: String(run.id), details: { processed, taskUid: user.taskUid } });
    return res.json({ ok: true, runId: run.id, processed });
  } catch (error) {
    return res.status(500).json({ error: String(error), timestamp, context: { url: req.originalUrl } });
  }
}
