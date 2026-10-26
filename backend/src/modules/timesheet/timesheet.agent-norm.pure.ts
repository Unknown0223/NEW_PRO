import type { Prisma } from "@prisma/client";
import type { AttendanceSource, AttendanceStatus } from "./timesheet.service";

/**
 * Agent kunlik normasi (Табель avtomatikasi):
 * kunlik sof zakaz (zakazlar − otkaz − vozvrat) normaga yetsa — ishladi, yetmasa — kelmadi.
 * Norma konsignatsiya o‘sha kuni yoqilgan bo‘lsa `open_amount`, aks holda `closed_amount`.
 * Alohida agent override bo‘sh maydonlari umumiy qiymatni oladi.
 */
export type AgentNormOverride = {
  user_id: number;
  enabled?: boolean;
  start_date?: string;
  open_amount?: number;
  closed_amount?: number;
  min_orders?: number;
  half_day_ratio?: number;
};

export type AgentNormConfig = {
  enabled: boolean;
  start_date: string;
  open_amount: number;
  closed_amount: number;
  /** 0 — qo‘shimcha shart yo‘q; masalan 3 — kamida 3 ta zakaz. */
  min_orders: number;
  /** 0 — o‘chiq; 0.5 — norma 50% bo‘lsa yarim kun. */
  half_day_ratio: number;
  overrides: AgentNormOverride[];
};

export const DEFAULT_AGENT_NORM: AgentNormConfig = {
  enabled: true,
  start_date: "2026-10-01",
  open_amount: 1_000_000,
  closed_amount: 650_000,
  min_orders: 0,
  half_day_ratio: 0,
  overrides: []
};

