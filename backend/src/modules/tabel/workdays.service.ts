import type { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import {
  genAuditId,
  mergeTabelAudit,
  readTabelAudit,
  type NewTabelAuditRecord
} from "./tabel-audit";

/**
 * «Рабочие дни» — недельные графики ролей, исключения по датам и
 * индивидуальные графики сотрудников. Персистится в `tenant.settings.workdays`.
 */

export const WD_ROLES = [
  "Агент",
  "Кассир",
  "Менеджер",
  "Мерчендайзер",
  "Оператор",
  "Складчик",
  "Супервайзер",
  "Экспедитор"
] as const;
export type WdRole = (typeof WD_ROLES)[number];

export type ExceptionType = "holiday" | "forced" | "event" | "training";

const EXCEPTION_LABEL: Record<ExceptionType, string> = {
  holiday: "Праздник",
  forced: "Обязательный рабочий день",
  event: "Мероприятие компании",
  training: "Обучение (тренинг)"
};

const WEEKDAYS_RU = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

export type Schedule = boolean[];
export type ScheduleMap = Record<string, Schedule>;

export interface WorkdayException {
  id: string;
  role: WdRole | "ALL";
  date: string;
  type: ExceptionType;
  comment: string;
  createdBy: string;
  createdAt: string;
}

export interface EmployeeOverride {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  position: string;
  schedule: Schedule;
  comment: string;
  createdBy: string;
  createdAt: string;
}

export interface WorkdaysState {
  schedules: ScheduleMap;
  exceptions: WorkdayException[];
  overrides: EmployeeOverride[];
}

const DEFAULT_SCHEDULE_5_6: Schedule = [true, true, true, true, true, true, false];
const DEFAULT_SCHEDULE_5: Schedule = [true, true, true, true, true, false, false];

export function defaultSchedules(): ScheduleMap {
  const map: ScheduleMap = {};
  for (const r of WD_ROLES) map[r] = [...(r === "Супервайзер" ? DEFAULT_SCHEDULE_5 : DEFAULT_SCHEDULE_5_6)];
  return map;
}

function asObj(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function toSchedule(v: unknown): Schedule | null {
  if (!Array.isArray(v) || v.length !== 7) return null;
  return v.map((x) => Boolean(x));
}

function isExceptionType(v: unknown): v is ExceptionType {
  return v === "holiday" || v === "forced" || v === "event" || v === "training";
}

function scheduleText(sch: Schedule): string {
  return sch.map((v, i) => (v ? WEEKDAYS_RU[i] : null)).filter(Boolean).join(", ") || "выходной";
}

export function parseWorkdaysState(settings: Prisma.JsonValue): WorkdaysState {
  const root = asObj(settings);
  const wd = asObj(root.workdays);

  const schedules = defaultSchedules();
  const rawSchedules = asObj(wd.schedules);
  for (const r of WD_ROLES) {
    const s = toSchedule(rawSchedules[r]);
    if (s) schedules[r] = s;
  }

  const exceptions: WorkdayException[] = [];
  if (Array.isArray(wd.exceptions)) {
    for (const item of wd.exceptions) {
      const o = asObj(item);
      const id = typeof o.id === "string" ? o.id : "";
      const date = typeof o.date === "string" ? o.date : "";
      const role = o.role === "ALL" || (typeof o.role === "string" && WD_ROLES.includes(o.role as WdRole)) ? (o.role as WdRole | "ALL") : null;
      if (!id || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !role || !isExceptionType(o.type)) continue;
      exceptions.push({
        id,
        role,
        date,
        type: o.type,
        comment: typeof o.comment === "string" ? o.comment : "",
        createdBy: typeof o.createdBy === "string" ? o.createdBy : "система",
        createdAt: typeof o.createdAt === "string" ? o.createdAt : new Date(0).toISOString()
      });
    }
  }

  const overrides: EmployeeOverride[] = [];
  if (Array.isArray(wd.overrides)) {
    for (const item of wd.overrides) {
      const o = asObj(item);
      const id = typeof o.id === "string" ? o.id : "";
      const employeeId = typeof o.employeeId === "string" ? o.employeeId : "";
      const sch = toSchedule(o.schedule);
      if (!id || !employeeId || !sch) continue;
      overrides.push({
        id,
        employeeId,
        employeeName: typeof o.employeeName === "string" ? o.employeeName : employeeId,
        employeeCode: typeof o.employeeCode === "string" ? o.employeeCode : "",
        position: typeof o.position === "string" ? o.position : "",
        schedule: sch,
        comment: typeof o.comment === "string" ? o.comment : "",
        createdBy: typeof o.createdBy === "string" ? o.createdBy : "система",
        createdAt: typeof o.createdAt === "string" ? o.createdAt : new Date(0).toISOString()
      });
    }
  }

  return { schedules, exceptions, overrides };
}

function buildSettings(
  settings: Prisma.JsonValue,
  state: WorkdaysState,
  auditAdd: NewTabelAuditRecord[]
): Prisma.InputJsonValue {
  const root = asObj(settings);
  const next: Record<string, unknown> = {
    ...root,
    workdays: {
      schedules: state.schedules,
      exceptions: state.exceptions,
      overrides: state.overrides
    }
  };
  if (auditAdd.length > 0) {
    next.tabel_audit = mergeTabelAudit(readTabelAudit(settings), auditAdd);
  }
  return next as Prisma.InputJsonValue;
}

async function loadTenantSettings(tenantId: number): Promise<Prisma.JsonValue> {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { settings: true } });
  if (!tenant) throw new Error("NOT_FOUND");
  return tenant.settings;
}

