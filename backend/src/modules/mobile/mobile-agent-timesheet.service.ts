import { prisma } from "../../config/database";
import { readTabelAudit, type TabelAuditRecord } from "../tabel/tabel-audit";
import {
  listTimesheetMatrix,
  statusWorkValue,
  type AttendanceStatus,
  type AttendanceSource
} from "../timesheet/timesheet.service";

/**
 * Mobil «Табель» — agentning O'ZINI (self) oylik davomat jadvali.
 *
 * Web `timesheet` moduli bilan bitta manba: statuslar aynan `listTimesheetMatrix`
 * dan olinadi (worked/half_day/absent/holiday/vacation/sick/trip). Ustiga har kun
 * uchun real metrikalar qo'shiladi: savdo summasi (orders.total_sum), tashriflar soni
 * (agent_visits) va ish soatlari (checked_out − checked_in).
 *
 * Kun kaliti (YYYY-MM-DD) matritsa bilan bir xil — UTC sanasi bo'yicha bucketlanadi,
 * shunda status katakchasi va metrikalar bir xil kunga to'g'ri keladi.
 *
 * Kommentariya / tarix — web cell modal bilan bir xil: `tenant.settings.tabel_audit`
 * (title = FIO, subtitle = YYYY-MM-DD).
 */

export type MobileTimesheetDayHistory = {
  id: string;
  old_value: string | null;
  new_value: string | null;
  comment: string | null;
  changed_by: string;
  changed_at: string;
};

export type MobileTimesheetDay = {
  day: number;
  date: string; // YYYY-MM-DD
  weekday: number; // 1=Пн … 7=Вс
  status: AttendanceStatus;
  source: AttendanceSource;
  sales: number;
  visits: number;
  worked_minutes: number;
  /** Oxirgi audit kommentariyasi (web «Комментарий» / tarix). */
  comment: string | null;
  history: MobileTimesheetDayHistory[];
};

export type MobileTimesheetTotals = {
  days_in_month: number;
  worked_days: number; // worked=1 + half_day=0.5
  active_days: number; // worked
  half_days: number;
  absent_days: number;
  holiday_days: number;
  vacation_days: number;
  sick_days: number;
  trip_days: number;
  sales_total: number;
  visits_total: number;
  worked_minutes_total: number;
};

export type MobileTimesheetResult = {
  month: string; // YYYY-MM
  employee: { id: number; fio: string; role: string; login: string; code: string | null };
  locked: boolean;
  days: MobileTimesheetDay[];
  totals: MobileTimesheetTotals;
};

function monthUtcBounds(month: string): { from: Date; to: Date } {
  const [yy, mm] = month.split("-").map((x) => Number.parseInt(x, 10));
  const from = new Date(Date.UTC(yy, mm - 1, 1, 0, 0, 0, 0));
  const to = new Date(Date.UTC(yy, mm, 1, 0, 0, 0, 0));
  return { from, to };
}

/** JS `getUTCDay()` (0=Вс) → ISO hafta kuni (1=Пн … 7=Вс). */
function isoWeekday(date: string): number {
  const dow = new Date(`${date}T00:00:00.000Z`).getUTCDay();
  return dow === 0 ? 7 : dow;
}

