import type { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { appendTenantAuditEvent, AuditEntityType } from "../../lib/tenant-audit";

export type AttendanceStatus = "worked" | "absent" | "vacation" | "sick" | "holiday";
export type AttendanceSource = "manual" | "gps" | "mobile_login" | "auto";

type OverrideRow = {
  status: AttendanceStatus;
  source: AttendanceSource;
  updated_at: string;
  updated_by: number | null;
};

type TimesheetState = {
  overrides: Record<string, OverrideRow>;
  locked_months: string[];
};

export type TimesheetFilterInput = {
  month: string; // YYYY-MM
  role?: string;
  user_id?: number;
};

export type TimesheetCellDto = {
  day: number;
  date: string;
  status: AttendanceStatus;
  source: AttendanceSource;
};

export type TimesheetRowDto = {
  user_id: number;
  fio: string;
  role: string;
  login: string;
  cells: TimesheetCellDto[];
  worked_days: number;
  absent_days: number;
};

function asObj(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function isStatus(v: string): v is AttendanceStatus {
  return v === "worked" || v === "absent" || v === "vacation" || v === "sick" || v === "holiday";
}

function isSource(v: string): v is AttendanceSource {
  return v === "manual" || v === "gps" || v === "mobile_login" || v === "auto";
}

function parseTimesheetState(settings: Prisma.JsonValue): TimesheetState {
  const root = asObj(settings);
  const ts = asObj(root.timesheet);
  const rawOverrides = asObj(ts.overrides);
  const overrides: Record<string, OverrideRow> = {};
  for (const [k, v] of Object.entries(rawOverrides)) {
    const o = asObj(v);
    const status = typeof o.status === "string" ? o.status : "";
    const source = typeof o.source === "string" ? o.source : "";
    if (!isStatus(status) || !isSource(source)) continue;
    overrides[k] = {
      status,
      source,
      updated_at: typeof o.updated_at === "string" ? o.updated_at : new Date(0).toISOString(),
      updated_by: typeof o.updated_by === "number" ? o.updated_by : null
    };
  }
  const locked_months = Array.isArray(ts.locked_months)
    ? ts.locked_months.filter((x): x is string => typeof x === "string" && /^\d{4}-\d{2}$/.test(x))
    : [];
  return { overrides, locked_months };
}

function patchTimesheetState(settings: Prisma.JsonValue, state: TimesheetState): Prisma.InputJsonValue {
  const root = asObj(settings);
  return {
    ...root,
    timesheet: {
      ...asObj(root.timesheet),
      overrides: state.overrides,
      locked_months: state.locked_months
    }
  } as Prisma.InputJsonValue;
}

function monthDateRange(month: string): { from: Date; to: Date; daysInMonth: number } {
  if (!/^\d{4}-\d{2}$/.test(month)) throw new Error("BAD_MONTH");
  const [yy, mm] = month.split("-").map((x) => Number.parseInt(x, 10));
  if (!yy || !mm || mm < 1 || mm > 12) throw new Error("BAD_MONTH");
  const from = new Date(Date.UTC(yy, mm - 1, 1, 0, 0, 0));
  const to = new Date(Date.UTC(yy, mm, 1, 0, 0, 0));
  const daysInMonth = new Date(Date.UTC(yy, mm, 0)).getUTCDate();
  return { from, to, daysInMonth };
}

function isoDateForDay(month: string, day: number): string {
  return `${month}-${String(day).padStart(2, "0")}`;
}

export async function listTimesheetFilters(tenantId: number): Promise<{
  roles: string[];
  employees: Array<{ id: number; fio: string; role: string; login: string }>;
}> {
  const users = await prisma.user.findMany({
    where: { tenant_id: tenantId, is_active: true },
    select: { id: true, name: true, role: true, login: true },
    orderBy: [{ role: "asc" }, { name: "asc" }]
  });
  const roles = [...new Set(users.map((u) => u.role).filter((x) => x && x.trim().length > 0))];
  return {
    roles,
    employees: users.map((u) => ({ id: u.id, fio: u.name, role: u.role, login: u.login }))
  };
}

export async function listTimesheetMatrix(tenantId: number, input: TimesheetFilterInput): Promise<{
  month: string;
  days: number[];
  rows: TimesheetRowDto[];
  locked: boolean;
}> {
  const { from, to, daysInMonth } = monthDateRange(input.month);
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { settings: true } });
  if (!tenant) throw new Error("NOT_FOUND");
  const state = parseTimesheetState(tenant.settings);
  const locked = state.locked_months.includes(input.month);

  const users = await prisma.user.findMany({
    where: {
      tenant_id: tenantId,
      is_active: true,
      ...(input.role?.trim() ? { role: input.role.trim() } : {}),
      ...(typeof input.user_id === "number" ? { id: input.user_id } : {})
    },
    select: { id: true, name: true, role: true, login: true },
    orderBy: [{ role: "asc" }, { name: "asc" }]
  });
  const userIds = users.map((u) => u.id);

  const visits = userIds.length
    ? await prisma.agentVisit.findMany({
        where: { tenant_id: tenantId, agent_id: { in: userIds }, checked_in_at: { gte: from, lt: to } },
        select: { agent_id: true, checked_in_at: true }
      })
    : [];
  const visitByUserDay = new Set<string>();
  for (const v of visits) {
    const d = v.checked_in_at.toISOString().slice(0, 10);
    visitByUserDay.add(`${v.agent_id}:${d}`);
  }

  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const rows: TimesheetRowDto[] = users.map((u) => {
    let worked = 0;
    let absent = 0;
    const cells = days.map((day) => {
      const date = isoDateForDay(input.month, day);
      const key = `${u.id}:${date}`;
      const override = state.overrides[key];
      let status: AttendanceStatus;
      let source: AttendanceSource;
      if (override) {
        status = override.status;
        source = override.source;
      } else if (visitByUserDay.has(key)) {
        status = "worked";
        source = "gps";
      } else {
        const dow = new Date(`${date}T00:00:00.000Z`).getUTCDay();
        status = dow === 0 ? "holiday" : "absent";
        source = "auto";
      }
      if (status === "worked") worked += 1;
      if (status === "absent") absent += 1;
      return { day, date, status, source };
    });
    return { user_id: u.id, fio: u.name, role: u.role, login: u.login, cells, worked_days: worked, absent_days: absent };
  });

  return { month: input.month, days, rows, locked };
}

