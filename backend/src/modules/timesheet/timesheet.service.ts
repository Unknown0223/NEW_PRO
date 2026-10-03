import type { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { AuditEntityType, sanitizePayloadForAudit } from "../../lib/tenant-audit";
import { mergeTabelAudit, readTabelAudit, type NewTabelAuditRecord } from "../tabel/tabel-audit";
import {
  listTimesheetEligibleUserIdsInMonth,
  loadSlotLeaveDatesForMonth
} from "../work-slots/work-slots.occupancy";
import { toFio } from "../staff/staff.shared.helpers";
import { orderTimesheetRows, parseTimesheetRoleFilter } from "./timesheet.order";
import { defaultTimesheetDay, employmentYmd, visitDayKeys } from "./timesheet.day-status";
import { applyAgentNormForUser, loadAgentNormContext } from "./timesheet.agent-norm";
import type { NormDay } from "./timesheet.agent-norm.pure";
import { parseWorkdaysState } from "../tabel/workdays.service";
import { loadTimezoneFromSettingsJson } from "../tenant-settings/tenant-timezone";
import { parseYearMonth, tenantMonthRangeUtc } from "../../lib/workday-calendar";

/** Табельda ko‘rsatilmaydigan rollar (masalan tizim admini). */
const TIMESHEET_EXCLUDED_ROLES = ["admin"] as const;

export function isTimesheetExcludedRole(role: string | null | undefined): boolean {
  const r = (role ?? "").trim().toLowerCase();
  return (TIMESHEET_EXCLUDED_ROLES as readonly string[]).includes(r);
}

/** Tanlangan rollardan adminni olib tashlaydi. Faqat excluded qolsa — `rejectedAll`. */
export function sanitizeTimesheetRoles(roles: string[] | undefined): {
  roles: string[] | undefined;
  rejectedAll: boolean;
} {
  if (!roles?.length) return { roles: undefined, rejectedAll: false };
  const next = roles.map((r) => r.trim()).filter((r) => r && !isTimesheetExcludedRole(r));
  if (next.length === 0) return { roles: undefined, rejectedAll: true };
  return { roles: next, rejectedAll: false };
}

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
  /** Bitta rol (eski API). */
  role?: string;
  /** Bir nechta rol: `roles=agent,supervisor`. */
  roles?: string[];
  /** Bitta filial (eski API). */
  branch?: string;
  /** Bir nechta filial: `branches=A,B`. */
  branches?: string[];
  /** Trade direction id. */
  direction_id?: number;
  user_id?: number;
};

export type TimesheetCellDto = {
  day: number;
  date: string;
  status: AttendanceStatus;
  source: AttendanceSource;
  /** Ishga olishdan oldin yoki bo'shatilgandan keyingi kun. */
  off_employment?: boolean;
  /** Avtomatik holat sababi (agent kunlik normasi). */
  comment?: string;
  /** Kunlik sof zakaz summasi (otkaz/vozvratdan keyin). */
  net_sales?: number;
  /** Shu kun uchun kunlik norma. */
  norm?: number;
};

