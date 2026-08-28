import { ENV } from "./_core/env";

export type DbRow = Record<string, any>;

const tableNames = {
  users: "app_users",
  profiles: "profiles",
  smmProviders: "smm_providers",
  services: "services",
  orders: "orders",
  walletTransactions: "wallet_transactions",
  syncSchedules: "sync_schedules",
  syncRuns: "sync_runs",
  auditEvents: "audit_events",
} as const;

type Column = { table: string; field: string };
const columns = (table: string, names: string[]) => Object.fromEntries(names.map((field) => [field, { table, field }])) as Record<string, Column>;

export const users = columns(tableNames.users, ["id", "openId", "name", "email", "loginMethod", "role", "createdAt", "updatedAt", "lastSignedIn"]);
export const profiles = columns(tableNames.profiles, ["id", "userId", "email", "balance", "apiKey", "isActive", "createdAt"]);
export const smmProviders = columns(tableNames.smmProviders, ["id", "name", "apiUrl", "apiKey", "isActive", "lastSyncAt", "createdAt"]);
export const services = columns(tableNames.services, ["id", "providerId", "providerServiceId", "name", "platform", "category", "description", "wholesaleRatePer1k", "retailRatePer1k", "minQuantity", "maxQuantity", "tags", "isActive", "createdAt"]);
export const orders = columns(tableNames.orders, ["id", "userId", "serviceId", "providerOrderId", "targetLink", "quantity", "charge", "startCount", "remains", "status", "errorMessage", "createdAt", "updatedAt"]);
export const walletTransactions = columns(tableNames.walletTransactions, ["id", "userId", "amount", "type", "status", "reference", "paymentMethod", "balanceAfter", "createdAt"]);
export const syncSchedules = columns(tableNames.syncSchedules, ["id", "kind", "taskUid", "cron", "isActive", "createdAt"]);
export const syncRuns = columns(tableNames.syncRuns, ["id", "providerId", "kind", "status", "itemsProcessed", "errorMessage", "startedAt", "finishedAt"]);
export const auditEvents = columns(tableNames.auditEvents, ["id", "actorUserId", "action", "entityType", "entityId", "details", "createdAt"]);

const camelToSnake = (key: string) => key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
const snakeToCamel = (key: string) => key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
const encode = (value: unknown) => typeof value === "string" ? encodeURIComponent(value) : encodeURIComponent(String(value));
const mapOut = (row: DbRow): DbRow => Object.fromEntries(Object.entries(row).map(([key, value]) => [snakeToCamel(key), value]));
const mapIn = (row: DbRow): DbRow => Object.fromEntries(Object.entries(row).filter(([, value]) => value !== undefined).map(([key, value]) => [camelToSnake(key), value instanceof Date ? value.toISOString() : value]));

class SupabaseClient {
  constructor(private readonly baseUrl: string, private readonly key: string) {}

  async request(path: string, init: RequestInit = {}) {
    const response = await fetch(`${this.baseUrl}/rest/v1/${path}`, {
      ...init,
      headers: { apikey: this.key, Authorization: `Bearer ${this.key}`, "Content-Type": "application/json", Prefer: "return=representation", ...(init.headers ?? {}) },
    });
    const text = await response.text();
    let body: any = null;
    try { body = text ? JSON.parse(text) : null; } catch { body = text; }
    if (!response.ok) throw new Error(`Supabase ${response.status}: ${typeof body === "string" ? body : body?.message ?? JSON.stringify(body)}`);
    return body;
  }

  from(table: string) { return new QueryBuilder(this, table); }
  select(projection: unknown = "*") { return new RootQuery(this, "select", projection); }
  insert(tableRef: Record<string, Column>) { return new QueryBuilder(this, Object.values(tableRef)[0]?.table ?? "").insert({}); }
  update(tableRef: Record<string, Column>) { return new QueryBuilder(this, Object.values(tableRef)[0]?.table ?? "").update({}); }
}

class RootQuery {
  private payload: DbRow | DbRow[] | null = null;
  constructor(private readonly client: SupabaseClient, private readonly operation: "select" | "insert" | "update", private readonly projectionOrTable: unknown) {}
  from(tableRef: string | Record<string, Column>) {
    const table = typeof tableRef === "string" ? tableRef : Object.values(tableRef)[0]?.table;
    if (!table) throw new Error("Supabase table reference is required");
    const query = new QueryBuilder(this.client, table);
    if (this.operation === "select") return query.select(this.projectionOrTable);
    if (this.operation === "insert") return query.insert(this.payload ?? {});
    return query.update(this.payload ?? {});
  }
  values(values: DbRow | DbRow[]) { this.payload = values; return this; }
  select(projection: unknown = "*") { return this; }
  set(values: DbRow) { this.payload = values; return this; }
  where(filter: any) { return this; }
  limit(_value: number) { return this; }
  orderBy(..._items: any[]) { return this; }
  onDuplicateKeyUpdate(_options: { set: DbRow }) { return this; }
  $returningId() { throw new Error("Use .from(table) before returning inserted IDs"); }
}

