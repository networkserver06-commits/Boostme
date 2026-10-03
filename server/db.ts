import { createClient, type Client } from "@libsql/client";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import { ENV } from "./_core/env";
import * as schema from "../drizzle/schema";
import {
  compareCustomerPlatforms,
  isCustomerVisiblePlatform,
  normalizeServicePresentation,
} from "../shared/serviceCatalog";
import {
  MIN_RETAIL_RATE_PER_1K_KES,
  formatTieredRetailRatePer1k,
} from "../shared/pricing";
import {
  enforceProviderRateFloor,
  fetchProviderServices,
  getProviderPricingContext,
  getProviderServiceId,
  mapCatalogService,
} from "./provider";

export type DbRow = Record<string, any>;
export type TursoDb = LibSQLDatabase<typeof schema.drizzleSchema>;

export const {
  users,
  profiles,
  smmProviders,
  services,
  orders,
  walletTransactions,
  syncSchedules,
  syncRuns,
  auditEvents,
  authSessions,
  authRateLimits,
} = schema;
export { and, asc, desc, eq, isNull, sql };

const schemaStatements = [
  `CREATE TABLE IF NOT EXISTS app_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, email TEXT NOT NULL COLLATE NOCASE UNIQUE,
    password_hash TEXT, login_method TEXT NOT NULL DEFAULT 'password', role TEXT NOT NULL DEFAULT 'user',
    created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000), updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    last_signed_in INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
  )`,
  `CREATE TABLE IF NOT EXISTS profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL UNIQUE, email TEXT, balance TEXT NOT NULL DEFAULT '0.00',
    api_key TEXT UNIQUE, is_active INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
  )`,
  `CREATE TABLE IF NOT EXISTS smm_providers (
    id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, api_url TEXT NOT NULL, api_key TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1, last_sync_at INTEGER, created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
  )`,
  `CREATE TABLE IF NOT EXISTS services (
    id INTEGER PRIMARY KEY AUTOINCREMENT, provider_id INTEGER, provider_service_id TEXT, name TEXT NOT NULL,
    platform TEXT NOT NULL, category TEXT NOT NULL, description TEXT, wholesale_rate_per1k TEXT NOT NULL DEFAULT '0.0000',
    retail_rate_per1k TEXT NOT NULL DEFAULT '0.0000', min_quantity INTEGER NOT NULL DEFAULT 100,
    max_quantity INTEGER NOT NULL DEFAULT 100000, tags TEXT, is_active INTEGER NOT NULL DEFAULT 1,
    needs_resync INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
  )`,
  `CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, service_id INTEGER NOT NULL, provider_id INTEGER, provider_order_id TEXT,
    target_link TEXT NOT NULL, quantity INTEGER NOT NULL, charge TEXT NOT NULL, wholesale_cost_kes REAL, retail_paid_kes REAL, net_profit_kes REAL, start_count INTEGER, remains INTEGER,
    status TEXT NOT NULL DEFAULT 'pending', error_message TEXT, created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
  )`,
  `CREATE TABLE IF NOT EXISTS wallet_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, amount TEXT NOT NULL, type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'completed', reference TEXT NOT NULL, payment_method TEXT, balance_after TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
  )`,
  `CREATE TABLE IF NOT EXISTS sync_schedules (
    id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT NOT NULL UNIQUE, task_uid TEXT NOT NULL UNIQUE,
    cron TEXT NOT NULL, is_active INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
  )`,
  `CREATE TABLE IF NOT EXISTS sync_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT, provider_id INTEGER, kind TEXT NOT NULL, status TEXT NOT NULL,
    items_processed INTEGER NOT NULL DEFAULT 0, error_message TEXT, started_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000), finished_at INTEGER
  )`,
  `CREATE TABLE IF NOT EXISTS audit_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT, actor_user_id INTEGER, action TEXT NOT NULL, entity_type TEXT NOT NULL,
    entity_id TEXT, details TEXT, created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
  )`,
  `CREATE TABLE IF NOT EXISTS auth_sessions (
    token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL, expires_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
  )`,
  `CREATE TABLE IF NOT EXISTS auth_rate_limits (
    key_hash TEXT PRIMARY KEY, window_started_at INTEGER NOT NULL, attempts INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE INDEX IF NOT EXISTS profiles_user_idx ON profiles(user_id)`,
  `CREATE INDEX IF NOT EXISTS services_active_idx ON services(is_active)`,
  `CREATE INDEX IF NOT EXISTS services_provider_service_idx ON services(provider_id, provider_service_id)`,
  `CREATE INDEX IF NOT EXISTS orders_user_idx ON orders(user_id)`,
  `CREATE INDEX IF NOT EXISTS orders_status_idx ON orders(status)`,
  `CREATE INDEX IF NOT EXISTS wallet_user_idx ON wallet_transactions(user_id)`,
  `CREATE INDEX IF NOT EXISTS auth_sessions_user_idx ON auth_sessions(user_id)`,
  `CREATE INDEX IF NOT EXISTS auth_sessions_expires_idx ON auth_sessions(expires_at)`,
];

