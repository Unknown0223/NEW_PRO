import type { PolkiPairRowModel } from "./types";
import { parsePriceAmount, polkiPieceQtyFromNumber, polkiSplitTotal } from "./utils";

export function parsePolkiQty(raw: string): number {
  const n = Number.parseFloat(String(raw).replace(/\s/g, "").replace(",", "."));
  return polkiPieceQtyFromNumber(n);
}

/** Preview/sync: paid+bonus qator va zakaz limitidan oshmasin. */
export function capPolkiExplicitSplit(
  row: Pick<PolkiPairRowModel, "max_paid" | "max_bonus">,
  rowReturnQty: number,
  paid: number,
  bonus: number
): { paid: number; bonus: number } {
  const maxTot = Math.max(0, row.max_paid + row.max_bonus);
  const capQty = Math.min(polkiPieceQtyFromNumber(rowReturnQty), maxTot);
  let p = polkiPieceQtyFromNumber(paid);
  let b = polkiPieceQtyFromNumber(bonus);
  p = Math.min(p, row.max_paid);
  b = Math.min(b, row.max_bonus);
  const phys = p + b;
  if (phys > capQty && phys > 0) {
    const ratio = capQty / phys;
    p = polkiPieceQtyFromNumber(p * ratio);
    b = polkiPieceQtyFromNumber(b * ratio);
    p = Math.min(p, row.max_paid);
    b = Math.min(b, row.max_bonus);
    let slack = capQty - (p + b);
    while (slack > 0 && p < row.max_paid) {
      p += 1;
      slack -= 1;
    }
    while (slack > 0 && b < row.max_bonus) {
      b += 1;
      slack -= 1;
    }
  }
  return { paid: p, bonus: b };
}

/** Пересорт: siblings из interchangeable; иначе только сам товар. */
export function peresortSelectOptions(
  productId: number,
  productName: string,
  siblings: Array<{ id: number; name: string }> | undefined
): Array<{ id: number; label: string }> {
  if (!siblings?.length) {
    return [{ id: productId, label: productName }];
  }
  return [
    { id: productId, label: `${productName} (как в заказе)` },
    ...siblings.map((s) => ({ id: s.id, label: s.name }))
  ];
}

/** Долг по строке: бонус на баланс без полной компенсации + нераспределённое qty. */
export function computePolkiLineDebt(input: {
  row: PolkiPairRowModel;
  totalQty: number;
  deferToBalance: boolean;
  cashRaw: string;
  explicitPaid?: number;
  explicitBonus?: number;
}): number {
  const { row: r, totalQty, deferToBalance, cashRaw } = input;
  if (!(totalQty > 0)) return 0;

  const split =
    input.explicitPaid != null && input.explicitBonus != null
      ? { effPaid: input.explicitPaid, effBonus: input.explicitBonus }
      : polkiSplitTotal(r, totalQty);

  let debt = 0;
  const unitBonus = r.unit_price_bonus > 0 ? r.unit_price_bonus : r.unit_price_paid;

  const unallocated = Math.max(0, totalQty - split.effPaid - split.effBonus);
  if (unallocated > 0) debt += unallocated * unitBonus;

  if (deferToBalance && split.effBonus > 0) {
    const suggested = split.effBonus * unitBonus;
    const maxC = r.max_bonus * unitBonus;
    const cash = Math.min(parsePriceAmount(cashRaw), maxC);
    debt += Math.max(0, suggested - cash);
  }

  return debt;
}

export function computePolkiDebtHintSum(input: {
  rows: PolkiPairRowModel[];
  polkiTotalQty: Record<string, string>;
  polkiBonusToBalance: Record<string, boolean>;
  polkiBonusCash: Record<string, string>;
  explicitByPairKey?: Record<string, { paid: number; bonus: number }>;
}): number {
  let d = 0;
  for (const r of input.rows) {
    const pk = r.pair_key;
    const total = parsePolkiQty(input.polkiTotalQty[pk] ?? "");
    const ex = input.explicitByPairKey?.[pk];
    d += computePolkiLineDebt({
      row: r,
      totalQty: total,
      deferToBalance: Boolean(input.polkiBonusToBalance[pk]),
      cashRaw: input.polkiBonusCash[pk] ?? "",
      explicitPaid: ex?.paid,
      explicitBonus: ex?.bonus
    });
  }
  return d;
}

export type PolkiAllocationMode = "same" | "peresort" | "mixed";

export type PolkiRowBonusDisplay = {
  paidQty: number;
  bonusQty: number;
  bonusWarehouseLabel: string;
  allocationMode: PolkiAllocationMode;
  allocationLabel: string;
  debtAmount: number;
  debtQty: number;
  ruleLabel: string | null;
};

export function allocationModeLabel(mode: PolkiAllocationMode): string {
  if (mode === "peresort") return "Пересорт";
  if (mode === "mixed") return "Аралаш";
  return "Как в заказе";
}

export function buildRowBonusDisplay(input: {
  row: PolkiPairRowModel;
  sharePaid: number;
  shareBonus: number;
  previewLine?: {
    bonus_warehouse_product_id: number;
    bonus_warehouse_product_name: string;
    allocation_mode: PolkiAllocationMode;
    bonus_debt_qty: number;
    bonus_debt_amount: number;
    rule_label: string | null;
  };
  debtAmount?: number;
}): PolkiRowBonusDisplay | null {
  const { row: r, sharePaid, shareBonus, previewLine, debtAmount } = input;
  if (sharePaid <= 0 && shareBonus <= 0 && !(debtAmount && debtAmount > 0)) return null;

  const mode = previewLine?.allocation_mode ?? "same";
  const targetName = previewLine?.bonus_warehouse_product_name ?? r.name;
  const targetId = previewLine?.bonus_warehouse_product_id ?? r.product_id;
  let bonusWarehouseLabel = targetName;
  if (shareBonus > 0 && targetId !== r.product_id) {
    bonusWarehouseLabel = `${r.name} → ${targetName}`;
  } else if (shareBonus > 0) {
    bonusWarehouseLabel = r.name;
  }

  const unitBonus = r.unit_price_bonus > 0 ? r.unit_price_bonus : r.unit_price_paid;
  const debt = debtAmount ?? 0;
  const debtQty =
    debt > 0 && unitBonus > 0 ? Math.round((debt / unitBonus) * 1000) / 1000 : previewLine?.bonus_debt_qty ?? 0;

  return {
    paidQty: sharePaid,
    bonusQty: shareBonus,
    bonusWarehouseLabel,
    allocationMode: mode,
    allocationLabel: allocationModeLabel(mode),
    debtAmount: debt,
    debtQty,
    ruleLabel: previewLine?.rule_label ?? null
  };
}
