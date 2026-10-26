/**
 * Smena tugagach oxirgi belgini `out` qiladi va belgisiz xodimga `absent` yozadi.
 */
import { prisma } from "../../config/database";
import { isCalendarWorkingDay } from "../../lib/workday-calendar";
import { loadTimezoneFromSettingsJson } from "../tenant-settings/tenant-timezone";
import { isShiftOrDayClosed } from "./tabel-engine.pure";
import { parseWorkdaysState } from "./workdays.service";
import { recomputeUserWorkDay, resolveUserShift } from "./tabel-punch.service";

export async function closeEndedShiftsAndMarkAbsent(targetTenantId?: number): Promise<{
  tenants: number;
  shiftsClosed: number;
  absentMarked: number;
}> {
  const tenants = await prisma.tenant.findMany({
    where: targetTenantId ? { id: targetTenantId } : { is_active: true },
    select: { id: true, settings: true }
  });
  let shiftsClosed = 0;
  let absentMarked = 0;
  const now = new Date();

  for (const t of tenants) {
    const tz = loadTimezoneFromSettingsJson(t.settings);
    const workdays = parseWorkdaysState(t.settings);
    const todayYmd = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(now);
    const workDate = new Date(`${todayYmd}T00:00:00.000Z`);

    const [users, punches] = await Promise.all([
      prisma.user.findMany({
        where: {
          tenant_id: t.id,
          is_active: true,
          NOT: { role: { equals: "admin", mode: "insensitive" } },
          OR: [{ hired_at: null }, { hired_at: { lte: now } }],
          AND: [{ OR: [{ dismissed_at: null }, { dismissed_at: { gt: workDate } }] }]
        },
        select: { id: true, role: true, branch: true }
      }),
      prisma.attendancePunch.findMany({
        where: { tenant_id: t.id, work_date: workDate, is_valid: true },
        orderBy: { occurred_at: "asc" }
      })
    ]);

    const byUser = new Map<number, typeof punches>();
    for (const p of punches) {
      const arr = byUser.get(p.user_id) ?? [];
      arr.push(p);
      byUser.set(p.user_id, arr);
    }

    for (const u of users) {
      const shift = await resolveUserShift(t.id, u.role, u.branch);
      if (!isShiftOrDayClosed(todayYmd, now, shift.end_time, tz)) continue;

      const list = byUser.get(u.id) ?? [];
      if (list.length >= 2) {
        const last = list[list.length - 1]!;
        if (last.role_in_day !== "out") {
          await prisma.attendancePunch.update({
            where: { id: last.id },
            data: { role_in_day: "out", direction: "OUT" }
          });
          shiftsClosed += 1;
        }
      }

      if (list.length === 0 && !isCalendarWorkingDay(workdays, u.role, u.id, todayYmd)) {
        continue;
      }

      const before = await prisma.attendanceDayRecord.findUnique({
        where: { tenant_id_user_id_work_date: { tenant_id: t.id, user_id: u.id, work_date: workDate } },
        select: { status: true, source: true, override_by: true }
      });
      const row = await recomputeUserWorkDay(t.id, u.id, todayYmd, now);
      if (list.length === 0 && row?.status === "absent" && before?.status !== "absent") {
        absentMarked += 1;
      }
    }
  }

  return { tenants: tenants.length, shiftsClosed, absentMarked };
}