let _client: Client | null = null;
let _db: TursoDb | null = null;
let schemaPromise: Promise<void> | null = null;
let catalogRefreshPromise: Promise<void> | null = null;
const CATALOG_VERIFIED_WINDOW_MS = 5 * 60 * 1000;

export function getTursoClient() {
  const url =
    process.env.TURSO_DATABASE_URL?.trim() ||
    (process.env.NODE_ENV === "production"
      ? ""
      : process.env.NODE_ENV === "test"
        ? "file::memory:"
        : "file:./.data/boostme.db");
  const authToken = process.env.TURSO_AUTH_TOKEN?.trim();
  if (!url || (!url.startsWith("file:") && !authToken)) return null;
  if (!_client) {
    if (url.startsWith("file:") && !url.startsWith("file::memory:"))
      mkdirSync(dirname(url.slice("file:".length)), { recursive: true });
    _client = createClient({ url, authToken });
    _db = drizzle(_client, { schema: schema.drizzleSchema });
  }
  return _client;
}

export async function initializeTursoSchema(client: Client) {
  await client.batch(
    schemaStatements.map(sql => ({ sql })),
    "write"
  );
  for (const column of [
    "provider_id INTEGER",
    "wholesale_cost_kes REAL",
    "retail_paid_kes REAL",
    "net_profit_kes REAL",
  ]) {
    try {
      await client.execute(`ALTER TABLE orders ADD COLUMN ${column}`);
    } catch {
      /* Existing databases already have the column. */
    }
  }
  try {
    await client.execute(
      "ALTER TABLE services ADD COLUMN needs_resync INTEGER NOT NULL DEFAULT 0"
    );
  } catch {
    /* Existing databases already have the column. */
  }
  await client.execute(
    "CREATE INDEX IF NOT EXISTS orders_provider_idx ON orders(provider_id, provider_order_id)"
  );
  await client.execute(
    "CREATE INDEX IF NOT EXISTS services_needs_resync_idx ON services(needs_resync)"
  );
}

export function setTursoClientForTesting(client: Client | null) {
  _client = client;
  _db = client ? drizzle(client, { schema: schema.drizzleSchema }) : null;
  schemaPromise = client ? initializeTursoSchema(client) : null;
}

export async function getDb(): Promise<TursoDb | null> {
  const client = getTursoClient();
  if (!client || !_db) return null;
  schemaPromise ??= (async () => {
    await initializeTursoSchema(client);
  })();
  try {
    await schemaPromise;
  } catch (error) {
    schemaPromise = null;
    throw error;
  }
  return _db;
}

export async function ensureEnvironmentProvider(dbOverride?: TursoDb) {
  const apiUrl = process.env.BASE_URL?.trim().replace(/\/$/, "");
  const apiKey = process.env.API_KEY?.trim();
  if (!apiUrl || !apiKey) return null;
  try {
    new URL(apiUrl);
  } catch {
    return null;
  }
  const db = dbOverride ?? (await getDb());
  if (!db) return null;
  const active = (
    await db
      .select()
      .from(smmProviders)
      .where(eq(smmProviders.isActive, 1))
      .limit(1)
  )[0];
  if (active) return active;
  const existing = (
    await db
      .select()
      .from(smmProviders)
      .where(eq(smmProviders.apiUrl, apiUrl))
      .limit(1)
  )[0];
  if (existing) return existing.isActive ? existing : null;
  const [created] = await db
    .insert(smmProviders)
    .values({ name: "ShakerGain", apiUrl, apiKey, isActive: 1 })
    .returning();
  return created ?? null;
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  return (await db.select().from(users).where(eq(users.id, id)).limit(1))[0];
}

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) return undefined;
  return (
    await db
      .select()
      .from(users)
      .where(eq(users.email, email.trim().toLowerCase()))
      .limit(1)
  )[0];
}

