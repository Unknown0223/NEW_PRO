import type { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { AuditEntityType, sanitizePayloadForAudit } from "../../lib/tenant-audit";
import { mergeTabelAudit, readTabelAudit, type NewTabelAuditRecord } from "../tabel/tabel-audit";
import {
  listDepartedSlotUserIdsInMonth,
  loadSlotLeaveDatesForMonth
} from "../work-slots/work-slots.occupancy";

/**
 * Полная модель статусов (паритет с прототипом TabelERP):
 *  worked=1 · half_day=0.5 · absent=0 · holiday=выходной · vacation=отпуск ·
 *  sick=больничный · trip=командировка.
 */
export type AttendanceStatus =
  | "worked"
  | "half_day"
  | "absent"
  | "vacation"
  | "sick"
  | "holiday"
  | "trip";
export type AttendanceSource = "manual" | "gps" | "mobile_login" | "auto";

/** Вклад статуса в «Итого» рабочих дней. */
export function statusWorkValue(status: AttendanceStatus): number {
  if (status === "worked") return 1;
  if (status === "half_day") return 0.5;
  return 0;
}

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
  /** Slotdan chiqish sanasi (YYYY-MM-DD) — shu kundan keyin blok. */
  slot_left_at: string | null;
  /** Oy ichida slotdan chiqib, hozir faol sloti yo‘q. */
  is_departed: boolean;
};

function asObj(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function isStatus(v: string): v is AttendanceStatus {
  return (
    v === "worked" ||
    v === "half_day" ||
    v === "absent" ||
    v === "vacation" ||
    v === "sick" ||
    v === "holiday" ||
    v === "trip"
  );
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

  const departedIds = await listDepartedSlotUserIdsInMonth(tenantId, from, to);
  const departedSet = new Set(departedIds);

  const users = await prisma.user.findMany({
    where: {
      tenant_id: tenantId,
      OR: [
        { is_active: true },
        ...(departedIds.length ? [{ id: { in: departedIds } }] : [])
      ],
      ...(input.role?.trim() ? { role: input.role.trim() } : {}),
      ...(typeof input.user_id === "number" ? { id: input.user_id } : {})
    },
    select: { id: true, name: true, role: true, login: true },
    orderBy: [{ role: "asc" }, { name: "asc" }]
  });
  const userIds = users.map((u) => u.id);
  const leaveByUser = await loadSlotLeaveDatesForMonth(tenantId, from, to, userIds);

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
    const leftAt = leaveByUser.get(u.id) ?? null;
    const isDeparted = departedSet.has(u.id);
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
      worked += statusWorkValue(status);
      if (status === "absent") absent += 1;
      return { day, date, status, source };
    });
    return {
      user_id: u.id,
      fio: u.name,
      role: u.role,
      login: u.login,
      cells,
      worked_days: worked,
      absent_days: absent,
      slot_left_at: leftAt,
      is_departed: isDeparted
    };
  });

  // Faol xodimlar yuqorida; slotdan chiqqanlar — jamoa pastida.
  rows.sort((a, b) => {
    if (a.is_departed !== b.is_departed) return a.is_departed ? 1 : -1;
    const roleCmp = a.role.localeCompare(b.role, "ru");
    if (roleCmp !== 0) return roleCmp;
    return a.fio.localeCompare(b.fio, "ru");
  });

  return { month: input.month, days, rows, locked };
}

export const ATTENDANCE_STATUS_LABEL_RU: Record<AttendanceStatus, string> = {
  worked: "Работал",
  half_day: "Полдня",
  absent: "Отсутствовал",
  holiday: "Выходной",
  vacation: "Отпуск",
  sick: "Больничный",
  trip: "Командировка"
};

export type AttendanceCellInput = {
  userId: number;
  date: string;
  status: AttendanceStatus;
  source?: AttendanceSource;
  comment?: string;
};

/**
 * Массовая правка ячеек табеля в ОДНОМ запросе/транзакции.
 *
 * Раньше веб слал по одному PATCH на каждую ячейку: это не только N сетевых
 * вызовов, но и гонка «lost update» — каждый запрос читал и перезаписывал весь
 * `tenant.settings`, затирая соседние изменения. Здесь настройки читаются один
 * раз, все overrides применяются в памяти, журнал аудита пополняется одним
 * `mergeTabelAudit`, БД пишется одним `tenant.update`, а события аудита —
 * одним `createMany`.
 */
