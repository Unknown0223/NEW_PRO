import type { CalcItem, CalcLine } from "./payroll.calc.pure";
import { evaluateFormula, normalizeVarName, parseFormula } from "./payroll.formula-engine";
import { buildFormulaVars, VAR_ITEM_AMOUNT, type PayrollCalcInputs } from "./payroll.formula-vars";
import {
  allPass,
  evaluateBase,
  evaluateSimpleRule,
  formulaItemAmount,
  type RuleOutcome,
  type SchemeEnv
} from "./payroll.scheme.pure";
import type { EmployeeAttrs, Explain, SchemeRule } from "./payroll.scheme.types";

export type SchemeCalcInput = {
  scheme_id: number;
  rules: SchemeRule[];
  attrs: EmployeeAttrs;
  overrides: Map<string, number>;
  groupNames: Map<number, string>;
};

export type CalcState = {
  inputs: PayrollCalcInputs;
  items: Map<number, CalcItem>;
  lines: Map<string, CalcLine>;
  itemValues: Map<string, number>;
  bumpItem: (itemId: number, delta: number) => void;
  overrideItems: Set<number>;
  warnings: Set<string>;
  errors: string[];
  formulaValues: Record<string, number>;
  totals: () => { allowances: number; deductions: number };
};

const r2 = (x: number) => Math.round(x * 100) / 100;

/**
 * Sxema qoidalari tartib bilan: oklad (base) → qolganlari `sort` bo'yicha.
 * Qo'lda o'zgartirilgan statyada summa saqlanadi, hisob faqat izohga yoziladi.
 */
export function applySchemeRules(scheme: SchemeCalcInput, st: CalcState): { base_salary: number; base_full: number; base_explain: Explain | null } {
  const env0: SchemeEnv = { inputs: st.inputs, attrs: scheme.attrs, overrides: scheme.overrides, groupNames: scheme.groupNames };
  const baseRule = scheme.rules.find((r): r is Extract<SchemeRule, { kind: "base" }> => r.kind === "base");
  const base = baseRule ? evaluateBase(baseRule, env0) : { base_full: 0, base_salary: 0, explain: null };

  const parts = new Map<number, number>();
  for (const r of scheme.rules) {
    if (r.kind === "fixed") parts.set(r.item_id, scheme.overrides.get(r.code) ?? r.params.amount);
    if (r.kind === "formula") parts.set(r.item_id, formulaItemAmount(r, env0));
  }
  const inputs: PayrollCalcInputs = { ...st.inputs, base_full: base.base_full, base_salary: base.base_salary, item_parts: parts };
  const env: SchemeEnv = { ...env0, inputs };

  for (const rule of scheme.rules) {
    if (rule.kind === "base" || rule.kind === "manual") continue;
    const item = st.items.get(rule.item_id);
    if (!item || item.system_key) continue;
    try {
      let out: RuleOutcome;
      if (rule.kind === "formula") {
        if (!allPass(rule.params.when, env)) {
          out = { amount: 0, explain: { text: "Условие не выполнено" }, warnings: [] };
        } else {
          const vars = buildFormulaVars(inputs, null, st.itemValues, st.totals(), st.items, rule.item_id);
          vars.set(normalizeVarName(VAR_ITEM_AMOUNT), formulaItemAmount(rule, env));
          const res = evaluateFormula(parseFormula(rule.params.text), vars);
          out = { amount: res.value, explain: { text: rule.params.text }, warnings: res.warnings.map((w) => `${rule.code}:${w}`) };
        }
      } else {
        out = evaluateSimpleRule(rule, env) ?? { amount: 0, explain: { text: "" }, warnings: [] };
      }
      out.warnings.forEach((w) => st.warnings.add(w));
      st.formulaValues[`rule:${rule.code}`] = out.amount;
      const key = `${item.id}|`;
      const prev = st.lines.get(key);
      if (st.overrideItems.has(item.id)) {
        if (prev) prev.explain = { ...out.explain, notes: [...(out.explain.notes ?? []), `по расчёту ${out.amount}`] };
        continue;
      }
      const stacked = prev?.source === "scheme";
      st.bumpItem(item.id, out.amount);
      st.lines.set(key, {
        item_id: item.id,
        amount: r2((stacked ? prev!.amount : 0) + out.amount),
        source: "scheme",
        corr_key: "",
        formula_snapshot: rule.kind === "formula" ? rule.params.text : null,
        is_manual_override: false,
        correction_for_year: null,
        correction_for_month: null,
        note: null,
        explain: stacked ? { text: `${prev!.explain?.text ?? ""} + ${rule.name}`, parts: [...(prev!.explain?.parts ?? []), ...(out.explain.parts ?? [])] } : out.explain
      });
    } catch (e) {
      st.errors.push(`${rule.name}: ${(e as Error).message}`);
    }
  }
  return { base_salary: base.base_salary, base_full: base.base_full, base_explain: base.explain };
}
