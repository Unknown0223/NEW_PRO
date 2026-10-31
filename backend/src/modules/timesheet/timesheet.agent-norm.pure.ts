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

/** Rahbar minusini qanday hisoblash. */
export type LeaderMinusMode = "per_agent" | "team_sum";

/**
 * Biriktirilgan agentlarning «0» kunlari rahbarga minus beradi.
 * `user_id` bo‘lsa — faqat shu akkaunt; bo‘lmasa — butun rol.
 */
export type LeaderMinusRule = {
  id: string;
  enabled: boolean;
  role: string;
  user_id: number | null;
  /** Nechta minus (0) bo‘lsa rahbarga bitta minus. */
  threshold: number;
  mode: LeaderMinusMode;
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
  leader_rules: LeaderMinusRule[];
};

export const DEFAULT_AGENT_NORM: AgentNormConfig = {
  enabled: true,
  start_date: "2026-10-01",
  open_amount: 1_000_000,
  closed_amount: 650_000,
  min_orders: 0,
  half_day_ratio: 0,
  overrides: [],
  leader_rules: []
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

export function parseLeaderMinusRules(raw: unknown): LeaderMinusRule[] {
  if (!Array.isArray(raw)) return [];
  const out: LeaderMinusRule[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    const o = asObj(item);
    const role = typeof o.role === "string" ? o.role.trim().toLowerCase() : "";
    if (!role || role.length > 40) continue;
    const threshold = nonNegInt(o.threshold, 0);
    if (threshold < 1 || threshold > 31) continue;
    const mode: LeaderMinusMode = o.mode === "team_sum" ? "team_sum" : "per_agent";
    const uidRaw = typeof o.user_id === "number" ? o.user_id : o.user_id == null || o.user_id === "" ? null : Number(o.user_id);
    const user_id = uidRaw != null && Number.isInteger(uidRaw) && uidRaw > 0 ? uidRaw : null;
    const idRaw = typeof o.id === "string" ? o.id.trim() : "";
    const id = (idRaw || `lr-${role}-${user_id ?? "role"}-${mode}-${threshold}`).slice(0, 40);
    const key = user_id != null ? `u:${user_id}` : `r:${role}`;
    if (seen.has(key) || seen.has(id)) continue;
    seen.add(key);
    seen.add(id);
    out.push({ id, enabled: o.enabled !== false, role, user_id, threshold, mode });
    if (out.length >= 50) break;
  }
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
    overrides: [],
    leader_rules: cfg.leader_rules
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
    overrides: parseAgentNormOverrides(raw.overrides),
    leader_rules: parseLeaderMinusRules(raw.leader_rules)
  };
}

function fmtRuYmd(ymd: string): string {
  const [y, m, d] = ymd.split("-");
  return `${d}.${m}.${y}`;
}

export function fmtPct(ratio: number): string {
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
  if (cfg.leader_rules.length > 0) extra.push(`минус руководителя: ${cfg.leader_rules.length}`);
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
  if (leaderRulesKey(prev.leader_rules) !== leaderRulesKey(next.leader_rules)) {
    out.push(`Минус руководителя: ${summarizeLeaderRules(prev.leader_rules)} → ${summarizeLeaderRules(next.leader_rules)}`);
  }
  return out;
}

function leaderRulesKey(list: LeaderMinusRule[]): string {
  return JSON.stringify(
    [...list]
      .map((r) => [r.role, r.user_id ?? 0, r.enabled, r.threshold, r.mode])
      .sort((a, b) => String(a[0]).localeCompare(String(b[0])) || Number(a[1]) - Number(b[1]))
  );
}

function summarizeLeaderRules(list: LeaderMinusRule[]): string {
  if (list.length === 0) return "нет";
  return list
    .map((r) => {
      const who = r.user_id != null ? `аккаунт ${r.user_id}` : `роль ${r.role}`;
      const how = r.mode === "team_sum" ? "сумма агентов" : "каждый агент";
      return `${r.enabled ? "вкл" : "выкл"} ${who}, ${how}, порог ${r.threshold}`;
    })
    .join("; ");
}


export function fmtSum(n: number): string {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

export type { AgentDaySales, ApplyAgentNormOptions, NormDay } from "./timesheet.agent-norm.apply";
export { agentDayNet, applyAgentNormToDays, consignmentOpenDays } from "./timesheet.agent-norm.apply";
