import { evaluateFormula, parseFormula } from "./payroll.formula-engine";
import { buildFormulaVars, type PayrollCalcInputs } from "./payroll.formula-vars";

export type CalcItem = {
  id: number;
  name: string;
  type: "allowance" | "deduction";
  system_key: string | null;
  /** «formula» — summa faqat formula uchun manba, to'g'ridan-to'g'ri to'lanmaydi. */
  calc_type?: string;
};

export type CalcFormula = {
  /** formula_id yoki biriktirma id — diagnostika uchun. */
  ref: string;
  text: string;
  target_item_id: number;
  kpi_group_id: number | null;
  priority: number;
};

export type KeptLine = {
  item_id: number;
  amount: number;
  source: string;
  corr_key: string;
  is_manual_override: boolean;
  correction_for_year?: number | null;
  correction_for_month?: number | null;
  note?: string | null;
};

export type CalcLine = {
  item_id: number;
  amount: number;
  source: string;
  corr_key: string;
  formula_snapshot: string | null;
  is_manual_override: boolean;
  correction_for_year: number | null;
  correction_for_month: number | null;
  note: string | null;
};

export type CalcResult = {
  base_salary: number;
  lines: CalcLine[];
  allowances_total: number;
  deductions_total: number;
  advances_total: number;
  gross: number;
  paid_total: number;
  salary_paid: number;
  balance: number;
  formula_values: Record<string, number>;
  warnings: string[];
  errors: string[];
};

const r2 = (x: number) => Math.round(x * 100) / 100;

/**
 * Bitta xodim-oy oyligi.
 * gross = oklad + Σнадбавки − Σудержания (Аванс kirmaydi);
 * balance = gross − (avanslar + oylik to'lovlari).
 */