export async function patchAttendanceCell(
  tenantId: number,
  actorUserId: number | null,
  input: { userId: number; date: string; status: AttendanceStatus; source?: AttendanceSource }
): Promise<{ ok: true }> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) throw new Error("BAD_DATE");
  const month = input.date.slice(0, 7);
  const today = new Date().toISOString().slice(0, 10);
  if (input.date > today) throw new Error("FUTURE_DATE_DENIED");

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { settings: true } });
  if (!tenant) throw new Error("NOT_FOUND");
  const user = await prisma.user.findFirst({ where: { id: input.userId, tenant_id: tenantId }, select: { id: true } });
  if (!user) throw new Error("USER_NOT_FOUND");

  const state = parseTimesheetState(tenant.settings);
  if (state.locked_months.includes(month)) throw new Error("PAYROLL_PERIOD_LOCKED");

  const key = `${input.userId}:${input.date}`;
  const prev = state.overrides[key] ?? null;
  state.overrides[key] = {
    status: input.status,
    source: input.source ?? "manual",
    updated_at: new Date().toISOString(),
    updated_by: actorUserId
  };

  await prisma.tenant.update({
    where: { id: tenantId },
    data: { settings: patchTimesheetState(tenant.settings, state) }
  });

  await appendTenantAuditEvent({
    tenantId,
    actorUserId,
    entityType: AuditEntityType.user,
    entityId: input.userId,
    action: "timesheet.patch.attendance",
    payload: { date: input.date, old: prev, new: state.overrides[key] }
  });

  return { ok: true };
}