export async function getOrCreateProfile(user: {
  id: number;
  email?: string | null;
}) {
  const db = await getDb();
  if (!db) return null;
  await db
    .insert(profiles)
    .values({ userId: user.id, email: user.email ?? null })
    .onConflictDoNothing({ target: profiles.userId });
  return (
    (
      await db
        .select()
        .from(profiles)
        .where(eq(profiles.userId, user.id))
        .limit(1)
    )[0] ?? null
  );
}

export async function recordAudit(input: {
  actorUserId?: number;
  action: string;
  entityType: string;
  entityId?: string;
  details?: unknown;
}) {
  const db = await getDb();
  if (!db) return;
  await db.insert(auditEvents).values({
    actorUserId: input.actorUserId,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    details: input.details ?? null,
  });
}

export async function getActiveServices() {
  const db = await getDb();
  if (!db) return [];
  const readRows = () =>
    db
      .select()
      .from(services)
      .where(and(eq(services.isActive, 1), eq(services.needsResync, 0)))
      .orderBy(asc(services.id));
  let rows = await readRows();
  if (rows.length === 0) {
    await refreshCatalogFromProvider(db);
    rows = await readRows();
  } else {
    // Serve the verified local catalog immediately; provider sync should not
    // make customers wait for the order form to open.
    void refreshCatalogFromProvider(db);
  }
  for (const service of rows) {
    const safeWholesale = enforceProviderRateFloor(
      service.providerServiceId ?? "",
      service.name,
      Number(service.wholesaleRatePer1k)
    );
    const safeRetail = Math.max(
      MIN_RETAIL_RATE_PER_1K_KES,
      Number(formatTieredRetailRatePer1k(safeWholesale))
    );
    if (
      safeWholesale > Number(service.wholesaleRatePer1k) ||
      safeRetail !== Number(service.retailRatePer1k)
    ) {
      await db
        .update(services)
        .set({
          wholesaleRatePer1k: safeWholesale.toFixed(4),
          retailRatePer1k: safeRetail.toFixed(4),
          needsResync: 0,
        })
        .where(eq(services.id, service.id));
      service.wholesaleRatePer1k = safeWholesale.toFixed(4);
      service.retailRatePer1k = safeRetail.toFixed(4);
    }
  }
  return rows
    .map(normalizeServicePresentation)
    .filter(
      service =>
        Number(service.wholesaleRatePer1k) > 0 &&
        Number(service.retailRatePer1k) > 0 &&
        Number(service.retailRatePer1k) >= Number(service.wholesaleRatePer1k) &&
        isCustomerVisiblePlatform(service.platform)
    )
    .sort(
      (a, b) =>
        compareCustomerPlatforms(a.platform, b.platform) ||
        a.category.localeCompare(b.category) ||
        a.id - b.id
    );
}

