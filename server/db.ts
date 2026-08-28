import { and, desc, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, auditEvents, orders, profiles, services, smmProviders, syncRuns, syncSchedules, users, walletTransactions } from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;
  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  (['name', 'email', 'loginMethod'] as const).forEach((field) => {
    if (user[field] !== undefined) {
      values[field] = user[field] ?? null;
      updateSet[field] = user[field] ?? null;
    }
  });
  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = 'admin';
    updateSet.role = 'admin';
  }
  values.lastSignedIn ??= new Date();
  updateSet.lastSignedIn ??= new Date();
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function getOrCreateProfile(user: { id: number; email?: string | null }) {
  const db = await getDb();
  if (!db) return null;
  const existing = await db.select().from(profiles).where(eq(profiles.userId, user.id)).limit(1);
  if (existing[0]) return existing[0];
  await db.insert(profiles).values({ userId: user.id, email: user.email ?? null });
  const created = await db.select().from(profiles).where(eq(profiles.userId, user.id)).limit(1);
  return created[0] ?? null;
}

export async function recordAudit(input: { actorUserId?: number; action: string; entityType: string; entityId?: string; details?: unknown }) {
  const db = await getDb();
  if (!db) return;
  await db.insert(auditEvents).values({
    actorUserId: input.actorUserId,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    details: input.details ? JSON.stringify(input.details) : undefined,
  });
}

export async function getActiveServices() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(services).where(eq(services.isActive, 1)).orderBy(services.platform, services.category, services.id);
}

export async function getUserOrders(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(orders).where(eq(orders.userId, userId)).orderBy(desc(orders.createdAt));
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

export async function chargeWallet(input: { userId: number; serviceId: number; targetLink: string; quantity: number; charge: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  return db.transaction(async (tx) => {
    const profileRows = await tx.select().from(profiles).where(eq(profiles.userId, input.userId)).limit(1);
    const profile = profileRows[0];
    if (!profile) throw new Error("Wallet profile not found");
    const balance = Number(profile.balance);
    if (balance < input.charge) throw new Error("Insufficient wallet balance");
    const nextBalance = (balance - input.charge).toFixed(2);
    const updated = await tx.update(profiles).set({ balance: nextBalance }).where(and(eq(profiles.userId, input.userId), sql`${profiles.balance} >= ${input.charge}`));
    if ((updated as any).affectedRows === 0) throw new Error("Insufficient wallet balance");
    const orderInsert = await tx.insert(orders).values({ userId: input.userId, serviceId: input.serviceId, targetLink: input.targetLink, quantity: input.quantity, charge: input.charge.toFixed(2) });
    await tx.insert(walletTransactions).values({ userId: input.userId, amount: (-input.charge).toFixed(2), type: 'order_charge', status: 'completed', reference: `order-${orderInsert[0].insertId}`, paymentMethod: 'wallet', balanceAfter: nextBalance });
    return Number(orderInsert[0].insertId);
  });
}

export function buildRefundAccounting(current: number, amount: number) {
  const nextBalance = applyWalletDelta(current, amount).toFixed(2);
  return { nextBalance, ledgerAmount: amount.toFixed(2), status: "completed" as const };
}

export async function refundOrder(input: { userId: number; orderId: number; amount: number; reason: string }, dbOverride?: any) {
  const db = dbOverride ?? await getDb();
  if (!db) throw new Error("Database unavailable");
  return db.transaction(async (tx: any) => {
    const profile = (await tx.select().from(profiles).where(eq(profiles.userId, input.userId)).limit(1))[0];
    if (!profile) throw new Error("Wallet profile not found");
    const refund = buildRefundAccounting(Number(profile.balance), input.amount);
    const nextBalance = refund.nextBalance;
    await tx.update(profiles).set({ balance: nextBalance }).where(eq(profiles.userId, input.userId));
    await tx.update(orders).set({ status: "failed", errorMessage: input.reason }).where(eq(orders.id, input.orderId));
    await tx.insert(walletTransactions).values({ userId: input.userId, amount: refund.ledgerAmount, type: "refund", status: refund.status, reference: `refund-${input.orderId}`, paymentMethod: "system", balanceAfter: nextBalance });
    return nextBalance;
  });
}

export async function listAdminUsers() {
  const db = await getDb();
  if (!db) return [];
  return db.select({ user: users, profile: profiles }).from(users).leftJoin(profiles, eq(users.id, profiles.userId)).orderBy(desc(users.createdAt));
}

export async function listProviders() {
  const db = await getDb();
  if (!db) return [];
  return db.select({ id: smmProviders.id, name: smmProviders.name, isActive: smmProviders.isActive, lastSyncAt: smmProviders.lastSyncAt, createdAt: smmProviders.createdAt }).from(smmProviders).orderBy(desc(smmProviders.createdAt));
}

export async function listSyncRuns() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(syncRuns).orderBy(desc(syncRuns.startedAt)).limit(20);
}

export { and, desc, eq, sql, auditEvents, orders, profiles, services, smmProviders, syncRuns, syncSchedules, users, walletTransactions };
