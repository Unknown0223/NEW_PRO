import { prisma } from "../../config/database";
import { computePayroll, type KeptLine } from "./payroll.calc.pure";
import { buildSchemeInput, loadPayrollCalcContext, loadPayrollUser } from "./payroll.calc-context";
import { loadPayrollInputs } from "./payroll.inputs";
import { PayrollError } from "./payroll.route-helpers";
import { pickScheme } from "./payroll.scheme-select.pure";
import { ymInt } from "./payroll.scheme.types";
import { validateRules, type SchemeBody } from "./payroll.schemes.service";

/** Saqlanmagan sxemani real xodim-oy ma'lumotlarida hisoblaydi (yozmaydi). */
export async function previewPayrollScheme(
  tenantId: number,
  input: { rules: SchemeBody["rules"]; user_id: number; year: number; month: number }
) {
  const rules = await validateRules(tenantId, input.rules);
  const user = await loadPayrollUser(tenantId, input.user_id);
  if (!user) throw new PayrollError("BAD_USER");
  const ctx = await loadPayrollCalcContext(tenantId);
  const [loaded, rec] = await Promise.all([
    loadPayrollInputs(tenantId, user, input.year, input.month, ctx.env, ctx.productGroups),
    prisma.payrollRecord.findUnique({
      where: { tenant_id_user_id_year_month: { tenant_id: tenantId, user_id: user.id, year: input.year, month: input.month } },
      include: { lines: true }
    })
  ]);
  const kept: KeptLine[] = (rec?.lines ?? [])
    .filter((l) => l.source === "manual" || l.is_manual_override)
    .map((l) => ({ item_id: l.item_id, amount: Number(l.amount), source: l.source, corr_key: l.corr_key, is_manual_override: l.is_manual_override, note: l.note }));
  const res = computePayroll({
    inputs: loaded.inputs,
    items: ctx.items,
    salaryFormula: null,
    formulas: [],
    kept,
    systemIds: ctx.systemIds,
    carryAmount: 0,
    salaryPaid: 0,
    scheme: await buildSchemeInput(ctx, user, input.year, input.month, 0, rules)
  });
  const inp = loaded.inputs;
  return {
    base_salary: res.base_salary,
    base_explain: res.base_explain,
    lines: res.lines
      .filter((l) => l.corr_key === "" && !Object.values(ctx.systemIds).includes(l.item_id))
      .map((l) => {
        const it = ctx.items.get(l.item_id);
        return { item_id: l.item_id, name: it?.name ?? `#${l.item_id}`, type: it?.type ?? "allowance", amount: l.amount, source: l.source, explain: l.explain ?? null };
      }),
    allowances_total: res.allowances_total,
    deductions_total: res.deductions_total,
    gross: res.gross,
    current_gross: rec?.calculated_at ? Number(rec.gross) : null,
    warnings: [...res.warnings, ...loaded.plan_meta.warnings],
    errors: res.errors,
    facts: {
      plan_days: inp.plan_days,
      worked_days: inp.worked_days,
      sales_sum: inp.fact_total.cost,
      plan_sum: inp.plan_total.cost,
      acb: inp.fact_total.acb,
      returned_sum: inp.returned_sum
    }
  };
}

/** Oy uchun: har bir xodimga qaysi sxema tushadi (yoki eski rol sozlamasi). */
export async function listSchemeMatches(tenantId: number, year: number, month: number) {
  const ctx = await loadPayrollCalcContext(tenantId);
  const users = await prisma.user.findMany({
    where: { tenant_id: tenantId, role: { not: "admin" }, is_active: true },
    select: {
      id: true,
      name: true,
      role: true,
      position: true,
      branch: true,
      trade_direction_id: true,
      branch_links: { select: { branch_code: true }, take: 1 }
    },
    orderBy: [{ role: "asc" }, { name: "asc" }]
  });
  const ym = ymInt(year, month);
  return users.map((u) => {
    const target = {
      role: u.role,
      branch: u.branch?.trim() || u.branch_links[0]?.branch_code?.trim() || null,
      trade_direction_id: u.trade_direction_id,
      position: u.position
    };
    const s = pickScheme(ctx.schemes, target, ym);
    return { user_id: u.id, name: u.name, ...target, scheme_id: s?.id ?? null, scheme_name: s?.name ?? null, scheme_errors: s?.errors ?? [] };
  });
}