export type TimesheetRowDto = {
  user_id: number;
  fio: string;
  role: string;
  login: string;
  /** Smart KOD */
  code: string | null;
  /** Филиал (user.branch yoki birinchi branch_link). */
  branch: string | null;
  /** Направление торговли. */
  direction: string | null;
  supervisor_user_id: number | null;
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

export function parseTimesheetState(settings: Prisma.JsonValue): TimesheetState {
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
  branches: string[];
  directions: Array<{ id: number; name: string }>;
  employees: Array<{ id: number; fio: string; role: string; login: string; code: string | null; branch: string | null }>;
}> {
  const [users, branchLinks, directions] = await Promise.all([
    prisma.user.findMany({
      where: {
        tenant_id: tenantId,
        is_active: true,
        NOT: { role: { equals: "admin", mode: "insensitive" } }
      },
      select: {
        id: true,
        name: true,
        first_name: true,
        last_name: true,
        middle_name: true,
        role: true,
        login: true,
        code: true,
        branch: true,
        branch_links: { select: { branch_code: true }, take: 8 }
      },
      orderBy: [{ role: "asc" }, { last_name: "asc" }, { first_name: "asc" }, { name: "asc" }]
    }),
    prisma.userBranchLink.findMany({
      where: { tenant_id: tenantId },
      select: { branch_code: true },
      distinct: ["branch_code"]
    }),
    prisma.tradeDirection.findMany({
      where: { tenant_id: tenantId, is_active: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" }
    })
  ]);

  const roles = [
    ...new Set(
      users
        .map((u) => u.role)
        .filter((x) => x && x.trim().length > 0 && !isTimesheetExcludedRole(x))
    )
  ];
  const branchSet = new Set<string>();
  for (const u of users) {
    if (isTimesheetExcludedRole(u.role)) continue;
    if (u.branch?.trim()) branchSet.add(u.branch.trim());
    for (const b of u.branch_links) {
      if (b.branch_code?.trim()) branchSet.add(b.branch_code.trim());
    }
  }
  for (const b of branchLinks) {
    if (b.branch_code?.trim()) branchSet.add(b.branch_code.trim());
  }

  return {
    roles,
    branches: [...branchSet].sort((a, b) => a.localeCompare(b, "ru")),
    directions: directions.map((d) => ({ id: d.id, name: d.name })),
    employees: users
      .filter((u) => !isTimesheetExcludedRole(u.role))
      .map((u) => ({
        id: u.id,
        fio: toFio(u),
        role: u.role,
        login: u.login,
        code: u.code,
        branch: u.branch?.trim() || u.branch_links[0]?.branch_code?.trim() || null
      }))
  };
}

export async function listTimesheetMatrix(tenantId: number, input: TimesheetFilterInput): Promise<{
  month: string;
  days: number[];
  rows: TimesheetRowDto[];
  locked: boolean;
}> {
  const { daysInMonth } = monthDateRange(input.month);
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { settings: true } });
  if (!tenant) throw new Error("NOT_FOUND");
  const state = parseTimesheetState(tenant.settings);
  const timeZone = loadTimezoneFromSettingsJson(tenant.settings);
  const workdays = parseWorkdaysState(tenant.settings);
  const ym = parseYearMonth(input.month);
  const { from, to } = tenantMonthRangeUtc(ym.year, ym.month, timeZone);
  const locked = state.locked_months.includes(input.month);

  const roleSanitize = sanitizeTimesheetRoles(parseTimesheetRoleFilter(input.role, input.roles?.join(",")));
  if (roleSanitize.rejectedAll) {
    const { daysInMonth } = monthDateRange(input.month);
    return {
      month: input.month,
      days: Array.from({ length: daysInMonth }, (_, i) => i + 1),
      rows: [],
      locked
    };
  }
  const roleFilter = roleSanitize.roles;
  const branchList = [
    ...new Set(
      [
        ...(input.branches ?? []),
        ...(input.branch?.trim() ? [input.branch.trim()] : [])
      ]
        .map((b) => b.trim())
        .filter(Boolean)
    )
  ];
  const directionId =
    typeof input.direction_id === "number" && Number.isFinite(input.direction_id) && input.direction_id > 0
      ? input.direction_id
      : undefined;

  const { eligibleIds, departedIds } = await listTimesheetEligibleUserIdsInMonth(tenantId, from, to);
  const departedSet = new Set(departedIds);

  if (eligibleIds.length === 0) {
    return {
      month: input.month,
      days: Array.from({ length: daysInMonth }, (_, i) => i + 1),
      rows: [],
      locked
    };
  }

  const and: Prisma.UserWhereInput[] = [
    { id: { in: eligibleIds } },
    { NOT: { role: { equals: "admin", mode: "insensitive" } } }
  ];
  if (roleFilter?.length === 1) and.push({ role: roleFilter[0] });
  else if (roleFilter && roleFilter.length > 1) and.push({ role: { in: roleFilter } });
  if (typeof input.user_id === "number") and.push({ id: input.user_id });
  if (branchList.length === 1) {
    and.push({
      OR: [
        { branch: { equals: branchList[0], mode: "insensitive" } },
        { branch_links: { some: { branch_code: { equals: branchList[0], mode: "insensitive" } } } }
      ]
    });
  } else if (branchList.length > 1) {
    and.push({
      OR: branchList.flatMap((b) => [
        { branch: { equals: b, mode: "insensitive" as const } },
        { branch_links: { some: { branch_code: { equals: b, mode: "insensitive" as const } } } }
      ])
    });
  }
  if (directionId) {
    and.push({ trade_direction_links: { some: { trade_direction_id: directionId } } });
  }

  const usersRaw = await prisma.user.findMany({
    where: {
      tenant_id: tenantId,
      AND: and
    },
    select: {
      id: true,
      name: true,
      first_name: true,
      last_name: true,
      middle_name: true,
      role: true,
      login: true,
      code: true,
      branch: true,
      trade_direction: true,
      supervisor_user_id: true,
      hired_at: true,
      dismissed_at: true,
      consignment: true,
      branch_links: { select: { branch_code: true }, take: 4 },
      trade_direction_row: { select: { name: true } },
      trade_direction_links: {
        take: 3,
        select: { trade_direction: { select: { name: true } } }
      }
    },
    orderBy: [{ role: "asc" }, { last_name: "asc" }, { first_name: "asc" }, { name: "asc" }]
  });
  const roleSet = roleFilter?.length
    ? new Set(roleFilter.map((r) => r.trim().toLowerCase()).filter(Boolean))
    : null;
  const users = usersRaw.filter((u) => {
    if (isTimesheetExcludedRole(u.role)) return false;
    if (roleSet && !roleSet.has(u.role.trim().toLowerCase())) return false;
    return true;
  });
  const userIds = users.map((u) => u.id);
  const leaveByUser = await loadSlotLeaveDatesForMonth(tenantId, from, to, userIds);

  const visits = userIds.length
    ? await prisma.agentVisit.findMany({
        where: { tenant_id: tenantId, agent_id: { in: userIds }, checked_in_at: { gte: from, lt: to } },
        select: { agent_id: true, checked_in_at: true }
      })
    : [];
  const visitByUserDay = visitDayKeys(visits, timeZone);
  const normCtx = await loadAgentNormContext(tenantId, tenant.settings, users, ym.year, ym.month, timeZone);

  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const rows: TimesheetRowDto[] = users.map((u) => {
    const leftAt = leaveByUser.get(u.id) ?? null;
    const isDeparted = departedSet.has(u.id);
    const hiredYmd = employmentYmd(u.hired_at, timeZone);
    const dismissedYmd = employmentYmd(u.dismissed_at, timeZone);
    const normDays = days.map((day): NormDay & { day: number } => {
      const date = isoDateForDay(input.month, day);
      const key = `${u.id}:${date}`;
      const override = state.overrides[key];
      const def = defaultTimesheetDay({
        state: workdays,
        role: u.role,
        userId: u.id,
        ymd: date,
        hasGpsVisit: visitByUserDay.has(key),
        hiredYmd,
        dismissedYmd
      });
      return {
        day,
        date,
        status: override ? override.status : def.status,
        source: override ? override.source : def.source,
        manual: Boolean(override),
        off_employment: def.off_employment && !override
      };
    });
    applyAgentNormForUser(normCtx, u, normDays, workdays, ym.year, ym.month);
    let worked = 0;
    let absent = 0;
    const cells = normDays.map((d): TimesheetCellDto => {
      worked += statusWorkValue(d.status);
      if (d.status === "absent") absent += 1;
      const cell: TimesheetCellDto = { day: d.day, date: d.date, status: d.status, source: d.source };
      if (d.off_employment) cell.off_employment = true;
      if (d.comment) cell.comment = d.comment;
      if (d.net_sales != null) cell.net_sales = d.net_sales;
      if (d.norm != null) cell.norm = d.norm;
      return cell;
    });
    const branch =
      u.branch?.trim() ||
      u.branch_links.find((b) => b.branch_code?.trim())?.branch_code?.trim() ||
      null;
    const direction =
      u.trade_direction?.trim() ||
      u.trade_direction_row?.name?.trim() ||
      u.trade_direction_links.find((l) => l.trade_direction?.name?.trim())?.trade_direction?.name?.trim() ||
      null;
    return {
      user_id: u.id,
      fio: toFio(u),
      role: u.role,
      login: u.login,
      code: u.code?.trim() || null,
      branch,
      direction,
      supervisor_user_id: u.supervisor_user_id ?? null,
      cells,
      worked_days: worked,
      absent_days: absent,
      slot_left_at: leftAt,
      is_departed: isDeparted
    };
  });

  const ordered = orderTimesheetRows(rows, roleFilter);

  return { month: input.month, days, rows: ordered, locked };
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

  // Slotdan chiqqan (departed) yoki chiqish sanasidan keyingi kunlar — faqat admin.
  if (!opts?.actorIsAdmin) {
    const monthsList = [...months];
    const leaveMaps: Map<string, Map<number, string>> = new Map();
    const departedByMonth = new Map<string, Set<number>>();
    for (const m of monthsList) {
      const { from, to } = monthDateRange(m);
      leaveMaps.set(m, await loadSlotLeaveDatesForMonth(tenantId, from, to, userIds));
      const { departedIds } = await listTimesheetEligibleUserIdsInMonth(tenantId, from, to);
      departedByMonth.set(m, new Set(departedIds.filter((id) => userIds.includes(id))));
    }
    for (const e of entries) {
      const m = e.date.slice(0, 7);
      if (departedByMonth.get(m)?.has(e.userId)) throw new Error("SLOT_LEFT_DAY_LOCKED");
      const left = leaveMaps.get(m)?.get(e.userId);
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
