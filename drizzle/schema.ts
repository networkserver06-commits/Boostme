import { sql } from "drizzle-orm";
import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

const createdAt = () => integer("created_at", { mode: "timestamp_ms" }).notNull().default(sql`(unixepoch() * 1000)`);
const updatedAt = () => integer("updated_at", { mode: "timestamp_ms" }).notNull().default(sql`(unixepoch() * 1000)`).$onUpdate(() => new Date());

export const users = sqliteTable("app_users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name"),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash"),
  loginMethod: text("login_method").notNull().default("password"),
  role: text("role").$type<"user" | "admin">().notNull().default("user"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
  lastSignedIn: integer("last_signed_in", { mode: "timestamp_ms" }).notNull().default(sql`(unixepoch() * 1000)`),
});

export const profiles = sqliteTable("profiles", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().unique(),
  email: text("email"),
  balance: text("balance").notNull().default("0.00"),
  apiKey: text("api_key").unique(),
  isActive: integer("is_active").notNull().default(1),
  createdAt: createdAt(),
}, (table) => ({ userIdx: index("profiles_user_idx").on(table.userId) }));

export const smmProviders = sqliteTable("smm_providers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  apiUrl: text("api_url").notNull(),
  apiKey: text("api_key").notNull(),
  isActive: integer("is_active").notNull().default(1),
  lastSyncAt: integer("last_sync_at", { mode: "timestamp_ms" }),
  createdAt: createdAt(),
});

export const services = sqliteTable("services", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  providerId: integer("provider_id"),
  providerServiceId: text("provider_service_id"),
  name: text("name").notNull(),
  platform: text("platform").notNull(),
  category: text("category").notNull(),
  description: text("description"),
  wholesaleRatePer1k: text("wholesale_rate_per1k").notNull().default("0.0000"),
  retailRatePer1k: text("retail_rate_per1k").notNull().default("0.0000"),
  minQuantity: integer("min_quantity").notNull().default(100),
  maxQuantity: integer("max_quantity").notNull().default(100000),
  tags: text("tags"),
  isActive: integer("is_active").notNull().default(1),
  createdAt: createdAt(),
}, (table) => ({ activeIdx: index("services_active_idx").on(table.isActive), providerServiceIdx: index("services_provider_service_idx").on(table.providerId, table.providerServiceId) }));

export const orders = sqliteTable("orders", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull(),
  serviceId: integer("service_id").notNull(),
  providerId: integer("provider_id"),
  providerOrderId: text("provider_order_id"),
  targetLink: text("target_link").notNull(),
  quantity: integer("quantity").notNull(),
  charge: text("charge").notNull(),
  wholesaleCostKes: real("wholesale_cost_kes"),
  retailPaidKes: real("retail_paid_kes"),
  netProfitKes: real("net_profit_kes"),
  startCount: integer("start_count"),
  remains: integer("remains"),
  status: text("status").$type<"pending" | "in_progress" | "completed" | "canceled" | "partial" | "failed">().notNull().default("pending"),
  errorMessage: text("error_message"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => ({ userIdx: index("orders_user_idx").on(table.userId), statusIdx: index("orders_status_idx").on(table.status) }));

export const walletTransactions = sqliteTable("wallet_transactions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull(),
  amount: text("amount").notNull(),
  type: text("type").$type<"deposit" | "order_charge" | "refund" | "adjustment">().notNull(),
  status: text("status").$type<"pending" | "completed" | "failed">().notNull().default("completed"),
  reference: text("reference").notNull(),
  paymentMethod: text("payment_method"),
  balanceAfter: text("balance_after").notNull(),
  createdAt: createdAt(),
}, (table) => ({ walletUserIdx: index("wallet_user_idx").on(table.userId) }));

export const syncSchedules = sqliteTable("sync_schedules", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  kind: text("kind").$type<"catalog" | "orders">().notNull().unique(),
  taskUid: text("task_uid").notNull().unique(),
  cron: text("cron").notNull(),
  isActive: integer("is_active").notNull().default(1),
  createdAt: createdAt(),
});

export const syncRuns = sqliteTable("sync_runs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  providerId: integer("provider_id"),
  kind: text("kind").$type<"catalog" | "orders">().notNull(),
  status: text("status").$type<"running" | "completed" | "failed">().notNull(),
  itemsProcessed: integer("items_processed").notNull().default(0),
  errorMessage: text("error_message"),
  startedAt: integer("started_at", { mode: "timestamp_ms" }).notNull().default(sql`(unixepoch() * 1000)`),
  finishedAt: integer("finished_at", { mode: "timestamp_ms" }),
});

export const auditEvents = sqliteTable("audit_events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  actorUserId: integer("actor_user_id"),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id"),
  details: text("details", { mode: "json" }).$type<unknown>(),
  createdAt: createdAt(),
});

export const authSessions = sqliteTable("auth_sessions", {
  tokenHash: text("token_hash").primaryKey(),
  userId: integer("user_id").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  createdAt: createdAt(),
}, (table) => ({ userIdx: index("auth_sessions_user_idx").on(table.userId), expiresIdx: index("auth_sessions_expires_idx").on(table.expiresAt) }));

export const authRateLimits = sqliteTable("auth_rate_limits", {
  keyHash: text("key_hash").primaryKey(),
  windowStartedAt: integer("window_started_at", { mode: "timestamp_ms" }).notNull(),
  attempts: integer("attempts").notNull().default(0),
});

export const drizzleSchema = { users, profiles, smmProviders, services, orders, walletTransactions, syncSchedules, syncRuns, auditEvents, authSessions, authRateLimits };
export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Service = typeof services.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type WalletTransaction = typeof walletTransactions.$inferSelect;
