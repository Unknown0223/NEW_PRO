import {
  boolean,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const agents = pgTable("agents", {
  id: serial("id").primaryKey(),
  firstName: text("first_name").notNull().default(""),
  lastName: text("last_name").notNull().default(""),
  middleName: text("middle_name").notNull().default(""),
  fullname: text("fullname").notNull(),
  code: text("code").notNull(),
  phone: text("phone").notNull().default(""),
  email: text("email").notNull().default(""),
  pinfl: text("pinfl").notNull().default(""),
  agentType: text("agent_type").notNull().default("Торговый представитель"),
  productCount: integer("product_count").notNull().default(0),
  consignation: boolean("consignation").notNull().default(false),
  apkVersion: text("apk_version").notNull().default(""),
  deviceName: text("device_name").notNull().default(""),
  lastSync: timestamp("last_sync", { withTimezone: true }),
  login: text("login").notNull().default(""),
  priceTypes: jsonb("price_types").$type<string[]>().notNull().default([]),
  products: jsonb("products").$type<string[]>().notNull().default([]),
  warehouse: text("warehouse").notNull().default(""),
  tradeDirection: text("trade_direction").notNull().default(""),
  branch: text("branch").notNull().default(""),
  position: text("position").notNull().default(""),
  appAccess: boolean("app_access").notNull().default(true),
  active: boolean("active").notNull().default(true),
  maxSessions: integer("max_sessions").notNull().default(1),
  kpiColor: text("kpi_color").notNull().default("#e11d48"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const agentSessions = pgTable("agent_sessions", {
  id: serial("id").primaryKey(),
  agentId: integer("agent_id")
    .notNull()
    .references(() => agents.id, { onDelete: "cascade" }),
  device: text("device").notNull(),
  ip: text("ip").notNull().default(""),
  os: text("os").notNull().default(""),
  appInfo: text("app_info").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type AgentRow = typeof agents.$inferSelect;
export type AgentSessionRow = typeof agentSessions.$inferSelect;
