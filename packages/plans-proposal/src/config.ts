import type { Formula, ProposalConfig, ProposalRule, RuleScope } from "./types";
import { assertMoney, parseMoneyInput } from "./money";

export const EMPTY_SCOPE: RuleScope = {
  kind: "all",
  employeeIds: [],
  branchIds: [],
  supervisorIds: []
};

export const DEFAULT_CONFIG: ProposalConfig = {
  defaultFormula: { basis: "fact", mode: "percent", value: 10 },
  rules: [],
  overrides: {},
  excluded: [],
  settings: {
    sourceStatus: "approved_only",
    projection: { enabled: false, elapsedWorkingDays: 12, totalWorkingDays: 24 },
    roundingStep: "100000",
    growthWarningPercent: 50,
    outlierLookbackMonths: 3
  }
};

export function cloneConfig(config: ProposalConfig): ProposalConfig {
  return JSON.parse(JSON.stringify(config)) as ProposalConfig;
}

export function employeeKey(employeeId: number, workSlotId: number | null): string {
  return `${employeeId}:${workSlotId ?? 0}`;
}

export function validateFormula(formula: Formula): string | null {
  if (formula.basis !== "fact" && formula.basis !== "previous_plan") return "Noma’lum asos";
  if (formula.mode !== "percent" && formula.mode !== "amount") return "Noma’lum usul";
  if (!Number.isFinite(formula.value)) return "Qiymat son bo‘lishi kerak";
  if (formula.mode === "percent") {
    if (formula.value < -100 || formula.value > 1000) return "Foiz −100% dan +1000% gacha";
    if (!/^-?\d+(\.\d{1,2})?$/.test(String(formula.value)))
      return "Foizda ko‘pi bilan 2 kasr xonasi";
    return null;
  }
  try {
    if (Math.abs(formula.value) > 90_000_000_000) return "Summa juda katta";
    parseMoneyInput(String(formula.value));
    return null;
  } catch {
    return "Summada ko‘pi bilan 2 kasr xonasi";
  }
}

export function validateConfig(config: ProposalConfig): string | null {
  const base = validateFormula(config.defaultFormula);
  if (base) return base;
  const ids = new Set<string>();
  for (const rule of config.rules) {
    if (ids.has(rule.id)) return "Qoida identifikatori takrorlangan";
    ids.add(rule.id);
    if (!rule.name.trim() || rule.name.length > 120) return "Qoida nomi 1–120 belgi bo‘lishi kerak";
    const error = validateFormula(rule.formula);
    if (error) return `${rule.name}: ${error}`;
    if (rule.scope.kind === "employees" && rule.scope.employeeIds.length === 0) {
      return `${rule.name}: kamida bitta xodim tanlang`;
    }
  }
  for (const [key, formula] of Object.entries(config.cellFormulas ?? {})) {
    if (!/^\d+:\d+$/.test(key)) return "Noma’lum katak xodim kaliti";
    const error = validateFormula(formula);
    if (error) return `${key}: ${error}`;
  }
  for (const [key, manual] of Object.entries(config.overrides)) {
    if (!/^\d+:\d+$/.test(key)) return "Noma’lum xodim kaliti";
    try {
      if (assertMoney(manual.value) <= 0n) return "Qo‘lda kiritilgan reja musbat bo‘lishi kerak";
    } catch {
      return "Qo‘lda kiritilgan reja minor birlikda butun son bo‘lishi kerak";
    }
    if (!manual.reason.trim() || manual.reason.length > 2000)
      return `${key}: qo‘lda o‘zgartirish sababi 1–2000 belgi bo‘lishi kerak`;
  }
  const s = config.settings;
  try {
    if (BigInt(s.roundingStep) <= 0n) return "Yaxlitlash qadami musbat bo‘lishi kerak";
  } catch {
    return "Noto‘g‘ri yaxlitlash qadami";
  }
  const p = s.projection;
  if (
    !Number.isInteger(p.elapsedWorkingDays) ||
    !Number.isInteger(p.totalWorkingDays) ||
    p.elapsedWorkingDays < 0 ||
    p.totalWorkingDays < 1 ||
    p.totalWorkingDays > 31 ||
    p.elapsedWorkingDays > p.totalWorkingDays
  ) {
    return "Ish kunlari: 0 ≤ o‘tgan kunlar ≤ jami kunlar, jami ≥ 1";
  }
  if (
    !Number.isFinite(s.growthWarningPercent) ||
    s.growthWarningPercent < 0 ||
    s.growthWarningPercent > 1000
  )
    return "Ogohlantirish foizi 0–1000 oralig‘ida";
  if (s.sourceStatus !== "approved_only" && s.sourceStatus !== "official")
    return "Noma’lum reja maqomi";
  if (
    !Number.isInteger(s.outlierLookbackMonths) ||
    s.outlierLookbackMonths < 0 ||
    s.outlierLookbackMonths > 12
  )
    return "Tarix oylari 0–12 oralig‘ida";
  return null;
}

export function scopeMatches(
  scope: RuleScope,
  row: {
    employeeId: number;
    branchId: number;
    supervisorId: number | null;
    linked: boolean;
    active: boolean;
  }
): boolean {
  if (!row.linked || !row.active) return false;
  if (scope.kind === "employees" && !scope.employeeIds.includes(row.employeeId)) return false;
  if (scope.branchIds.length && !scope.branchIds.includes(row.branchId)) return false;
  if (
    scope.supervisorIds.length &&
    (row.supervisorId == null || !scope.supervisorIds.includes(row.supervisorId))
  )
    return false;
  return true;
}

export function resolveRule(
  rules: ProposalRule[],
  employee: Parameters<typeof scopeMatches>[1]
): ProposalRule | null {
  let winner: ProposalRule | null = null;
  for (const rule of rules) {
    if (rule.enabled && scopeMatches(rule.scope, employee)) winner = rule;
  }
  return winner;
}