export type SupabaseDb = SupabaseClient;


class QueryBuilder implements PromiseLike<any[]> {
  private filters: Array<{ field: string; op: string; value: unknown }> = [];
  private order: string[] = [];
  private countOnly = false;
  private limitValue?: number;
  private payload: DbRow | DbRow[] | null = null;
  private operation: "select" | "insert" | "update" = "select";
  private projection: unknown;
  constructor(private readonly client: SupabaseClient, private readonly table: string) {}
  select(projection: unknown = "*") { this.operation = "select"; this.projection = projection; if (typeof projection === "object" && projection && "count" in projection) this.countOnly = true; return this; }
  insert(values: DbRow | DbRow[]) { this.operation = "insert"; this.payload = values; return this; }
  update(values: DbRow) { this.operation = "update"; this.payload = values; return this; }
  values(values: DbRow | DbRow[]) { this.operation = "insert"; this.payload = values; return this; }
  set(values: DbRow) { this.operation = "update"; this.payload = values; return this; }
  where(filter: any) { if (filter?.field) this.filters.push(filter); return this; }
  limit(value: number) { this.limitValue = value; return this; }
  orderBy(...items: any[]) { for (const item of items.flat()) if (item?.field) this.order.push(item.desc ? `${camelToSnake(item.field)}.desc` : camelToSnake(item.field)); return this; }
  onDuplicateKeyUpdate(_options: { set: DbRow }) { return this; }
  $returningId() { return this.then((rows) => rows.map((row) => ({ id: row.id }))); }
  then<TResult1 = any[], TResult2 = never>(onfulfilled?: ((value: any[]) => TResult1 | PromiseLike<TResult1>) | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled as any, onrejected as any);
  }
  private async execute(): Promise<any[]> {
    const query = new URLSearchParams();
    query.set("select", "*");
    for (const filter of this.filters) query.set(camelToSnake(filter.field), `${filter.op}.${encode(filter.value)}`);
    if (this.order.length) query.set("order", this.order.join(","));
    if (this.limitValue) query.set("limit", String(this.limitValue));
    if (this.operation === "select") {
      const rows = (await this.client.request(`${this.table}?${query}`) ?? []).map(mapOut);
      return this.countOnly ? [{ count: rows.length }] : rows;
    }
    if (this.operation === "insert") {
      const payload = Array.isArray(this.payload) ? this.payload.map(mapIn) : mapIn(this.payload ?? {});
      return (await this.client.request(this.table, { method: "POST", body: JSON.stringify(payload) }) ?? []).map(mapOut);
    }
    for (const filter of this.filters) query.set(camelToSnake(filter.field), `${filter.op}.${encode(filter.value)}`);
    return (await this.client.request(`${this.table}?${query}`, { method: "PATCH", body: JSON.stringify(mapIn(this.payload ?? {})) }) ?? []).map(mapOut);
  }
}

export const eq = (column: Column, value: unknown) => ({ field: column.field, op: "eq", value });
export const desc = (column: Column) => ({ field: column.field, desc: true });
export function sql<T = unknown>(strings: TemplateStringsArray | string, ...values: unknown[]) { return { kind: "sql", strings, values } as any as T; }

let _db: SupabaseClient | null = null;
export async function getDb() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_KEY;
  if (!url || !key) return null;
  _db ??= new SupabaseClient(url.replace(/\/$/, ""), key);
  return _db;
}

