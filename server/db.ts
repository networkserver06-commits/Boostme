import { createClient, type Client } from "@libsql/client";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import { ENV } from "./_core/env";
import * as schema from "../drizzle/schema";
import { compareCustomerPlatforms, isCustomerVisiblePlatform, normalizeServicePresentation } from "../shared/serviceCatalog";

export type DbRow = Record<string, any>;
export type TursoDb = LibSQLDatabase<typeof schema.drizzleSchema>;

export const { users, profiles, smmProviders, services, orders, walletTransactions, syncSchedules, syncRuns, auditEvents, authSessions, authRateLimits } = schema;
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
    created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
  )`,
  `CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, service_id INTEGER NOT NULL, provider_id INTEGER, provider_order_id TEXT,
    target_link TEXT NOT NULL, quantity INTEGER NOT NULL, charge TEXT NOT NULL, start_count INTEGER, remains INTEGER,
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

export function getTursoClient() {
  const url = process.env.TURSO_DATABASE_URL?.trim() || (process.env.NODE_ENV === "production" ? "" : process.env.NODE_ENV === "test" ? "file::memory:" : "file:./.data/boostme.db");
  const authToken = process.env.TURSO_AUTH_TOKEN?.trim();
  if (!url || (!url.startsWith("file:") && !authToken)) return null;
  if (!_client) {
    if (url.startsWith("file:") && !url.startsWith("file::memory:")) mkdirSync(dirname(url.slice("file:".length)), { recursive: true });
    _client = createClient({ url, authToken });
    _db = drizzle(_client, { schema: schema.drizzleSchema });
  }
  return _client;
}

export async function initializeTursoSchema(client: Client) {
  await client.batch(schemaStatements.map((sql) => ({ sql })), "write");
  try { await client.execute("ALTER TABLE orders ADD COLUMN provider_id INTEGER"); } catch { /* Existing databases already have the column. */ }
  await client.execute("CREATE INDEX IF NOT EXISTS orders_provider_idx ON orders(provider_id, provider_order_id)");
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
  try { new URL(apiUrl); } catch { return null; }
  const db = dbOverride ?? await getDb();
  if (!db) return null;
  const active = (await db.select().from(smmProviders).where(eq(smmProviders.isActive, 1)).limit(1))[0];
  if (active) return active;
  const existing = (await db.select().from(smmProviders).where(eq(smmProviders.apiUrl, apiUrl)).limit(1))[0];
  if (existing) return existing.isActive ? existing : null;
  const [created] = await db.insert(smmProviders).values({ name: "ShakerGain", apiUrl, apiKey, isActive: 1 }).returning();
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
  return (await db.select().from(users).where(eq(users.email, email.trim().toLowerCase())).limit(1))[0];
}

export async function getOrCreateProfile(user: { id: number; email?: string | null }) {
  const db = await getDb();
  if (!db) return null;
  await db.insert(profiles).values({ userId: user.id, email: user.email ?? null }).onConflictDoNothing({ target: profiles.userId });
  return (await db.select().from(profiles).where(eq(profiles.userId, user.id)).limit(1))[0] ?? null;
}

export async function recordAudit(input: { actorUserId?: number; action: string; entityType: string; entityId?: string; details?: unknown }) {
  const db = await getDb();
  if (!db) return;
  await db.insert(auditEvents).values({ actorUserId: input.actorUserId, action: input.action, entityType: input.entityType, entityId: input.entityId, details: input.details ?? null });
}

export async function getActiveServices() {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select().from(services).where(eq(services.isActive, 1)).orderBy(asc(services.id));
  return rows.map(normalizeServicePresentation).filter((service) => isCustomerVisiblePlatform(service.platform)).sort((a, b) => compareCustomerPlatforms(a.platform, b.platform) || a.category.localeCompare(b.category) || a.id - b.id);
}

export async function getUserOrders(userId: number) {
  const db = await getDb();
  if (!db) return [];
  const [rows, catalog] = await Promise.all([
    db.select().from(orders).where(eq(orders.userId, userId)).orderBy(desc(orders.createdAt)),
    db.select().from(services),
  ]);
  const serviceById = new Map(catalog.map((service) => [service.id, normalizeServicePresentation(service)]));
  return rows.map((order) => ({ ...order, serviceName: serviceById.get(order.serviceId)?.name ?? `Service #${order.serviceId}`, servicePlatform: serviceById.get(order.serviceId)?.platform ?? "Other", serviceCategory: serviceById.get(order.serviceId)?.category ?? "Other services" }));
}