async function refreshCatalogFromProvider(db: TursoDb) {
  if (catalogRefreshPromise) return catalogRefreshPromise;
  const activeProvider = (
    await db
      .select()
      .from(smmProviders)
      .where(eq(smmProviders.isActive, 1))
      .limit(1)
  )[0];
  if (
    activeProvider?.lastSyncAt &&
    Date.now() - activeProvider.lastSyncAt.getTime() <
      CATALOG_VERIFIED_WINDOW_MS
  )
    return;
  catalogRefreshPromise = (async () => {
    const providers = await db
      .select()
      .from(smmProviders)
      .where(eq(smmProviders.isActive, 1));
    for (const provider of providers) {
      try {
        const remote = await fetchProviderServices(
          provider.apiUrl,
          provider.apiKey
        );
        const remoteIds = new Set(remote.map(getProviderServiceId));
        const mapped = await db
          .select()
          .from(services)
          .where(eq(services.providerId, provider.id));
        const mappedByProviderId = new Map(
          mapped
            .filter(service => service.providerServiceId)
            .map(service => [service.providerServiceId!, service])
        );
        const client = getTursoClient();
        if (!client) throw new Error("Database client unavailable");
        const pricing = getProviderPricingContext(
          provider.name,
          provider.apiUrl
        );
        const statements = remote.map(item => {
          const providerServiceId = getProviderServiceId(item);
          const values = mapCatalogService(item, provider.id, pricing);
          const existing = mappedByProviderId.get(providerServiceId);
          const safe =
            Number(values.wholesaleRatePer1k) > 0 &&
            Number(values.retailRatePer1k) > 0;
          return existing
            ? {
                sql: "UPDATE services SET provider_id = ?, provider_service_id = ?, name = ?, platform = ?, category = ?, wholesale_rate_per1k = ?, retail_rate_per1k = ?, min_quantity = ?, max_quantity = ?, is_active = ?, needs_resync = ? WHERE id = ?",
                args: [
                  values.providerId,
                  values.providerServiceId,
                  values.name,
                  values.platform,
                  values.category,
                  values.wholesaleRatePer1k,
                  values.retailRatePer1k,
                  values.minQuantity,
                  values.maxQuantity,
                  safe ? 1 : 0,
                  safe ? 0 : 1,
                  existing.id,
                ],
              }
            : {
                sql: "INSERT INTO services (provider_id, provider_service_id, name, platform, category, wholesale_rate_per1k, retail_rate_per1k, min_quantity, max_quantity, is_active, needs_resync) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                args: [
                  values.providerId,
                  values.providerServiceId,
                  values.name,
                  values.platform,
                  values.category,
                  values.wholesaleRatePer1k,
                  values.retailRatePer1k,
                  values.minQuantity,
                  values.maxQuantity,
                  safe ? 1 : 0,
                  safe ? 0 : 1,
                ],
              };
        });
        for (let index = 0; index < statements.length; index += 50)
          await client.batch(statements.slice(index, index + 50), "write");
        const missing = mapped.filter(
          service =>
            service.providerServiceId &&
            !remoteIds.has(service.providerServiceId)
        );
        const missingStatements = missing.map(service => ({
          sql: "UPDATE services SET is_active = 0, needs_resync = 1 WHERE id = ?",
          args: [service.id],
        }));
        for (let index = 0; index < missingStatements.length; index += 50)
          await client.batch(
            missingStatements.slice(index, index + 50),
            "write"
          );
        await db
          .update(smmProviders)
          .set({ lastSyncAt: new Date() })
          .where(eq(smmProviders.id, provider.id));
      } catch (error) {
        console.error(
          `[CATALOG REFRESH FAILED] Provider ${provider.id}:`,
          error
        );
        await db
          .update(services)
          .set({ needsResync: 1 })
          .where(eq(services.providerId, provider.id));
      }
    }
  })().finally(() => {
    catalogRefreshPromise = null;
  });
  return catalogRefreshPromise;
}

export async function getUserOrders(userId: number) {
  const db = await getDb();
  if (!db) return [];
  const [rows, catalog] = await Promise.all([
    db
      .select()
      .from(orders)
      .where(eq(orders.userId, userId))
      .orderBy(desc(orders.createdAt)),
    db.select().from(services),
  ]);
  const serviceById = new Map(
    catalog.map(service => [service.id, normalizeServicePresentation(service)])
  );
  return rows.map(order => ({
    ...order,
    serviceName:
      serviceById.get(order.serviceId)?.name ?? `Service #${order.serviceId}`,
    servicePlatform: serviceById.get(order.serviceId)?.platform ?? "Other",
    serviceCategory:
      serviceById.get(order.serviceId)?.category ?? "Other services",
  }));
}

export async function getUserWallet(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(walletTransactions)
    .where(eq(walletTransactions.userId, userId))
    .orderBy(desc(walletTransactions.createdAt));
}

export async function settleDeposit(input: {
  userId: number;
  reference: string;
  status: "SUCCESS" | "FAILED";
}) {
  const db = await getDb();
  if (!db) throw new Error("Turso database unavailable");
  return db.transaction(async tx => {
    const transaction = (
      await tx
        .select()
        .from(walletTransactions)
        .where(
          and(
            eq(walletTransactions.userId, input.userId),
            eq(walletTransactions.reference, input.reference)
          )
        )
        .limit(1)
    )[0];
    if (!transaction) throw new Error("Deposit request not found");
    if (transaction.status !== "pending") return transaction;
    if (input.status === "FAILED") {
      await tx
        .update(walletTransactions)
        .set({ status: "failed" })
        .where(eq(walletTransactions.id, transaction.id));
      return { ...transaction, status: "failed" as const };
    }
    const profile = (
      await tx
        .select()
        .from(profiles)
        .where(eq(profiles.userId, input.userId))
        .limit(1)
    )[0];
    if (!profile) throw new Error("Wallet profile not found");
    const nextBalance = applyWalletDelta(
      Number(profile.balance),
      Number(transaction.amount)
    ).toFixed(2);
    await tx
      .update(profiles)
      .set({ balance: nextBalance })
      .where(eq(profiles.userId, input.userId));
    await tx
      .update(walletTransactions)
      .set({ status: "completed", balanceAfter: nextBalance })
      .where(eq(walletTransactions.id, transaction.id));
    return {
      ...transaction,
      status: "completed" as const,
      balanceAfter: nextBalance,
    };
  });
}