export async function getMobileAgentTimesheet(
  tenantId: number,
  userId: number,
  monthInput: string
): Promise<MobileTimesheetResult> {
  const month = monthInput.trim();
  if (!/^\d{4}-\d{2}$/.test(month)) throw new Error("BAD_MONTH");

  const matrix = await listTimesheetMatrix(tenantId, { month, user_id: userId });
  const row = matrix.rows[0];

  const { from, to } = monthUtcBounds(month);

  const [user, tenant, visits, orders] = await Promise.all([
    prisma.user.findFirst({
      where: { id: userId, tenant_id: tenantId },
      select: { id: true, name: true, role: true, login: true, code: true }
    }),
    prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { settings: true }
    }),
    prisma.agentVisit.findMany({
      where: {
        tenant_id: tenantId,
        agent_id: userId,
        checked_in_at: { gte: from, lt: to }
      },
      select: { checked_in_at: true, checked_out_at: true }
    }),
    prisma.order.findMany({
      where: {
        tenant_id: tenantId,
        agent_id: userId,
        order_type: { in: ["order", "return_by_order"] },
        created_at: { gte: from, lt: to }
      },
      select: { created_at: true, total_sum: true }
    })
  ]);

  const fio = user?.name ?? row?.fio ?? "";
  const auditByDate = groupTimesheetAuditByDate(readTabelAudit(tenant?.settings ?? null), fio);

  const visitsByDay = new Map<string, number>();
  const minutesByDay = new Map<string, number>();
  for (const v of visits) {
    const key = v.checked_in_at.toISOString().slice(0, 10);
    visitsByDay.set(key, (visitsByDay.get(key) ?? 0) + 1);
    if (v.checked_out_at) {
      const diffMs = v.checked_out_at.getTime() - v.checked_in_at.getTime();
      if (diffMs > 0) {
        minutesByDay.set(key, (minutesByDay.get(key) ?? 0) + Math.round(diffMs / 60_000));
      }
    }
  }

  const salesByDay = new Map<string, number>();
  for (const o of orders) {
    const key = o.created_at.toISOString().slice(0, 10);
    salesByDay.set(key, (salesByDay.get(key) ?? 0) + Number(o.total_sum ?? 0));
  }

  const totals: MobileTimesheetTotals = {
    days_in_month: matrix.days.length,
    worked_days: 0,
    active_days: 0,
    half_days: 0,
    absent_days: 0,
    holiday_days: 0,
    vacation_days: 0,
    sick_days: 0,
    trip_days: 0,
    sales_total: 0,
    visits_total: 0,
    worked_minutes_total: 0
  };

  // Web jadvalidagi kabi: kelajak kunlar «·» — status hisobiga kirmaydi.
  const today = new Date().toISOString().slice(0, 10);

  const cells = row?.cells ?? [];
  const days: MobileTimesheetDay[] = cells.map((c) => {
    const sales = salesByDay.get(c.date) ?? 0;
    const visitCount = visitsByDay.get(c.date) ?? 0;
    const minutes = minutesByDay.get(c.date) ?? 0;
    const countStatus = c.date <= today;

    if (countStatus) {
      totals.worked_days += statusWorkValue(c.status);
      switch (c.status) {
        case "worked":
          totals.active_days += 1;
          break;
        case "half_day":
          totals.half_days += 1;
          break;
        case "absent":
          totals.absent_days += 1;
          break;
        case "holiday":
          totals.holiday_days += 1;
          break;
        case "vacation":
          totals.vacation_days += 1;
          break;
        case "sick":
          totals.sick_days += 1;
          break;
        case "trip":
          totals.trip_days += 1;
          break;
      }
    }
    totals.sales_total += sales;
    totals.visits_total += visitCount;
    totals.worked_minutes_total += minutes;

    const history = auditByDate.get(c.date) ?? [];
    const latestComment = history.find((h) => h.comment)?.comment ?? null;

    return {
      day: c.day,
      date: c.date,
      weekday: isoWeekday(c.date),
      status: c.status,
      source: c.source,
      sales,
      visits: visitCount,
      worked_minutes: minutes,
      comment: latestComment,
      history
    };
  });

  return {
    month,
    employee: {
      id: userId,
      fio,
      role: user?.role ?? row?.role ?? "agent",
      login: user?.login ?? row?.login ?? "",
      code: user?.code ?? null
    },
    locked: matrix.locked,
    days,
    totals
  };
}

/** Web cellHistory: module=timesheet && title=fio && subtitle=date. */
function groupTimesheetAuditByDate(
  records: TabelAuditRecord[],
  fio: string
): Map<string, MobileTimesheetDayHistory[]> {
  const map = new Map<string, MobileTimesheetDayHistory[]>();
  if (!fio) return map;
  for (const a of records) {
    if (a.module !== "timesheet" || a.title !== fio || !a.subtitle) continue;
    const date = a.subtitle;
    const item: MobileTimesheetDayHistory = {
      id: a.id,
      old_value: a.oldValue ?? null,
      new_value: a.newValue ?? null,
      comment: a.comment ?? null,
      changed_by: a.changedBy,
      changed_at: a.changedAt
    };
    const list = map.get(date);
    if (list) list.push(item);
    else map.set(date, [item]);
  }
  return map;
}