export async function getUserWallet(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(walletTransactions).where(eq(walletTransactions.userId, userId)).orderBy(desc(walletTransactions.createdAt));
}

export function applyWalletDelta(current: number, delta: number) {
  const next = Number((current + delta).toFixed(2));
  if (next < 0) throw new Error("Balance cannot become negative");
  return next;
}

export async function chargeWallet(input: { userId: number; serviceId: number; providerId?: number | null; targetLink: string; quantity: number; charge: number }) {
  const db = await getDb();
  if (!db) throw new Error("Turso database unavailable");
  return db.transaction(async (tx) => {
    const profile = (await tx.select().from(profiles).where(eq(profiles.userId, input.userId)).limit(1))[0];
    if (!profile || Number(profile.balance) < input.charge) throw new Error("Insufficient wallet balance");
    const nextBalance = applyWalletDelta(Number(profile.balance), -input.charge);
    await tx.update(profiles).set({ balance: nextBalance.toFixed(2) }).where(eq(profiles.userId, input.userId));
    const [created] = await tx.insert(orders).values({ userId: input.userId, serviceId: input.serviceId, providerId: input.providerId ?? null, targetLink: input.targetLink, quantity: input.quantity, charge: input.charge.toFixed(2), status: "pending" }).returning({ id: orders.id });
    if (!created) throw new Error("Unable to create order");
    await tx.insert(walletTransactions).values({ userId: input.userId, amount: (-input.charge).toFixed(2), type: "order_charge", status: "completed", reference: `order-${created.id}`, paymentMethod: "wallet", balanceAfter: nextBalance.toFixed(2) });
    return created.id;
  });
}

export function buildRefundAccounting(current: number, amount: number) {
  return { nextBalance: applyWalletDelta(current, amount).toFixed(2), ledgerAmount: amount.toFixed(2), status: "completed" as const };
}

export async function refundOrder(input: { userId: number; orderId: number; amount: number; reason: string; status?: "failed" | "canceled" }, dbOverride?: TursoDb) {
  const db = dbOverride ?? await getDb();
  if (!db) throw new Error("Turso database unavailable");
  return db.transaction(async (tx) => {
    const profile = (await tx.select().from(profiles).where(eq(profiles.userId, input.userId)).limit(1))[0];
    if (!profile) throw new Error("Wallet profile not found");
    const refund = buildRefundAccounting(Number(profile.balance), input.amount);
    await tx.update(profiles).set({ balance: refund.nextBalance }).where(eq(profiles.userId, input.userId));
    await tx.update(orders).set({ status: input.status ?? "failed", errorMessage: input.reason }).where(eq(orders.id, input.orderId));
    await tx.insert(walletTransactions).values({ userId: input.userId, amount: refund.ledgerAmount, type: "refund", status: refund.status, reference: `refund-${input.orderId}`, paymentMethod: "system", balanceAfter: refund.nextBalance });
    return refund.nextBalance;
  });
}

export async function listAdminUsers() {
  const db = await getDb();
  if (!db) return [];
  const [allUsers, allProfiles] = await Promise.all([db.select().from(users).orderBy(desc(users.createdAt)), db.select().from(profiles)]);
  return allUsers.map((user) => ({ user: { ...user, passwordHash: undefined }, profile: allProfiles.find((profile) => profile.userId === user.id) ?? null }));
}

export async function listProviders() {
  const db = await getDb();
  if (!db) return [];
  await ensureEnvironmentProvider(db);
  const rows = await db.select().from(smmProviders).orderBy(desc(smmProviders.createdAt));
  return rows.map(({ id, name, apiUrl, isActive, lastSyncAt, createdAt }) => ({ id, name, apiUrl, isActive, lastSyncAt, createdAt }));
}

export async function listSyncRuns() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(syncRuns).orderBy(desc(syncRuns.startedAt)).limit(20);
}