export async function upsertUser(user: any) {
  const db = await getDb(); if (!db) return;
  const values = mapIn({ openId: user.openId, name: user.name, email: user.email, loginMethod: user.loginMethod, role: user.role ?? (user.openId === ENV.ownerOpenId ? "admin" : "user"), lastSignedIn: user.lastSignedIn ?? new Date() });
  await db.request(`${tableNames.users}?on_conflict=open_id`, { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=representation" }, body: JSON.stringify(values) });
}

export async function getUserByOpenId(openId: string) { const db = await getDb(); if (!db) return undefined; const rows = await db.from(tableNames.users).select().where(eq(users.openId, openId)).limit(1); return rows[0]; }
export async function getOrCreateProfile(user: { id: number; email?: string | null }) { const db = await getDb(); if (!db) return null; let rows = await db.from(tableNames.profiles).select().where(eq(profiles.userId, user.id)).limit(1); if (!rows[0]) { await db.from(tableNames.profiles).insert({ userId: user.id, email: user.email ?? null }); rows = await db.from(tableNames.profiles).select().where(eq(profiles.userId, user.id)).limit(1); } return rows[0] ?? null; }
export async function recordAudit(input: { actorUserId?: number; action: string; entityType: string; entityId?: string; details?: unknown }) { const db = await getDb(); if (!db) return; await db.from(tableNames.auditEvents).insert({ actorUserId: input.actorUserId, action: input.action, entityType: input.entityType, entityId: input.entityId, details: input.details ?? null }); }
export async function getActiveServices() { const db = await getDb(); if (!db) return []; return db.from(tableNames.services).select().where(eq(services.isActive, true)).orderBy(services.platform, services.category, services.id); }
export async function getUserOrders(userId: number) { const db = await getDb(); if (!db) return []; return db.from(tableNames.orders).select().where(eq(orders.userId, userId)).orderBy(desc(orders.createdAt)); }
export async function getUserWallet(userId: number) { const db = await getDb(); if (!db) return []; return db.from(tableNames.walletTransactions).select().where(eq(walletTransactions.userId, userId)).orderBy(desc(walletTransactions.createdAt)); }
export function applyWalletDelta(current: number, delta: number) { const next = Number((current + delta).toFixed(2)); if (next < 0) throw new Error("Balance cannot become negative"); return next; }

export async function chargeWallet(input: { userId: number; serviceId: number; targetLink: string; quantity: number; charge: number }) {
  const db = await getDb(); if (!db) throw new Error("Supabase unavailable");
  const profile = (await db.from(tableNames.profiles).select().where(eq(profiles.userId, input.userId)).limit(1))[0];
  if (!profile || Number(profile.balance) < input.charge) throw new Error("Insufficient wallet balance");
  const nextBalance = applyWalletDelta(Number(profile.balance), -input.charge);
  await db.from(tableNames.profiles).update({ balance: nextBalance }).where(eq(profiles.userId, input.userId));
  const created = await db.from(tableNames.orders).insert({ userId: input.userId, serviceId: input.serviceId, targetLink: input.targetLink, quantity: input.quantity, charge: input.charge, status: "pending" });
  const orderId = created[0]?.id;
  await db.from(tableNames.walletTransactions).insert({ userId: input.userId, amount: -input.charge, type: "order_charge", status: "completed", reference: `order-${orderId}`, paymentMethod: "wallet", balanceAfter: nextBalance });
  return orderId;
}
export function buildRefundAccounting(current: number, amount: number) { return { nextBalance: applyWalletDelta(current, amount).toFixed(2), ledgerAmount: amount.toFixed(2), status: "completed" as const }; }
export async function refundOrder(input: { userId: number; orderId: number; amount: number; reason: string }, dbOverride?: any) {
  const db = dbOverride ?? await getDb();
  if (!db) throw new Error("Supabase unavailable");
  if (typeof db.transaction === "function") {
    return db.transaction(async (tx: any) => {
      const profile = (await tx.select().from(profiles).where(eq(profiles.userId, input.userId)).limit(1))[0];
      if (!profile) throw new Error("Wallet profile not found");
      const refund = buildRefundAccounting(Number(profile.balance), input.amount);
      await tx.update(profiles).set({ balance: refund.nextBalance }).where(eq(profiles.userId, input.userId));
      await tx.update(orders).set({ status: "failed", errorMessage: input.reason }).where(eq(orders.id, input.orderId));
      await tx.insert(walletTransactions).values({ userId: input.userId, amount: refund.ledgerAmount, type: "refund", status: refund.status, reference: `refund-${input.orderId}`, paymentMethod: "system", balanceAfter: refund.nextBalance });
      return refund.nextBalance;
    });
  }
  const profile = (await db.from(tableNames.profiles).select().where(eq(profiles.userId, input.userId)).limit(1))[0];
  if (!profile) throw new Error("Wallet profile not found");
  const refund = buildRefundAccounting(Number(profile.balance), input.amount);
  await db.from(tableNames.profiles).update({ balance: refund.nextBalance }).where(eq(profiles.userId, input.userId));
  await db.from(tableNames.orders).update({ status: "failed", errorMessage: input.reason }).where(eq(orders.id, input.orderId));
  await db.from(tableNames.walletTransactions).insert({ userId: input.userId, amount: refund.ledgerAmount, type: "refund", status: refund.status, reference: `refund-${input.orderId}`, paymentMethod: "system", balanceAfter: refund.nextBalance });
  return refund.nextBalance;
}
export async function listAdminUsers() { const db = await getDb(); if (!db) return []; const allUsers = await db.from(tableNames.users).select().orderBy(desc(users.createdAt)); const allProfiles = await db.from(tableNames.profiles).select(); return allUsers.map((user) => ({ user, profile: allProfiles.find((profile) => profile.userId === user.id) ?? null })); }
export async function listProviders() { const db = await getDb(); if (!db) return []; const rows = await db.from(tableNames.smmProviders).select().orderBy(desc(smmProviders.createdAt)); return rows.map(({ id, name, apiUrl, isActive, lastSyncAt, createdAt }) => ({ id, name, apiUrl, isActive, lastSyncAt, createdAt })); }
export async function listSyncRuns() { const db = await getDb(); if (!db) return []; return db.from(tableNames.syncRuns).select().orderBy(desc(syncRuns.startedAt)).limit(20); }

export { tableNames };
