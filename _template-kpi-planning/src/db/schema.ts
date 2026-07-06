import {
  pgTable,
  serial,
  integer,
  varchar,
  text,
  timestamp,
  decimal,
  boolean,
  pgEnum,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const statusEnum = pgEnum("status", [
  "draft",
  "in_progress",
  "pending_approval",
  "approved",
  "rejected",
  "archived",
]);

export const roleEnum = pgEnum("role", [
  "director",
  "sales_director",
  "commercial_director",
  "manager",
  "supervisor",
  "agent",
]);

export const tradeDirections = pgTable("trade_directions", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  code: varchar("code", { length: 50 }).notNull().unique(),
  brand: varchar("brand", { length: 100 }),
  employeeCount: integer("employee_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const kpiGroups = pgTable("kpi_groups", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  tradeDirectionId: integer("trade_direction_id").notNull(),
  totalCost: decimal("total_cost", { precision: 18, scale: 2 }).default("0"),
  totalVolume: decimal("total_volume", { precision: 18, scale: 2 }).default("0"),
  totalOrders: integer("total_orders").default(0),
  completionPercent: decimal("completion_percent", { precision: 5, scale: 2 }).default("0"),
  status: statusEnum("status").default("draft"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const employees = pgTable("employees", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  code: varchar("code", { length: 50 }).notNull().unique(),
  role: roleEnum("role").notNull(),
  parentId: integer("parent_id"),
  avatar: text("avatar"),
  email: varchar("email", { length: 200 }),
  phone: varchar("phone", { length: 50 }),
  region: varchar("region", { length: 100 }),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const plans = pgTable("plans", {
  id: serial("id").primaryKey(),
  month: integer("month").notNull(),
  year: integer("year").notNull(),
  tradeDirectionId: integer("trade_direction_id").notNull(),
  kpiGroupId: integer("kpi_group_id").notNull(),
  status: statusEnum("status").default("draft"),
  createdBy: integer("created_by"),
  approvedBy: integer("approved_by"),
  approvedAt: timestamp("approved_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  uniqueIndex("plan_unique_idx").on(table.month, table.year, table.tradeDirectionId, table.kpiGroupId),
]);

export const kpiTargets = pgTable("kpi_targets", {
  id: serial("id").primaryKey(),
  planId: integer("plan_id").notNull(),
  employeeId: integer("employee_id").notNull(),
  cost: decimal("cost", { precision: 18, scale: 2 }).default("0"),
  count: decimal("count", { precision: 18, scale: 2 }).default("0"),
  volume: decimal("volume", { precision: 18, scale: 2 }).default("0"),
  acb: decimal("acb", { precision: 18, scale: 2 }).default("0"),
  orderCount: integer("order_count").default(0),
  comment: text("comment"),
  status: statusEnum("status").default("draft"),
  lastUpdated: timestamp("last_updated").defaultNow(),
  updatedBy: integer("updated_by"),
}, (table) => [
  uniqueIndex("kpi_target_unique_idx").on(table.planId, table.employeeId),
]);

export const approvals = pgTable("approvals", {
  id: serial("id").primaryKey(),
  planId: integer("plan_id").notNull(),
  step: integer("step").notNull(),
  approverId: integer("approver_id").notNull(),
  approverRole: roleEnum("approver_role").notNull(),
  status: statusEnum("status").default("pending_approval"),
  comment: text("comment"),
  createdAt: timestamp("created_at").defaultNow(),
  actedAt: timestamp("acted_at"),
});

export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  planId: integer("plan_id").notNull(),
  employeeId: integer("employee_id").notNull(),
  field: varchar("field", { length: 50 }).notNull(),
  oldValue: text("old_value"),
  newValue: text("new_value"),
  userId: integer("user_id"),
  userName: varchar("user_name", { length: 200 }),
  createdAt: timestamp("created_at").defaultNow(),
});

export type TradeDirection = typeof tradeDirections.$inferSelect;
export type KpiGroup = typeof kpiGroups.$inferSelect;
export type Employee = typeof employees.$inferSelect;
export type Plan = typeof plans.$inferSelect;
export type KpiTarget = typeof kpiTargets.$inferSelect;
export type Approval = typeof approvals.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
