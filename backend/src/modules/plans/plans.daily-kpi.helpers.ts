import { prisma } from "../../config/database";
import type { WorkdaysState } from "../tabel/workdays.service";
import { executionPctFromPlanFact } from "./plans.monitoring-aggregates";
import { WORK_REGION_UTC_OFFSET_HOURS } from "../mobile/mobile-agent-sync.config.service";

export type DailyKpiDayStatus =
  | "done"
  | "over"
  | "warn"
  | "pending"
  | "off"
  | "no_plan";

/** Oy chegarasi ish mintaqasi (Asia/Tashkent) bo‘yicha: [1-kun 00:00, keyingi oy 1-kun 00:00). */
export function monthBounds(year: number, month: number): {
  start: Date;
  end: Date;
  daysInMonth: number;
} {
  const start = new Date(Date.UTC(year, month - 1, 1, -WORK_REGION_UTC_OFFSET_HOURS, 0, 0, 0));
  const end = new Date(Date.UTC(year, month, 1, -WORK_REGION_UTC_OFFSET_HOURS, 0, 0, 0));
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { start, end, daysInMonth };
}

export function routeAsOfKey(month: string, todayKey: string, daysInMonth: number): string {
  if (month === todayKey.slice(0, 7)) return todayKey;
  if (month < todayKey.slice(0, 7)) return `${month}-${String(daysInMonth).padStart(2, "0")}`;
  return `${month}-01`;
}

export function statusFromDay(opts: {
  hasPlans: boolean;
  todayPlan: number;
  todayFact: number;
  isWorkingToday: boolean;
}): DailyKpiDayStatus {
  if (!opts.hasPlans) return "no_plan";
  if (!opts.isWorkingToday) return "off";
  if (opts.todayPlan <= 0 && opts.todayFact <= 0) return "pending";
  if (opts.todayFact > opts.todayPlan && opts.todayPlan > 0) return "over";
  const pct = executionPctFromPlanFact(opts.todayPlan, opts.todayFact);
  if (pct != null && pct >= 100) return "done";
  if (opts.todayFact > 0) return "warn";
  return "pending";
}

export function sectionLinks(month: number, year: number, directionId: number | null) {
  const qs = new URLSearchParams({ month: String(month), year: String(year) });
  if (directionId != null) qs.set("direction_id", String(directionId));
  return {
    setup: `/plans/setup?${qs.toString()}`,
    workdays: "/users/workdays",
    kpi_groups: "/settings/sales-directions/kpi-groups",
    sales_monitoring: "/dashboard/sales-monitoring"
  };
}

/** Tenant settings yo‘q bo‘lganda — Пн–Сб default. */
export function fallbackWorkdaysState(): WorkdaysState {
  return {
    schedules: {
      Агент: [true, true, true, true, true, true, false],
      Кассир: [true, true, true, true, true, true, false],
      Менеджер: [true, true, true, true, true, true, false],
      Мерчендайзер: [true, true, true, true, true, true, false],
      Оператор: [true, true, true, true, true, true, false],
      Складчик: [true, true, true, true, true, true, false],
      Супервайзер: [true, true, true, true, true, false, false],
      Экспедитор: [true, true, true, true, true, true, false]
    },
    enforce_access: false,
    enforce_roles: [],
    exceptions: [],
    overrides: []
  };
}

/** Foydalanuvchi kartasidagi filial bo‘sh bo‘lsa — faol ish o‘rnidagi filial (bog‘lanish yoki slot kodi). */
export async function activeSlotBranchByUser(
  tenantId: number,
  users: Array<{ id: number; code: string | null }>
): Promise<Map<number, string>> {
  const out = new Map<number, string>();
  if (users.length === 0) return out;
  const ids = users.map((u) => u.id);
  const codes = users.map((u) => u.code?.trim()).filter((c): c is string => Boolean(c));
  const links = await prisma.slotUserLink.findMany({
    where: {
      ended_at: null,
      slot: { tenant_id: tenantId, deleted_at: null, is_active: true },
      OR: [
        { user_id: { in: ids } },
        ...(codes.length ? [{ slot: { slot_code: { in: codes } } }] : [])
      ]
    },
    select: { user_id: true, slot: { select: { slot_code: true, branch_code: true } } },
    orderBy: { started_at: "desc" }
  });
  const byCode = new Map<string, string>();
  for (const link of links) {
    const branch = link.slot.branch_code?.trim();
    if (!branch) continue;
    if (!out.has(link.user_id)) out.set(link.user_id, branch);
    const code = link.slot.slot_code.trim();
    if (!byCode.has(code)) byCode.set(code, branch);
  }
  for (const user of users) {
    if (out.has(user.id)) continue;
    const code = user.code?.trim();
    const branch = code ? byCode.get(code) : undefined;
    if (branch) out.set(user.id, branch);
  }
  return out;
}
