import {
  decimal,
  index,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const profiles = mysqlTable("profiles", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  email: varchar("email", { length: 320 }),
  balance: decimal("balance", { precision: 14, scale: 2 }).default("0.00").notNull(),
  apiKey: varchar("apiKey", { length: 96 }).unique(),
  isActive: int("isActive").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({ userIdx: index("profiles_user_idx").on(table.userId) }));

export const smmProviders = mysqlTable("smmProviders", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 120 }).notNull(),
  apiUrl: varchar("apiUrl", { length: 500 }).notNull(),
  apiKey: varchar("apiKey", { length: 500 }).notNull(),
  isActive: int("isActive").default(1).notNull(),
  lastSyncAt: timestamp("lastSyncAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const services = mysqlTable("services", {
  id: int("id").autoincrement().primaryKey(),
  providerId: int("providerId"),
  providerServiceId: varchar("providerServiceId", { length: 80 }),
  name: varchar("name", { length: 220 }).notNull(),
  platform: varchar("platform", { length: 40 }).notNull(),
  category: varchar("category", { length: 80 }).notNull(),
  description: text("description"),
  wholesaleRatePer1k: decimal("wholesaleRatePer1k", { precision: 12, scale: 4 }).default("0.00").notNull(),
  retailRatePer1k: decimal("retailRatePer1k", { precision: 12, scale: 4 }).default("0.00").notNull(),
  minQuantity: int("minQuantity").default(100).notNull(),
  maxQuantity: int("maxQuantity").default(100000).notNull(),
  tags: varchar("tags", { length: 500 }),
  isActive: int("isActive").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({ activeIdx: index("services_active_idx").on(table.isActive) }));

export const orders = mysqlTable("orders", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  serviceId: int("serviceId").notNull(),
  providerOrderId: varchar("providerOrderId", { length: 120 }),
  targetLink: varchar("targetLink", { length: 1000 }).notNull(),
  quantity: int("quantity").notNull(),
  charge: decimal("charge", { precision: 14, scale: 2 }).notNull(),
  startCount: int("startCount"),
  remains: int("remains"),
  status: mysqlEnum("status", ["pending", "in_progress", "completed", "canceled", "partial", "failed"]).default("pending").notNull(),
  errorMessage: text("errorMessage"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({ userIdx: index("orders_user_idx").on(table.userId), statusIdx: index("orders_status_idx").on(table.status) }));

export const walletTransactions = mysqlTable("walletTransactions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  amount: decimal("amount", { precision: 14, scale: 2 }).notNull(),
  type: mysqlEnum("type", ["deposit", "order_charge", "refund", "adjustment"]).notNull(),
  status: mysqlEnum("status", ["pending", "completed", "failed"]).default("completed").notNull(),
  reference: varchar("reference", { length: 160 }).notNull(),
  paymentMethod: varchar("paymentMethod", { length: 80 }),
  balanceAfter: decimal("balanceAfter", { precision: 14, scale: 2 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({ walletUserIdx: index("wallet_user_idx").on(table.userId) }));

export const syncSchedules = mysqlTable("syncSchedules", {
  id: int("id").autoincrement().primaryKey(),
  kind: mysqlEnum("kind", ["catalog", "orders"]).notNull().unique(),
  taskUid: varchar("taskUid", { length: 65 }).notNull().unique(),
  cron: varchar("cron", { length: 80 }).notNull(),
  isActive: int("isActive").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const syncRuns = mysqlTable("syncRuns", {
  id: int("id").autoincrement().primaryKey(),
  providerId: int("providerId"),
  kind: mysqlEnum("kind", ["catalog", "orders"]).notNull(),
  status: mysqlEnum("status", ["running", "completed", "failed"]).notNull(),
  itemsProcessed: int("itemsProcessed").default(0).notNull(),
  errorMessage: text("errorMessage"),
  startedAt: timestamp("startedAt").defaultNow().notNull(),
  finishedAt: timestamp("finishedAt"),
});

export const auditEvents = mysqlTable("auditEvents", {
  id: int("id").autoincrement().primaryKey(),
  actorUserId: int("actorUserId"),
  action: varchar("action", { length: 120 }).notNull(),
  entityType: varchar("entityType", { length: 80 }).notNull(),
  entityId: varchar("entityId", { length: 80 }),
  details: text("details"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Service = typeof services.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type WalletTransaction = typeof walletTransactions.$inferSelect;