export async function patchAttendanceCells(
  tenantId: number,
  actorUserId: number | null,
  entries: AttendanceCellInput[],
  changedBy?: string,
  opts?: { actorIsAdmin?: boolean }
): Promise<{ ok: true; applied: number; changed: number }> {
  if (entries.length === 0) return { ok: true, applied: 0, changed: 0 };

  const today = new Date().toISOString().slice(0, 10);
  for (const e of entries) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(e.date)) throw new Error("BAD_DATE");
    if (e.date > today) throw new Error("FUTURE_DATE_DENIED");
  }
  const months = new Set(entries.map((e) => e.date.slice(0, 7)));

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { settings: true } });
  if (!tenant) throw new Error("NOT_FOUND");

  const state = parseTimesheetState(tenant.settings);
  for (const m of months) if (state.locked_months.includes(m)) throw new Error("PAYROLL_PERIOD_LOCKED");

  const userIds = [...new Set(entries.map((e) => e.userId))];
  const users = await prisma.user.findMany({
    where: { id: { in: userIds }, tenant_id: tenantId },
    select: { id: true, name: true }
  });
  const userById = new Map(users.map((u) => [u.id, u]));
  for (const id of userIds) if (!userById.has(id)) throw new Error("USER_NOT_FOUND");

  // Slotdan chiqqandan keyingi kunlar — faqat admin o‘zgartira oladi.
  if (!opts?.actorIsAdmin) {
    const leaveMaps: Map<string, Map<number, string>> = new Map();
    for (const m of months) {
      const { from, to } = monthDateRange(m);
      leaveMaps.set(m, await loadSlotLeaveDatesForMonth(tenantId, from, to, userIds));
    }
    for (const e of entries) {
      const left = leaveMaps.get(e.date.slice(0, 7))?.get(e.userId);
      if (left && e.date > left) throw new Error("SLOT_LEFT_DAY_LOCKED");
    }
  }

  const now = new Date().toISOString();
  const actor = changedBy?.trim() || "система";
  const additions: NewTabelAuditRecord[] = [];
  const auditEventData: Prisma.TenantAuditEventCreateManyInput[] = [];
  const uid =
    actorUserId != null && Number.isFinite(actorUserId) && actorUserId > 0 ? Math.floor(Number(actorUserId)) : null;
  let changed = 0;

  for (const e of entries) {
    const key = `${e.userId}:${e.date}`;
    const prev = state.overrides[key] ?? null;
    const prevStatus: AttendanceStatus = prev?.status ?? "absent";
    const next: OverrideRow = {
      status: e.status,
      source: e.source ?? "manual",
      updated_at: now,
      updated_by: actorUserId
    };
    state.overrides[key] = next;
    if (prevStatus === e.status) continue;
    changed += 1;
    additions.push({
      module: "timesheet",
      kind: "status",
      title: userById.get(e.userId)!.name,
      subtitle: e.date,
      oldValue: ATTENDANCE_STATUS_LABEL_RU[prevStatus],
      newValue: ATTENDANCE_STATUS_LABEL_RU[e.status],
      comment: e.comment?.trim() || "Изменено в табеле",
      changedBy: actor
    });
    auditEventData.push({
      tenant_id: tenantId,
      actor_user_id: uid,
      entity_type: AuditEntityType.user,
      entity_id: String(e.userId).slice(0, 64),
      action: "timesheet.patch.attendance",
      payload: sanitizePayloadForAudit({ date: e.date, old: prev, new: next }) as Prisma.InputJsonValue
    });
  }

  const settingsRoot = patchTimesheetState(tenant.settings, state) as Record<string, unknown>;
  if (additions.length > 0) {
    settingsRoot.tabel_audit = mergeTabelAudit(readTabelAudit(tenant.settings), additions);
  }

  await prisma.tenant.update({
    where: { id: tenantId },
    data: { settings: settingsRoot as Prisma.InputJsonValue }
  });

  if (auditEventData.length > 0) {
    await prisma.tenantAuditEvent.createMany({ data: auditEventData });
  }

  return { ok: true, applied: entries.length, changed };
}

/** Правка одной ячейки — тонкая обёртка над массовым путём (единый код). */
export async function patchAttendanceCell(
  tenantId: number,
  actorUserId: number | null,
  input: AttendanceCellInput & { changedBy?: string },
  opts?: { actorIsAdmin?: boolean }
): Promise<{ ok: true }> {
  await patchAttendanceCells(
    tenantId,
    actorUserId,
    [{ userId: input.userId, date: input.date, status: input.status, source: input.source, comment: input.comment }],
    input.changedBy,
    opts
  );
  return { ok: true };
}
