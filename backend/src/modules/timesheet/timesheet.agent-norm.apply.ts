import type { AttendanceSource, AttendanceStatus } from "./timesheet.service";
import { fmtPct, fmtSum, type AgentNormConfig } from "./timesheet.agent-norm.pure";

export type AgentDaySales = {
  /** Shu kuni olingan barcha zakazlar summasi. */
  gross: number;
  /** Bekor qilingan (otkaz) zakazlar summasi. */
  refused: number;
  /** To‘liq yoki qisman qaytarilgan (vozvrat) summa. */
  returned: number;
  orders: number;
};

export function agentDayNet(s: AgentDaySales | undefined): number {
  if (!s) return 0;
  return Math.max(0, s.gross - s.refused - s.returned);
}


function salesPart(s: AgentDaySales | undefined): string {
  if (!s || s.orders === 0) return "заказов нет";
  const net = agentDayNet(s);
  if (s.refused <= 0 && s.returned <= 0) return `заказы ${fmtSum(net)} сум`;
  const parts = [`заказы ${fmtSum(s.gross)}`];
  if (s.refused > 0) parts.push(`отказ ${fmtSum(s.refused)}`);
  if (s.returned > 0) parts.push(`возврат ${fmtSum(s.returned)}`);
  return `${parts.join(" − ")} = ${fmtSum(net)} сум`;
}

function normPart(norm: number, consignmentOpen: boolean): string {
  return `норма ${fmtSum(norm)} сум (консигнация ${consignmentOpen ? "открыта" : "закрыта"})`;
}

export type NormDay = {
  date: string;
  status: AttendanceStatus;
  source: AttendanceSource;
  /** Qo‘lda belgilangan kun — avtomatika tegmaydi. */
  manual: boolean;
  off_employment?: boolean;
  comment?: string;
  net_sales?: number;
  norm?: number;
};

export type ApplyAgentNormOptions = {
  cfg: AgentNormConfig;
  /** Tenant mahalliy bugungi sana — undan keyingi kunlar hisoblanmaydi. */
  today: string;
  isWorkingDay: (ymd: string) => boolean;
  /** Oydagi grafik bo‘yicha ish kunlari soni — dam olish kunlari shu songacha qo‘shiladi. */
  planDays: number;
  sales: (ymd: string) => AgentDaySales | undefined;
  consignmentOpen: (ymd: string) => boolean;
};

function statusValue(status: AttendanceStatus): number {
  if (status === "worked") return 1;
  if (status === "half_day") return 0.5;
  return 0;
}

function dayQualifies(s: AgentDaySales | undefined, threshold: number, minOrders: number): boolean {
  if (s == null || s.orders === 0) return false;
  if (minOrders > 0 && s.orders < minOrders) return false;
  return agentDayNet(s) >= threshold;
}

function extraFailNote(s: AgentDaySales | undefined, minOrders: number): string {
  if (minOrders > 0 && (s == null || s.orders < minOrders)) {
    return ` Нужно минимум ${minOrders} заказ(ов).`;
  }
  return "";
}

/** Agent oyi kunlariga normani qo‘llaydi (joyida o‘zgartiradi). */
export function applyAgentNormToDays(days: NormDay[], o: ApplyAgentNormOptions): void {
  if (!o.cfg.enabled) return;
  const minOrders = o.cfg.min_orders;
  const halfRatio = o.cfg.half_day_ratio;
  const weekendMet: NormDay[] = [];
  for (const d of days) {
    if (d.manual || d.off_employment || d.date < o.cfg.start_date || d.date > o.today) continue;
    const open = o.consignmentOpen(d.date);
    const norm = open ? o.cfg.open_amount : o.cfg.closed_amount;
    const s = o.sales(d.date);
    const net = agentDayNet(s);
    const met = dayQualifies(s, norm, minOrders);
    const half = !met && halfRatio > 0 && dayQualifies(s, norm * halfRatio, minOrders);
    const info = `${salesPart(s)}, ${normPart(norm, open)}`;
    const todayNote = d.date === o.today ? " День ещё не завершён." : "";
    d.net_sales = net;
    d.norm = norm;
    d.source = "auto";
    if (o.isWorkingDay(d.date)) {
      if (met) {
        d.status = "worked";
        d.comment = `Норма выполнена: ${info}.`;
      } else if (half) {
        d.status = "half_day";
        d.comment = `Норма выполнена частично (полдня от ${fmtPct(halfRatio)}): ${info}.`;
      } else {
        d.status = "absent";
        d.comment = `Норма не выполнена: ${info}, не хватает ${fmtSum(Math.max(0, norm - net))} сум.${extraFailNote(s, minOrders)} Фикса за день не начисляется.${todayNote}`;
      }
      continue;
    }
    if (met) {
      d.status = "worked";
      d.comment = `Выходной день, норма выполнена: ${info}.`;
      weekendMet.push(d);
    } else {
      d.status = "holiday";
      d.comment = s && s.orders > 0 ? `Выходной день: ${info} — норма не выполнена.` : "Выходной день.";
    }
  }
  if (weekendMet.length === 0) return;

  const weekendSet = new Set(weekendMet);
  let total = 0;
  for (const d of days) if (d.date <= o.today && !weekendSet.has(d)) total += statusValue(d.status);
  for (const d of weekendMet) {
    if (total + 1 <= o.planDays) {
      total += 1;
      d.comment = `${d.comment} Засчитан как рабочий день.`;
      continue;
    }
    d.status = "holiday";
    d.comment = `${d.comment} Не засчитан: рабочих дней в месяце ${o.planDays}, лимит уже набран.`;
  }
}

/**
 * Konsignatsiya tarixidan kun bo‘yicha holat: kun davomida biror payt yoqilgan bo‘lsa — ochiq.
 * `logs` — `changed_at` bo‘yicha o‘sish tartibida, `ymd` tenant mahalliy sanasi.
 */
export function consignmentOpenDays(
  logs: Array<{ ymd: string; enabled: boolean }>,
  days: string[],
  fallback: boolean
): Set<string> {
  const out = new Set<string>();
  if (days.length === 0) return out;
  if (logs.length === 0) {
    if (fallback) for (const d of days) out.add(d);
    return out;
  }
  let i = 0;
  let state = !logs[0]!.enabled;
  for (const day of days) {
    while (i < logs.length && logs[i]!.ymd < day) state = logs[i++]!.enabled;
    let open = state;
    while (i < logs.length && logs[i]!.ymd === day) {
      state = logs[i++]!.enabled;
      if (state) open = true;
    }
    if (open) out.add(day);
  }
  return out;
}
