import {
  pgTable,
  text,
  timestamp,
  uuid,
  integer,
  boolean,
  jsonb,
  pgEnum,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const orgStatusEnum = pgEnum("org_status", ["active", "trial", "suspended"]);
export const employeeStatusEnum = pgEnum("employee_status", [
  "candidate",
  "onboarding",
  "active",
  "on_vacation",
  "terminated",
]);
export const attendanceTypeEnum = pgEnum("attendance_type", [
  "check_in",
  "check_out",
  "break_start",
  "break_end",
]);
export const attendanceMethodEnum = pgEnum("attendance_method", [
  "qr",
  "geofence",
  "manual",
  "face_id",
]);
export const shiftTypeEnum = pgEnum("shift_type", [
  "morning",
  "evening",
  "night",
  "flexible",
]);
export const userRoleEnum = pgEnum("user_role", [
  "org_admin",
  "manager",
  "employee",
]);

export const organizations = pgTable("organizations", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  domain: text("domain").notNull(),
  industry: text("industry").notNull().default("retail"),
  status: orgStatusEnum("status").default("trial").notNull(),
  settings: jsonb("settings").$type<Record<string, unknown>>().default({}).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const departments = pgTable("departments", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: uuid("org_id")
    .references(() => organizations.id, { onDelete: "cascade" })
    .notNull(),
  name: text("name").notNull(),
  managerId: uuid("manager_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .references(() => organizations.id, { onDelete: "cascade" })
      .notNull(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    fullName: text("full_name").notNull(),
    role: userRoleEnum("role").default("employee").notNull(),
    employeeId: uuid("employee_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("users_org_email_uidx").on(t.orgId, t.email)]
);

export const employees = pgTable("employees", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: uuid("org_id")
    .references(() => organizations.id, { onDelete: "cascade" })
    .notNull(),
  departmentId: uuid("department_id").references(() => departments.id, {
    onDelete: "set null",
  }),
  fullName: text("full_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  position: text("position").notNull(),
  avatarUrl: text("avatar_url"),
  status: employeeStatusEnum("status").default("active").notNull(),
  hiredAt: timestamp("hired_at", { withTimezone: true }).defaultNow(),
  meta: jsonb("meta").$type<Record<string, unknown>>().default({}).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const attendanceLogs = pgTable("attendance_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  employeeId: uuid("employee_id")
    .references(() => employees.id, { onDelete: "cascade" })
    .notNull(),
  orgId: uuid("org_id")
    .references(() => organizations.id, { onDelete: "cascade" })
    .notNull(),
  type: attendanceTypeEnum("type").notNull(),
  method: attendanceMethodEnum("method").notNull(),
  location: jsonb("location").$type<Record<string, unknown>>().default({}).notNull(),
  deviceFingerprint: text("device_fingerprint"),
  livenessScore: integer("liveness_score"),
  isAnomaly: boolean("is_anomaly").default(false).notNull(),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const shifts = pgTable("shifts", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: uuid("org_id")
    .references(() => organizations.id, { onDelete: "cascade" })
    .notNull(),
  employeeId: uuid("employee_id")
    .references(() => employees.id, { onDelete: "cascade" })
    .notNull(),
  shiftType: shiftTypeEnum("shift_type").notNull(),
  startAt: timestamp("start_at", { withTimezone: true }).notNull(),
  endAt: timestamp("end_at", { withTimezone: true }).notNull(),
  isApproved: boolean("is_approved").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: uuid("org_id")
    .references(() => organizations.id, { onDelete: "cascade" })
    .notNull(),
  action: text("action").notNull(),
  actorId: text("actor_id").notNull(),
  payload: jsonb("payload").$type<Record<string, unknown>>().default({}).notNull(),
  hash: text("hash").notNull(),
  prevHash: text("prev_hash"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type Organization = typeof organizations.$inferSelect;
export type Department = typeof departments.$inferSelect;
export type Employee = typeof employees.$inferSelect;
export type User = typeof users.$inferSelect;
export type AttendanceLog = typeof attendanceLogs.$inferSelect;
export type Shift = typeof shifts.$inferSelect;
