import type { Prisma } from "@prisma/client";
import type { AttendanceSource, AttendanceStatus } from "./timesheet.service";

/**
 * Agent kunlik normasi (Табель avtomatikasi):
 * kunlik sof zakaz (zakazlar − otkaz − vozvrat) normaga yetsa — ishladi, yetmasa — kelmadi.
 * Norma konsignatsiya o‘sha kuni yoqilgan bo‘lsa `open_amount`, aks holda `closed_amount`.
 */
export type AgentNormConfig = {
  enabled: boolean;
  start_date: string;
  open_amount: number;
  closed_amount: number;
};

export const DEFAULT_AGENT_NORM: AgentNormConfig = {
  enabled: true,
  start_date: "2026-10-01",
  open_amount: 1_000_000,
  closed_amount: 650_000
};

function asObj(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function positiveNum(raw: unknown, fallback: number): number {
  const n = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : NaN;
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** `tenant.settings.timesheet.agent_norm` — bo‘lmasa standart qiymatlar. */
export function parseAgentNormConfig(settings: Prisma.JsonValue | null | undefined): AgentNormConfig {
  const raw = asObj(asObj(asObj(settings).timesheet).agent_norm);
  const start = typeof raw.start_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw.start_date)
    ? raw.start_date
    : DEFAULT_AGENT_NORM.start_date;
  return {
    enabled: raw.enabled !== false,
    start_date: start,
    open_amount: positiveNum(raw.open_amount, DEFAULT_AGENT_NORM.open_amount),
    closed_amount: positiveNum(raw.closed_amount, DEFAULT_AGENT_NORM.closed_amount)
  };
}

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

export function fmtSum(n: number): string {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
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

/** Agent oyi kunlariga normani qo‘llaydi (joyida o‘zgartiradi). */
export function applyAgentNormToDays(days: NormDay[], o: ApplyAgentNormOptions): void {
  if (!o.cfg.enabled) return;
  const weekendMet: NormDay[] = [];
  for (const d of days) {
    if (d.manual || d.off_employment || d.date < o.cfg.start_date || d.date > o.today) continue;
    const open = o.consignmentOpen(d.date);
    const norm = open ? o.cfg.open_amount : o.cfg.closed_amount;
    const s = o.sales(d.date);
    const net = agentDayNet(s);
    const met = s != null && s.orders > 0 && net >= norm;
    const info = `${salesPart(s)}, ${normPart(norm, open)}`;
    const todayNote = d.date === o.today ? " День ещё не завершён." : "";
    d.net_sales = net;
    d.norm = norm;
    d.source = "auto";
    if (o.isWorkingDay(d.date)) {
      if (met) {
        d.status = "worked";
        d.comment = `Норма выполнена: ${info}.`;
      } else {
        d.status = "absent";
        d.comment = `Норма не выполнена: ${info}, не хватает ${fmtSum(norm - net)} сум. Фикса за день не начисляется.${todayNote}`;
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
