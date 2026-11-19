/**
 * OrderCreateBonusDebt — pure (ADR-008).
 * Ordinary: FE oldindan bonus debt hisoblamaydi (0).
 * Polki: `computePolkiDebtHintSum` / auto-bonus debt.
 */
import type { PolkiPairRowModel } from "../types";
import {
  computePolkiDebtHintSum,
  computePolkiLineDebt,
  capPolkiExplicitSplit
} from "../polki-bonus-balance.logic";

export { computePolkiLineDebt, capPolkiExplicitSplit, computePolkiDebtHintSum };

export type OrdinaryDebtInput = {
  kind: "ordinary";
};

export type PolkiDebtInput = {
  kind: "polki";
  /** Auto-bonus API debt (priority). */
  autoBonusDebtAmount?: number | null;
  useAutoBonus: boolean;
  rows: PolkiPairRowModel[];
  polkiTotalQty: Record<string, string>;
  polkiBonusToBalance: Record<string, boolean>;
  polkiBonusCash: Record<string, string>;
  explicitByPairKey?: Record<string, { paid: number; bonus: number }>;
};

export type DebtAmountsInput = OrdinaryDebtInput | PolkiDebtInput;

export type DebtAmounts = {
  /** UI hint (polki). */
  debtHintSum: number;
  /** Submit `bonus_debt_amount`. */
  bonusDebt: number;
};

/** Ordinary + polki debt summalari (bitta facade). */
export function computeDebtAmounts(input: DebtAmountsInput): DebtAmounts {
  if (input.kind === "ordinary") {
    return { debtHintSum: 0, bonusDebt: 0 };
  }

  if (input.useAutoBonus) {
    const auto = Number(input.autoBonusDebtAmount ?? 0);
    const n = Number.isFinite(auto) ? auto : 0;
    return { debtHintSum: n, bonusDebt: n };
  }

  const debtHintSum = computePolkiDebtHintSum({
    rows: input.rows,
    polkiTotalQty: input.polkiTotalQty,
    polkiBonusToBalance: input.polkiBonusToBalance,
    polkiBonusCash: input.polkiBonusCash,
    explicitByPairKey: input.explicitByPairKey
  });
  return {
    debtHintSum,
    bonusDebt: Math.round(debtHintSum)
  };
}

/** Period / batch API dan discount debt summasini o‘qish. */
export function parseDiscountDebtAmount(raw: string | null | undefined): number {
  const n = Number.parseFloat(String(raw ?? "").replace(/\s/g, ""));
  return Number.isFinite(n) && n > 0 ? n : 0;
}
