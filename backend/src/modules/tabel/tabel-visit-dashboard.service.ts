/**
 * Ikkinchi platformadagi «Статистика посещений» sahifasi.
 * Surat faqat terminal kadridan (photo_front_key). Avatar va yuz-etalon ishlatilmaydi.
 */
import { prisma } from "../../config/database";
import { toFio } from "../staff/staff.shared.helpers";

const PRESENT = new Set(["worked", "late", "half_day", "overtime", "weekend_work", "remote", "early_leave"]);
const AWAY = new Set(["vacation", "sick", "trip", "unpaid_leave", "excused_absent"]);

function ymdInTashkent(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tashkent",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

function utcDay(ymd: string): Date {
  return new Date(`${ymd}T00:00:00.000Z`);
}

function addDays(ymd: string, days: number): string {
  const date = utcDay(ymd);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function monthStart(ymd: string): string {
  return `${ymd.slice(0, 8)}01`;
}

type Person = { id: number; name: string; first_name: string | null; last_name: string | null; middle_name: string | null; branch: string | null; role: string; position: string | null };

export async function getVisitDashboard(tenantId: number) {
  const today = ymdInTashkent(new Date());
  const yesterday = addDays(today, -1);
  const from = monthStart(today);
  const weekEnd = addDays(today, 7);
  const fromDate = utcDay(from);
  const todayDate = utcDay(today);
  const weekDate = utcDay(weekEnd);

  const [people, days, punches, absences] = await Promise.all([
    prisma.user.findMany({
      where: { tenant_id: tenantId, is_active: true },
      select: { id: true, name: true, first_name: true, last_name: true, middle_name: true, branch: true, role: true, position: true }
    }),
    prisma.attendanceDayRecord.findMany({
      where: { tenant_id: tenantId, work_date: { gte: fromDate, lte: todayDate } },
      select: { user_id: true, work_date: true, status: true, late_minutes: true, late_excused: true }
    }),
    prisma.attendancePunch.findMany({
      where: { tenant_id: tenantId, work_date: { gte: fromDate, lte: todayDate }, is_valid: true },
      orderBy: { occurred_at: "desc" },
      take: 80,
      select: { id: true, user_id: true, occurred_at: true, direction: true, source: true, photo_front_key: true, work_date: true }
    }),
    prisma.staffAbsenceRequest.findMany({
      where: {
        tenant_id: tenantId,
        status: "approved",
        from_date: { lte: weekDate },
        to_date: { gte: todayDate }
      },
      orderBy: { from_date: "asc" },
      take: 8,
      select: { id: true, user_id: true, type: true, from_date: true, to_date: true }
    })
  ]);

  const byId = new Map<number, Person>(people.map((person) => [person.id, person]));
  const dayKey = (date: Date) => date.toISOString().slice(0, 10);

  const counts = new Map<string, { present: number; away: number; late: number }>();
  for (const row of days) {
    const key = dayKey(row.work_date);
    const bucket = counts.get(key) ?? { present: 0, away: 0, late: 0 };
    if (PRESENT.has(row.status)) bucket.present += 1;
    if (AWAY.has(row.status)) bucket.away += 1;
    if (row.late_minutes > 0 && !row.late_excused) bucket.late += 1;
    counts.set(key, bucket);
  }

  const month: Array<{ day: number; present: number; absent: number }> = [];
  const lastDay = Number(today.slice(8, 10));
  for (let day = 1; day <= lastDay; day += 1) {
    const key = `${today.slice(0, 8)}${String(day).padStart(2, "0")}`;
    const bucket = counts.get(key) ?? { present: 0, away: 0, late: 0 };
    const absent = Math.max(0, people.length - bucket.present - bucket.away);
    month.push({ day, present: bucket.present, absent });
  }

  const todayCounts = counts.get(today) ?? { present: 0, away: 0, late: 0 };
  const prevCounts = counts.get(yesterday) ?? { present: 0, away: 0, late: 0 };

  const branches = new Map<string, number>();
  for (const person of people) {
    const name = person.branch?.trim() || "Без филиала";
    branches.set(name, (branches.get(name) ?? 0) + 1);
  }

  const activity = punches.slice(0, 12).map((punch) => {
    const person = byId.get(punch.user_id);
    return {
      id: punch.id,
      at: punch.occurred_at.toISOString(),
      direction: punch.direction,
      source: punch.source,
      name: person ? toFio(person) : `User #${punch.user_id}`,
      branch: person?.branch ?? null,
      has_terminal_photo: Boolean(punch.photo_front_key)
    };
  });

  const seen = new Set<number>();
  const recent: Array<{ id: number; name: string; branch: string | null; role: string; punch_id: number | null }> = [];
  for (const punch of punches) {
    if (dayKey(punch.work_date) !== today || seen.has(punch.user_id)) continue;
    seen.add(punch.user_id);
    const person = byId.get(punch.user_id);
    recent.push({
      id: punch.user_id,
      name: person ? toFio(person) : `User #${punch.user_id}`,
      branch: person?.branch ?? null,
      role: person?.position || person?.role || "—",
      punch_id: punch.photo_front_key ? punch.id : null
    });
    if (recent.length >= 8) break;
  }

  return {
    date: today,
    kpi: {
      headcount: people.length,
      present: todayCounts.present,
      present_prev: prevCounts.present,
      away: todayCounts.away,
      away_prev: prevCounts.away,
      late: todayCounts.late,
      late_prev: prevCounts.late
    },
    month,
    branches: [...branches.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8),
    recent,
    activity,
    absences: absences.map((row) => {
      const person = byId.get(row.user_id);
      return {
        id: row.id,
        name: person ? toFio(person) : `User #${row.user_id}`,
        type: row.type,
        from: row.from_date.toISOString().slice(0, 10),
        to: row.to_date.toISOString().slice(0, 10)
      };
    })
  };
}
