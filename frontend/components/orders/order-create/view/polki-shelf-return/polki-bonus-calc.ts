import type { PolkiPairRowModel } from "../../types";
import { formatQtyState, polkiSplitTotal } from "../../utils";

export type PolkiBonusCalcMode = "manual" | "auto";

/** 5+1 qaytarish: 3 holat (zakaz bo‘yicha jami). */
export type PolkiBonusCalcScenario = 1 | 2 | 3;

export type PolkiOrderBonusLimits = {
  maxPaid: number;
  maxBonus: number;
};

export function polkiOrderBonusLimits(rows: PolkiPairRowModel[]): PolkiOrderBonusLimits {
  let maxPaid = 0;
  let maxBonus = 0;
  for (const r of rows) {
    maxPaid += r.max_paid;
    maxBonus += r.max_bonus;
  }
  return { maxPaid, maxBonus };
}

export function detectPolkiBonusScenario(
  total: number,
  limits: PolkiOrderBonusLimits
): PolkiBonusCalcScenario {
  const t = Math.max(0, total);
  if (t <= limits.maxPaid) return 1;
  if (t <= limits.maxPaid + limits.maxBonus) return 2;
  return 3;
}

export function splitPolkiOrderReturnTotal(
  totalIn: number,
  limits: PolkiOrderBonusLimits
): { effPaid: number; effBonus: number; scenario: PolkiBonusCalcScenario } {
  const raw = Number.isFinite(totalIn) && totalIn > 0 ? totalIn : 0;
  const maxTot = limits.maxPaid + limits.maxBonus;
  const t = Math.min(raw, maxTot);
  const effPaid = Math.min(t, limits.maxPaid);
  const effBonus = Math.min(Math.max(0, t - effPaid), limits.maxBonus);
  return {
    effPaid,
    effBonus,
    scenario: detectPolkiBonusScenario(t, limits)
  };
}

/** Jami paid/bonus ni qatorlarga max ulush bo‘yicha taqsimlash (butun sonlar). */
export function distributePaidBonusToLines(
  rows: PolkiPairRowModel[],
  targetPaid: number,
  targetBonus: number
): Map<string, number> {
  const out = new Map<string, number>();
  if (rows.length === 0) return out;

  const paidCap = rows.reduce((s, r) => s + r.max_paid, 0);
  const bonusCap = rows.reduce((s, r) => s + r.max_bonus, 0);
  const paidTarget = Math.min(Math.max(0, targetPaid), paidCap);
  const bonusTarget = Math.min(Math.max(0, targetBonus), bonusCap);

  const paidParts = allocateIntegerParts(
    rows.map((r) => ({ key: r.pair_key, weight: r.max_paid })),
    paidTarget
  );
  const bonusParts = allocateIntegerParts(
    rows.map((r) => ({ key: r.pair_key, weight: r.max_bonus })),
    bonusTarget
  );

  for (const r of rows) {
    const pk = r.pair_key;
    const lineTotal = (paidParts.get(pk) ?? 0) + (bonusParts.get(pk) ?? 0);
    const capped = Math.min(lineTotal, r.max_paid + r.max_bonus);
    if (capped > 0) out.set(pk, capped);
  }
  return out;
}

function allocateIntegerParts(
  items: Array<{ key: string; weight: number }>,
  target: number
): Map<string, number> {
  const result = new Map<string, number>();
  if (target <= 0 || items.length === 0) return result;

  const weights = items.map((i) => Math.max(0, i.weight));
  const sumW = weights.reduce((a, w) => a + w, 0);
  if (sumW <= 0) {
    const each = Math.floor(target / items.length);
    let rem = target - each * items.length;
    for (const it of items) {
      const add = rem > 0 ? 1 : 0;
      if (rem > 0) rem--;
      result.set(it.key, each + add);
    }
    return result;
  }

  const raw = items.map((it, idx) => ({
    key: it.key,
    exact: (target * weights[idx]!) / sumW,
    floor: 0,
    frac: 0
  }));
  let assigned = 0;
  for (const row of raw) {
    row.floor = Math.floor(row.exact);
    row.frac = row.exact - row.floor;
    assigned += row.floor;
    result.set(row.key, row.floor);
  }
  let rem = target - assigned;
  raw.sort((a, b) => b.frac - a.frac);
  for (const row of raw) {
    if (rem <= 0) break;
    result.set(row.key, (result.get(row.key) ?? 0) + 1);
    rem--;
  }
  return result;
}

export function validateManualOrderBonus(
  paidIn: number,
  bonusIn: number,
  limits: PolkiOrderBonusLimits
): string | null {
  if (!Number.isFinite(paidIn) || paidIn < 0) return "Оплата: неверное число";
  if (!Number.isFinite(bonusIn) || bonusIn < 0) return "Бонус: неверное число";
  if (paidIn > limits.maxPaid + 1e-9) {
    return `Оплата не больше ${formatQtyState(limits.maxPaid)} шт`;
  }
  if (bonusIn > limits.maxBonus + 1e-9) {
    return `Бонус не больше ${formatQtyState(limits.maxBonus)} шт`;
  }
  if (paidIn + bonusIn > limits.maxPaid + limits.maxBonus + 1e-9) {
    return `Сумма не больше ${formatQtyState(limits.maxPaid + limits.maxBonus)} шт`;
  }
  if (paidIn + bonusIn <= 0) return "Укажите оплату и/или бонус";
  return null;
}

export function scenarioHintRuUi(scenario: PolkiBonusCalcScenario): string {
  switch (scenario) {
    case 1:
      return "Сначала возвращается только оплаченная часть; бонус не затрагивается.";
    case 2:
      return "После оплаты возвращается бонус (как при продаже 5+1).";
    default:
      return "Превышен лимит по заказу — применён максимум (оплата + бонус).";
  }
}

/** Qator bo‘yicha tekshiruv (auto split dan keyin). */
export function lineSplitPreview(
  row: PolkiPairRowModel,
  total: number
): { effPaid: number; effBonus: number } {
  return polkiSplitTotal(row, total);
}