export async function getWorkdaysState(tenantId: number): Promise<WorkdaysState> {
  return parseWorkdaysState(await loadTenantSettings(tenantId));
}

export async function saveSchedules(
  tenantId: number,
  changedBy: string,
  incoming: Record<string, unknown>
): Promise<WorkdaysState> {
  const settings = await loadTenantSettings(tenantId);
  const state = parseWorkdaysState(settings);
  const audit: NewTabelAuditRecord[] = [];
  for (const r of WD_ROLES) {
    const next = toSchedule(incoming[r]);
    if (!next) continue;
    const prev = state.schedules[r];
    if (prev.some((v, i) => v !== next[i])) {
      audit.push({
        module: "workdays",
        kind: "schedule",
        title: r,
        subtitle: "Недельный график роли",
        oldValue: scheduleText(prev),
        newValue: scheduleText(next),
        changedBy
      });
    }
    state.schedules[r] = next;
  }
  await prisma.tenant.update({ where: { id: tenantId }, data: { settings: buildSettings(settings, state, audit) } });
  return state;
}

export async function addException(
  tenantId: number,
  changedBy: string,
  input: { role: WdRole | "ALL"; date: string; type: ExceptionType; comment: string }
): Promise<WorkdaysState> {
  const settings = await loadTenantSettings(tenantId);
  const state = parseWorkdaysState(settings);
  const ex: WorkdayException = {
    id: genAuditId(),
    role: input.role,
    date: input.date,
    type: input.type,
    comment: input.comment,
    createdBy: changedBy,
    createdAt: new Date().toISOString()
  };
  state.exceptions.push(ex);
  const audit: NewTabelAuditRecord[] = [
    {
      module: "workdays",
      kind: "exception",
      title: input.role === "ALL" ? "Все роли" : input.role,
      subtitle: `${EXCEPTION_LABEL[input.type]} · ${input.date}`,
      newValue: EXCEPTION_LABEL[input.type],
      comment: input.comment,
      changedBy
    }
  ];
  await prisma.tenant.update({ where: { id: tenantId }, data: { settings: buildSettings(settings, state, audit) } });
  return state;
}

export async function removeException(tenantId: number, id: string): Promise<WorkdaysState> {
  const settings = await loadTenantSettings(tenantId);
  const state = parseWorkdaysState(settings);
  state.exceptions = state.exceptions.filter((e) => e.id !== id);
  await prisma.tenant.update({ where: { id: tenantId }, data: { settings: buildSettings(settings, state, []) } });
  return state;
}

export async function upsertOverride(
  tenantId: number,
  changedBy: string,
  input: {
    employeeId: string;
    employeeName: string;
    employeeCode: string;
    position: string;
    schedule: Schedule;
    comment: string;
  }
): Promise<WorkdaysState> {
  const settings = await loadTenantSettings(tenantId);
  const state = parseWorkdaysState(settings);
  state.overrides = state.overrides.filter((o) => o.employeeId !== input.employeeId);
  state.overrides.push({
    id: genAuditId(),
    ...input,
    createdBy: changedBy,
    createdAt: new Date().toISOString()
  });
  const audit: NewTabelAuditRecord[] = [
    {
      module: "workdays",
      kind: "override",
      title: input.employeeName,
      subtitle: `Индивидуальный график · ${input.position}`,
      newValue: scheduleText(input.schedule),
      comment: input.comment,
      changedBy
    }
  ];
  await prisma.tenant.update({ where: { id: tenantId }, data: { settings: buildSettings(settings, state, audit) } });
  return state;
}

export async function removeOverride(tenantId: number, id: string): Promise<WorkdaysState> {
  const settings = await loadTenantSettings(tenantId);
  const state = parseWorkdaysState(settings);
  state.overrides = state.overrides.filter((o) => o.id !== id);
  await prisma.tenant.update({ where: { id: tenantId }, data: { settings: buildSettings(settings, state, []) } });
  return state;
}
