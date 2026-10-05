import { prisma } from "../../config/database";
import type { CalcFormula, CalcItem } from "./payroll.calc.pure";
import type { SchemeCalcInput } from "./payroll.calc-scheme.pure";
import { activeOverrides, pickScheme, type SchemeSelector } from "./payroll.scheme-select.pure";
import { tenureMonths } from "./payroll.scheme.pure";
import { parseSchemeRule, ymInt, type SchemeRule } from "./payroll.scheme.types";
import { getSystemItemIds } from "./payroll.settings";
import { loadTenantPayrollEnv, type PayrollUserSnapshot, type TenantPayrollEnv } from "./payroll.inputs";
import { loadProductGroups } from "./payroll-kpi-fact";

type FormulaRow = {
  id: number;
  scope: string;
  text: string;
  role: string | null;
  target_item_id: number | null;
  priority: number;
};

export type PayrollCalcContext = {
  tenantId: number;
  env: TenantPayrollEnv;
  items: Map<number, CalcItem>;
  systemIds: { advance: number; correction: number; carry: number };
  formulas: FormulaRow[];
  formulaById: Map<number, FormulaRow>;
  productGroups: Map<number, number[]>;
  schemes: LoadedScheme[];
  groupNames: Map<number, string>;
};

export type LoadedScheme = SchemeSelector & { name: string; rules: SchemeRule[]; errors: string[] };

async function loadSchemes(tenantId: number): Promise<LoadedScheme[]> {
  const rows = await prisma.payrollScheme.findMany({
    where: { tenant_id: tenantId, is_active: true },
    include: { rules: { orderBy: [{ sort: "asc" }, { id: "asc" }] } }
  });
  return rows.map((s) => {
    const rules: SchemeRule[] = [];
    const errors: string[] = [];
    for (const r of s.rules) {
      const p = parseSchemeRule(r);
      if ("error" in p) errors.push(p.error);
      else rules.push(p);
    }
    return { ...s, rules, errors };
  });
}

export async function loadPayrollCalcContext(tenantId: number): Promise<PayrollCalcContext> {
  const [env, itemRows, systemIds, formulas, productGroups, schemes, groups] = await Promise.all([
    loadTenantPayrollEnv(tenantId),
    prisma.payrollItem.findMany({
      where: { tenant_id: tenantId },
      select: { id: true, name: true, type: true, system_key: true, calc_type: true, is_active: true }
    }),
    getSystemItemIds(tenantId),
    prisma.payrollFormula.findMany({
      where: { tenant_id: tenantId, is_active: true },
      select: { id: true, scope: true, text: true, role: true, target_item_id: true, priority: true }
    }),
    loadProductGroups(tenantId),
    loadSchemes(tenantId),
    prisma.kpiGroup.findMany({ where: { tenant_id: tenantId }, select: { id: true, name: true } })
  ]);
  const items = new Map<number, CalcItem>();
  for (const r of itemRows) {
    items.set(r.id, {
      id: r.id,
      name: r.name,
      type: r.type === "deduction" ? "deduction" : "allowance",
      system_key: r.system_key,
      calc_type: r.calc_type
    });
  }
  return {
    tenantId,
    env,
    items,
    systemIds,
    formulas,
    formulaById: new Map(formulas.map((f) => [f.id, f])),
    productGroups,
    schemes,
    groupNames: new Map(groups.map((g) => [g.id, g.name]))
  };
}

/** Xodimga mos sxema (bo'lmasa null — eski rol/formula yo'li). Sxemada xato bo'lsa — `errors`. */
export async function resolveUserScheme(
  ctx: PayrollCalcContext,
  user: PayrollUserSnapshot,
  year: number,
  month: number
): Promise<{ scheme: SchemeCalcInput; errors: string[] } | null> {
  const ym = ymInt(year, month);
  const s = pickScheme(ctx.schemes, user, ym);
  if (!s) return null;
  const rows = await prisma.payrollSchemeOverride.findMany({
    where: { tenant_id: ctx.tenantId, user_id: user.id },
    select: { rule_code: true, amount: true, valid_from: true, valid_to: true }
  });
  return {
    scheme: {
      scheme_id: s.id,
      rules: s.rules,
      attrs: {
        branch: user.branch,
        trade_direction_id: user.trade_direction_id,
        position: user.position,
        tenure_months: tenureMonths(user.hired_at, year, month)
      },
      overrides: activeOverrides(rows.map((r) => ({ ...r, amount: Number(r.amount) })), ym),
      groupNames: ctx.groupNames
    },
    errors: s.errors
  };
}

/** Xodimga qo'llanadigan formulalar: rol formulalari + shu oy bonus biriktirmalari. */
export async function resolveUserFormulas(
  ctx: PayrollCalcContext,
  user: PayrollUserSnapshot,
  year: number,
  month: number
): Promise<{ salaryFormula: string | null; formulas: CalcFormula[] }> {
  const role = user.role;
  const salary = ctx.formulas
    .filter((f) => f.scope === "salary" && f.role === role)
    .sort((a, b) => a.priority - b.priority)[0];
  const out: CalcFormula[] = ctx.formulas
    .filter((f) => f.scope !== "salary" && f.role === role && f.target_item_id != null)
    .map((f) => ({
      ref: `formula:${f.id}`,
      text: f.text,
      target_item_id: f.target_item_id!,
      kpi_group_id: null,
      priority: f.priority
    }));
  const assignments = await prisma.payrollBonusAssignment.findMany({
    where: { tenant_id: ctx.tenantId, user_id: user.id, year, month },
    select: { id: true, kpi_group_id: true, trade_direction_id: true, formula_id: true, formula_text_snapshot: true, target_item_id: true }
  });
  for (const a of assignments) {
    if (a.trade_direction_id !== 0 && user.trade_direction_id != null && a.trade_direction_id !== user.trade_direction_id) continue;
    out.push({
      ref: `bonus:${a.id}`,
      text: a.formula_text_snapshot,
      target_item_id: a.target_item_id,
      kpi_group_id: a.kpi_group_id > 0 ? a.kpi_group_id : null,
      priority: ctx.formulaById.get(a.formula_id)?.priority ?? 100
    });
  }
  return { salaryFormula: salary?.text ?? null, formulas: out };
}

export async function loadPayrollUser(tenantId: number, userId: number): Promise<PayrollUserSnapshot | null> {
  const u = await prisma.user.findFirst({
    where: { id: userId, tenant_id: tenantId },
    select: {
      id: true,
      role: true,
      position: true,
      branch: true,
      trade_direction_id: true,
      is_active: true,
      hired_at: true,
      dismissed_at: true,
      branch_links: { select: { branch_code: true }, take: 1 }
    }
  });
  if (!u) return null;
  return {
    id: u.id,
    role: u.role,
    position: u.position,
    branch: u.branch?.trim() || u.branch_links[0]?.branch_code?.trim() || null,
    trade_direction_id: u.trade_direction_id,
    is_active: u.is_active,
    hired_at: u.hired_at,
    dismissed_at: u.dismissed_at
  };
}