function asObj(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function positiveNum(raw: unknown, fallback: number): number {
  const n = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : NaN;
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function nonNegInt(raw: unknown, fallback: number): number {
  const n = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : NaN;
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : fallback;
}

function ratio01(raw: unknown, fallback: number): number {
  const n = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : NaN;
  if (!Number.isFinite(n) || n < 0 || n > 1) return fallback;
  return n;
}

function ymdOrUndef(raw: unknown): string | undefined {
  return typeof raw === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : undefined;
}

function parseOneOverride(raw: unknown): AgentNormOverride | null {
  const o = asObj(raw);
  const user_id = typeof o.user_id === "number" ? o.user_id : Number(o.user_id);
  if (!Number.isInteger(user_id) || user_id <= 0) return null;
  const out: AgentNormOverride = { user_id };
  if (typeof o.enabled === "boolean") out.enabled = o.enabled;
  const start = ymdOrUndef(o.start_date);
  if (start) out.start_date = start;
  if (o.open_amount != null) out.open_amount = positiveNum(o.open_amount, 0) || undefined;
  if (o.closed_amount != null) out.closed_amount = positiveNum(o.closed_amount, 0) || undefined;
  if (o.min_orders != null) out.min_orders = nonNegInt(o.min_orders, 0);
  if (o.half_day_ratio != null) out.half_day_ratio = ratio01(o.half_day_ratio, 0);
  if (out.open_amount === undefined) delete out.open_amount;
  if (out.closed_amount === undefined) delete out.closed_amount;
  return out;
}

export function parseAgentNormOverrides(raw: unknown): AgentNormOverride[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<number>();
  const out: AgentNormOverride[] = [];
  for (const item of raw) {
    const o = parseOneOverride(item);
    if (!o || seen.has(o.user_id)) continue;
    seen.add(o.user_id);
    out.push(o);
  }
  return out;
}

/** Agent uchun amaldagi norma: override + umumiy. */
export function resolveAgentNormConfig(cfg: AgentNormConfig, userId: number): AgentNormConfig {
  const o = cfg.overrides.find((x) => x.user_id === userId);
  if (!o) return { ...cfg, overrides: [] };
  return {
    enabled: o.enabled ?? cfg.enabled,
    start_date: o.start_date ?? cfg.start_date,
    open_amount: o.open_amount ?? cfg.open_amount,
    closed_amount: o.closed_amount ?? cfg.closed_amount,
    min_orders: o.min_orders ?? cfg.min_orders,
    half_day_ratio: o.half_day_ratio ?? cfg.half_day_ratio,
    overrides: []
  };
}

/** Qaysi agentlarga savdo yuklash kerak (GPS/chiqarilganlar tashqarida). */
export function agentIdsForNormSales(cfg: AgentNormConfig, trackedIds: number[]): number[] {
  if (cfg.enabled) {
    const skip = new Set(cfg.overrides.filter((o) => o.enabled === false).map((o) => o.user_id));
    return trackedIds.filter((id) => !skip.has(id));
  }
  const keep = new Set(cfg.overrides.filter((o) => o.enabled === true).map((o) => o.user_id));
  return trackedIds.filter((id) => keep.has(id));
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
    closed_amount: positiveNum(raw.closed_amount, DEFAULT_AGENT_NORM.closed_amount),
    min_orders: nonNegInt(raw.min_orders, DEFAULT_AGENT_NORM.min_orders),
    half_day_ratio: ratio01(raw.half_day_ratio, DEFAULT_AGENT_NORM.half_day_ratio),
    overrides: parseAgentNormOverrides(raw.overrides)
  };
}

function fmtRuYmd(ymd: string): string {
  const [y, m, d] = ymd.split("-");
  return `${d}.${m}.${y}`;
}

function fmtPct(ratio: number): string {
  return ratio > 0 ? `${Math.round(ratio * 100)}%` : "выкл";
}

function summarizeOverrides(list: AgentNormOverride[]): string {
  return list.length === 0 ? "нет" : `${list.length} агент(ов)`;
}

function overridesKey(list: AgentNormOverride[]): string {
  return JSON.stringify(
    [...list]
      .map((o) => [
        o.user_id,
        o.enabled ?? null,
        o.start_date ?? "",
        o.open_amount ?? 0,
        o.closed_amount ?? 0,
        o.min_orders ?? 0,
        o.half_day_ratio ?? 0
      ])
      .sort((a, b) => Number(a[0]) - Number(b[0]))
  );
}

/** Sozlamalar tarixidagi qisqa ko‘rinish. */
export function summarizeAgentNorm(cfg: AgentNormConfig): string {
  if (!cfg.enabled && cfg.overrides.every((o) => o.enabled !== true)) return "Выключено";
  const extra: string[] = [];
  if (cfg.min_orders > 0) extra.push(`мин. ${cfg.min_orders} зак.`);
  if (cfg.half_day_ratio > 0) extra.push(`полдня от ${fmtPct(cfg.half_day_ratio)}`);
  if (cfg.overrides.length > 0) extra.push(`особые: ${summarizeOverrides(cfg.overrides)}`);
  const base = `Включено с ${fmtRuYmd(cfg.start_date)} · открыта ${fmtSum(cfg.open_amount)} · закрыта ${fmtSum(cfg.closed_amount)} сум`;
  return extra.length ? `${base} · ${extra.join(" · ")}` : base;
}

/** «Nima nimaga o‘zgardi» — tarix izohi uchun. */
export function describeAgentNormChanges(prev: AgentNormConfig, next: AgentNormConfig): string[] {
  const out: string[] = [];
  if (prev.enabled !== next.enabled) {
    out.push(`Расчёт по нормативу: ${prev.enabled ? "включён" : "выключен"} → ${next.enabled ? "включён" : "выключен"}`);
  }
  if (prev.start_date !== next.start_date) {
    out.push(`Дата начала: ${fmtRuYmd(prev.start_date)} → ${fmtRuYmd(next.start_date)}`);
  }
  if (prev.open_amount !== next.open_amount) {
    out.push(`Норма при открытой консигнации: ${fmtSum(prev.open_amount)} → ${fmtSum(next.open_amount)} сум`);
  }
  if (prev.closed_amount !== next.closed_amount) {
    out.push(`Норма при закрытой консигнации: ${fmtSum(prev.closed_amount)} → ${fmtSum(next.closed_amount)} сум`);
  }
  if (prev.min_orders !== next.min_orders) {
    out.push(`Минимум заказов за день: ${prev.min_orders} → ${next.min_orders}`);
  }
  if (prev.half_day_ratio !== next.half_day_ratio) {
    out.push(`Порог полдня: ${fmtPct(prev.half_day_ratio)} → ${fmtPct(next.half_day_ratio)}`);
  }
  if (overridesKey(prev.overrides) !== overridesKey(next.overrides)) {
    out.push(`Особые условия агентов: ${summarizeOverrides(prev.overrides)} → ${summarizeOverrides(next.overrides)}`);
  }
  return out;
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