export function computePayroll(input: {
  inputs: PayrollCalcInputs;
  items: Map<number, CalcItem>;
  salaryFormula: string | null;
  formulas: CalcFormula[];
  kept: KeptLine[];
  systemIds: { advance: number; correction: number; carry: number };
  carryAmount: number;
  salaryPaid: number;
}): CalcResult {
  const { inputs, items, systemIds } = input;
  const warnings = new Set<string>();
  const errors: string[] = [];
  const formulaValues: Record<string, number> = {};

  const lines = new Map<string, CalcLine>();
  const keyOf = (itemId: number, corr: string) => `${itemId}|${corr}`;
  const itemValues = new Map<string, number>();
  const bumpItem = (itemId: number, delta: number) => {
    const it = items.get(itemId);
    if (it) itemValues.set(it.name, r2((itemValues.get(it.name) ?? 0) + delta));
  };

  const overrideItems = new Set<number>();
  for (const k of input.kept) {
    if (!items.has(k.item_id)) continue;
    if (k.item_id === systemIds.advance || k.item_id === systemIds.carry) continue;
    lines.set(keyOf(k.item_id, k.corr_key), {
      item_id: k.item_id,
      amount: r2(k.amount),
      source: k.source,
      corr_key: k.corr_key,
      formula_snapshot: null,
      is_manual_override: k.is_manual_override,
      correction_for_year: k.correction_for_year ?? null,
      correction_for_month: k.correction_for_month ?? null,
      note: k.note ?? null
    });
    if (k.is_manual_override && k.corr_key === "") overrideItems.add(k.item_id);
    bumpItem(k.item_id, k.amount);
  }

  const formulaTargets = new Set(input.formulas.map((f) => f.target_item_id));
  for (const [itemId, amount] of inputs.item_parts ?? []) {
    const it = items.get(itemId);
    if (!it || it.system_key || it.type !== "allowance" || it.calc_type === "formula" || formulaTargets.has(itemId)) continue;
    if (lines.has(keyOf(itemId, "")) || !amount) continue;
    lines.set(keyOf(itemId, ""), {
      item_id: itemId,
      amount: r2(amount),
      source: "config",
      corr_key: "",
      formula_snapshot: null,
      is_manual_override: false,
      correction_for_year: null,
      correction_for_month: null,
      note: null
    });
    bumpItem(itemId, amount);
  }

  let baseSalary = inputs.base_salary;
  if (input.salaryFormula) {
    try {
      const vars = buildFormulaVars(inputs, null, itemValues, { allowances: 0, deductions: 0 }, items);
      const res = evaluateFormula(parseFormula(input.salaryFormula), vars);
      res.warnings.forEach((w) => warnings.add(`salary:${w}`));
      baseSalary = res.value;
    } catch (e) {
      errors.push(`Оклад: ${(e as Error).message}`);
    }
  }
  const baseInputs: PayrollCalcInputs = { ...inputs, base_salary: baseSalary };

  const sorted = [...input.formulas].sort((a, b) => a.priority - b.priority || a.ref.localeCompare(b.ref));
  const computedByItem = new Map<number, { amount: number; snapshots: string[] }>();
  for (const f of sorted) {
    const item = items.get(f.target_item_id);
    if (!item || item.system_key) continue;
    try {
      const totals = runningTotals(lines, items, systemIds.advance);
      const vars = buildFormulaVars(baseInputs, f.kpi_group_id, itemValues, totals, items, f.target_item_id);
      const res = evaluateFormula(parseFormula(f.text), vars);
      res.warnings.forEach((w) => warnings.add(`${f.ref}:${w}`));
      formulaValues[f.ref] = res.value;
      const acc = computedByItem.get(item.id) ?? { amount: 0, snapshots: [] };
      acc.amount = r2(acc.amount + res.value);
      acc.snapshots.push(f.text);
      computedByItem.set(item.id, acc);
      if (overrideItems.has(item.id)) continue;
      bumpItem(item.id, res.value);
      lines.set(keyOf(item.id, ""), {
        item_id: item.id,
        amount: acc.amount,
        source: f.kpi_group_id != null ? "kpi" : "formula",
        corr_key: "",
        formula_snapshot: acc.snapshots.join("\n"),
        is_manual_override: false,
        correction_for_year: null,
        correction_for_month: null,
        note: null
      });
    } catch (e) {
      errors.push(`${item.name}: ${(e as Error).message}`);
    }
  }
  for (const id of overrideItems) {
    const line = lines.get(keyOf(id, ""));
    const comp = computedByItem.get(id);
    if (line && comp) line.formula_snapshot = `computed=${comp.amount}\n${comp.snapshots.join("\n")}`;
  }

  if (input.carryAmount > 0 && items.has(systemIds.carry)) {
    lines.set(keyOf(systemIds.carry, ""), {
      item_id: systemIds.carry,
      amount: r2(input.carryAmount),
      source: "carry",
      corr_key: "",
      formula_snapshot: null,
      is_manual_override: false,
      correction_for_year: null,
      correction_for_month: null,
      note: "Остаток прошлого месяца"
    });
  }
  if (inputs.advances_paid > 0 && items.has(systemIds.advance)) {
    lines.set(keyOf(systemIds.advance, ""), {
      item_id: systemIds.advance,
      amount: r2(inputs.advances_paid),
      source: "advance",
      corr_key: "",
      formula_snapshot: null,
      is_manual_override: false,
      correction_for_year: null,
      correction_for_month: null,
      note: null
    });
  }

  const totals = runningTotals(lines, items, systemIds.advance);
  const gross = r2(baseSalary + totals.allowances - totals.deductions);
  const paidTotal = r2(inputs.advances_paid + input.salaryPaid);
  if (gross < 0) warnings.add("negative_gross");
  return {
    base_salary: r2(baseSalary),
    lines: [...lines.values()].filter((l) => l.amount !== 0 || l.is_manual_override || l.corr_key !== ""),
    allowances_total: totals.allowances,
    deductions_total: totals.deductions,
    advances_total: r2(inputs.advances_paid),
    gross,
    paid_total: paidTotal,
    salary_paid: r2(input.salaryPaid),
    balance: r2(gross - paidTotal),
    formula_values: formulaValues,
    warnings: [...warnings],
    errors
  };
}

/** Корректировка manfiy bo'lsa — udержания tomonida hisoblanadi (ishora saqlanadi, jami bir xil). */
function runningTotals(
  lines: Map<string, CalcLine>,
  items: Map<number, CalcItem>,
  advanceItemId: number
): { allowances: number; deductions: number } {
  let allowances = 0;
  let deductions = 0;
  for (const l of lines.values()) {
    if (l.item_id === advanceItemId) continue;
    const it = items.get(l.item_id);
    if (!it) continue;
    if (it.type === "allowance") allowances += l.amount;
    else deductions += l.amount;
  }
  return { allowances: r2(allowances), deductions: r2(deductions) };
}
