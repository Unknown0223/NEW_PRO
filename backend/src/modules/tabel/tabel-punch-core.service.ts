/**
 * Punch umumiy kontekst: timezone, kunlik kod, kun yozuvini qayta hisoblash.
 */
import { prisma } from "../../config/database";
import { isCalendarWorkingDay } from "../../lib/workday-calendar";
import { loadTimezoneFromSettingsJson } from "../tenant-settings/tenant-timezone";
import { parseWorkdaysState } from "./workdays.service";
import { computeDayFromPunches } from "./tabel-engine.pure";
import { normalizeFullTabelSettings, pickDayCode, type FullTabelSettings } from "./tabel-settings.pure";
import { isManualDayLock } from "../timesheet/timesheet.day-ledger";
import { markPayrollDirty } from "../payroll/payroll.dirty";
import { resolveUserShift } from "./tabel-shift-resolve.service";

export function todayYmdInTz(now: Date, timeZone = "Asia/Tashkent"): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export async function loadTenantTabelContext(tenantId: number): Promise<{
  timeZone: string;
  workdays: ReturnType<typeof parseWorkdaysState>;
  tabelSettings: FullTabelSettings;
  rawSettings: Record<string, unknown>;
}> {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { settings: true } });
  const raw =
    tenant?.settings && typeof tenant.settings === "object" && !Array.isArray(tenant.settings)
      ? (tenant.settings as Record<string, unknown>)
      : {};
  return {
    timeZone: loadTimezoneFromSettingsJson(tenant?.settings ?? {}),
    workdays: parseWorkdaysState(tenant?.settings ?? {}),
    tabelSettings: normalizeFullTabelSettings(raw.tabel_settings),
    rawSettings: raw
  };
}

export async function issueOrGetDayCode(tenantId: number, userId: number, workYmd?: string): Promise<number> {
  const ymd = workYmd ?? todayYmdInTz(new Date());
  const workDate = new Date(`${ymd}T00:00:00.000Z`);
  const existing = await prisma.punchDayCode.findUnique({
    where: { tenant_id_user_id_work_date: { tenant_id: tenantId, user_id: userId, work_date: workDate } }
  });
  if (existing) return existing.code;

  const takenRows = await prisma.punchDayCode.findMany({ where: { tenant_id: tenantId, work_date: workDate }, select: { code: true } });
  const code = pickDayCode(new Set(takenRows.map((r) => r.code))) ?? 100 + (userId % 900);
  try {
    const created = await prisma.punchDayCode.create({ data: { tenant_id: tenantId, user_id: userId, work_date: workDate, code } });
    return created.code;
  } catch {
    const again = await prisma.punchDayCode.findUnique({
      where: { tenant_id_user_id_work_date: { tenant_id: tenantId, user_id: userId, work_date: workDate } }
    });
    return again?.code ?? code;
  }
}

export async function recomputeUserWorkDay(tenantId: number, userId: number, workYmd: string, now = new Date()) {
  const ctx = await loadTenantTabelContext(tenantId);
  const user = await prisma.user.findFirst({ where: { id: userId, tenant_id: tenantId }, select: { id: true, role: true, branch: true } });
  if (!user) return null;

  const workDate = new Date(`${workYmd}T00:00:00.000Z`);
  const existing = await prisma.attendanceDayRecord.findUnique({
    where: { tenant_id_user_id_work_date: { tenant_id: tenantId, user_id: userId, work_date: workDate } }
  });
  if (isManualDayLock(existing)) return existing;

  const [shift, punches, req] = await Promise.all([
    resolveUserShift(tenantId, user.role, user.branch),
    prisma.attendancePunch.findMany({ where: { tenant_id: tenantId, user_id: userId, work_date: workDate }, orderBy: { occurred_at: "asc" } }),
    prisma.staffAbsenceRequest.findFirst({
      where: { tenant_id: tenantId, user_id: userId, status: "approved", from_date: { lte: workDate }, to_date: { gte: workDate } },
      orderBy: { id: "desc" }
    })
  ]);

  const isWorkingDay = isCalendarWorkingDay(ctx.workdays, user.role, user.id, workYmd);
  const computed = computeDayFromPunches({
    workYmd,
    now,
    timeZone: ctx.timeZone,
    isWorkingDay,
    shift,
    earlyLeaveGraceMinutes: ctx.tabelSettings.lateness.earlyLeaveGraceMinutes,
    punches: punches.map((p) => ({ id: p.id, occurred_at: p.occurred_at, source: p.source, is_valid: p.is_valid })),
    approvedRequest: req ? { type: req.type, hours: req.hours } : null
  });

  for (const pr of computed.punch_roles) {
    if (!pr.id) continue;
    await prisma.attendancePunch.update({
      where: { id: pr.id },
      data: { role_in_day: pr.role_in_day, direction: pr.role_in_day === "in" ? "IN" : "OUT" }
    });
  }

  const dayData = {
    status: computed.status,
    source: computed.source,
    first_in_at: computed.first_in_at,
    last_out_at: computed.last_out_at,
    late_minutes: computed.late_minutes,
    early_leave_minutes: computed.early_leave_minutes,
    worked_minutes: computed.worked_minutes,
    overtime_minutes: computed.overtime_minutes
  };

  const row = await prisma.attendanceDayRecord.upsert({
    where: { tenant_id_user_id_work_date: { tenant_id: tenantId, user_id: userId, work_date: workDate } },
    create: { tenant_id: tenantId, user_id: userId, work_date: workDate, ...dayData },
    update: dayData
  });
  const year = Number(workYmd.slice(0, 4));
  const month = Number(workYmd.slice(5, 7));
  if (Number.isInteger(year) && Number.isInteger(month) && month >= 1 && month <= 12) {
    void markPayrollDirty(tenantId, { userIds: [userId], year, month }, "tabel_punch");
  }
  return row;
}