export function applyWalletDelta(current: number, delta: number) {
  const next = Number((current + delta).toFixed(2));
  if (next < 0) throw new Error("Balance cannot become negative");
  return next;
}

export async function chargeWallet(input: {
  userId: number;
  serviceId: number;
  providerId?: number | null;
  targetLink: string;
  quantity: number;
  charge: number;
  wholesaleCostKes: number;
  retailPaidKes: number;
  netProfitKes: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Turso database unavailable");
  return db.transaction(async tx => {
    const profile = (
      await tx
        .select()
        .from(profiles)
        .where(eq(profiles.userId, input.userId))
        .limit(1)
    )[0];
    if (!profile || Number(profile.balance) < input.charge)
      throw new Error("Insufficient wallet balance");
    const nextBalance = applyWalletDelta(
      Number(profile.balance),
      -input.charge
    );
    await tx
      .update(profiles)
      .set({ balance: nextBalance.toFixed(2) })
      .where(eq(profiles.userId, input.userId));
    const [created] = await tx
      .insert(orders)
      .values({
        userId: input.userId,
        serviceId: input.serviceId,
        providerId: input.providerId ?? null,
        targetLink: input.targetLink,
        quantity: input.quantity,
        charge: input.charge.toFixed(2),
        wholesaleCostKes: input.wholesaleCostKes,
        retailPaidKes: input.retailPaidKes,
        netProfitKes: input.netProfitKes,
        status: "pending",
      })
      .returning({ id: orders.id });
    if (!created) throw new Error("Unable to create order");
    await tx.insert(walletTransactions).values({
      userId: input.userId,
      amount: (-input.charge).toFixed(2),
      type: "order_charge",
      status: "completed",
      reference: `order-${created.id}`,
      paymentMethod: "wallet",
      balanceAfter: nextBalance.toFixed(2),
    });
    return created.id;
  });
}

export function buildRefundAccounting(current: number, amount: number) {
  return {
    nextBalance: applyWalletDelta(current, amount).toFixed(2),
    ledgerAmount: amount.toFixed(2),
    status: "completed" as const,
  };
}

export async function refundOrder(
  input: {
    userId: number;
    orderId: number;
    amount: number;
    reason: string;
    status?: "failed" | "canceled";
  },
  dbOverride?: TursoDb
) {
  const db = dbOverride ?? (await getDb());
  if (!db) throw new Error("Turso database unavailable");
  return db.transaction(async tx => {
    const profile = (
      await tx
        .select()
        .from(profiles)
        .where(eq(profiles.userId, input.userId))
        .limit(1)
    )[0];
    if (!profile) throw new Error("Wallet profile not found");
    const refund = buildRefundAccounting(Number(profile.balance), input.amount);
    await tx
      .update(profiles)
      .set({ balance: refund.nextBalance })
      .where(eq(profiles.userId, input.userId));
    await tx
      .update(orders)
      .set({ status: input.status ?? "failed", errorMessage: input.reason })
      .where(
        and(eq(orders.id, input.orderId), eq(orders.userId, input.userId))
      );
    await tx.insert(walletTransactions).values({
      userId: input.userId,
      amount: refund.ledgerAmount,
      type: "refund",
      status: refund.status,
      reference: `refund-${input.orderId}`,
      paymentMethod: "system",
      balanceAfter: refund.nextBalance,
    });
    return refund.nextBalance;
  });
}

export async function listAdminUsers() {
  const db = await getDb();
  if (!db) return [];
  const [allUsers, allProfiles] = await Promise.all([
    db.select().from(users).orderBy(desc(users.createdAt)),
    db.select().from(profiles),
  ]);
  return allUsers.map(user => ({
    user: { ...user, passwordHash: undefined },
    profile: allProfiles.find(profile => profile.userId === user.id) ?? null,
  }));
}

export async function listProviders() {
  const db = await getDb();
  if (!db) return [];
  await ensureEnvironmentProvider(db);
  const rows = await db
    .select()
    .from(smmProviders)
    .orderBy(desc(smmProviders.createdAt));
  return rows.map(({ id, name, apiUrl, isActive, lastSyncAt, createdAt }) => ({
    id,
    name,
    apiUrl,
    isActive,
    lastSyncAt,
    createdAt,
  }));
}

export async function listSyncRuns() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(syncRuns).orderBy(desc(syncRuns.startedAt)).limit(20);
}
