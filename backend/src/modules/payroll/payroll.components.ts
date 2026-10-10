/**
 * ЗАРПЛАТА — ustama va ushlanmalar (formula `components`).
 *
 * `mode`:
 *  - `fixed`        → qat’iy summa (so‘m)
 *  - `percent_base` → okladga nisbatan foiz
 *  - `percent_gross`→ hisoblangan sumaga (oklad + o‘zgaruvchan) nisbatan foiz
 *
 * Komponentlar doim qo‘llanadi (shartlar/gates faqat o‘zgaruvchan qismga ta’sir qiladi).
 * Shartli ustama kerak bo‘lsa, uni `gates` orqali `reduce_percent` bilan bog‘lang.
 */
import { percentOf, round2 } from "./payroll.money";
import type { PayrollBreakdownLine, PayrollComponent } from "./payroll.types";

export type ComponentResult = {
  allowance: number;
  deduction: number;
  lines: PayrollBreakdownLine[];
};

export const EMPTY_COMPONENT_RESULT: ComponentResult = { allowance: 0, deduction: 0, lines: [] };

export function applyComponents(
  components: PayrollComponent[] | null | undefined,
  ctx: { base: number; gross: number }
): ComponentResult {
  if (!components || components.length === 0) return EMPTY_COMPONENT_RESULT;

  let allowance = 0;
  let deduction = 0;
  const lines: PayrollBreakdownLine[] = [];

  for (const c of components) {
    const value = Number.isFinite(c.value) ? c.value : 0;
    let amount = 0;
    if (c.mode === "percent_base") amount = percentOf(ctx.base, value);
    else if (c.mode === "percent_gross") amount = percentOf(ctx.gross, value);
    else amount = round2(value);

    if (amount === 0) continue;

    if (c.kind === "deduction") {
      deduction += amount;
      lines.push({
        code: c.code || `deduction_${lines.length}`,
        label: c.label || "Удержание",
        amount: -Math.abs(amount),
        note: describeComponent(c, value)
      });
    } else {
      allowance += amount;
      lines.push({
        code: c.code || `allowance_${lines.length}`,
        label: c.label || "Надбавка",
        amount: Math.abs(amount),
        note: describeComponent(c, value)
      });
    }
  }

  return { allowance: round2(allowance), deduction: round2(deduction), lines };
}

function describeComponent(c: PayrollComponent, value: number): string {
  if (c.mode === "percent_base") return `${value}% от оклада`;
  if (c.mode === "percent_gross") return `${value}% от начисленного`;
  return `${value} сўм`;
}

/** Qo‘lda kiritilgan tuzatishlar (надбавка/вычет) — musbat = ustama, manfiy = ushlanma. */
export function applyAdjustments(
  adjustments: Array<{ code: string; label: string; amount: number }> | null | undefined
): { adjustment: number; lines: PayrollBreakdownLine[] } {
  if (!adjustments || adjustments.length === 0) return { adjustment: 0, lines: [] };
  let total = 0;
  const lines: PayrollBreakdownLine[] = [];
  for (const a of adjustments) {
    const amount = Number.isFinite(a.amount) ? round2(a.amount) : 0;
    if (amount === 0) continue;
    total += amount;
    lines.push({
      code: a.code || `adjustment_${lines.length}`,
      label: a.label || "Корректировка",
      amount,
      note: "Qo‘lda kiritilgan"
    });
  }
  return { adjustment: round2(total), lines };
}
