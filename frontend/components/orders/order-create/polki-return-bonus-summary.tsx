"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { formatNumberGrouped } from "@/lib/format-numbers";
import type { PolkiPairRowModel } from "./types";
import { buildRowBonusDisplay, parsePolkiQty } from "./polki-bonus-balance.logic";
import type {
  PolkiAutoBonusPreviewLine,
  PolkiExplicitSplit
} from "./hooks/use-polki-auto-bonus";
import { PolkiBonusCalcDialog } from "./view/polki-shelf-return/polki-bonus-calc-dialog";

export type PolkiReturnBonusSummaryProps = {
  row: PolkiPairRowModel;
  pairKey: string;
  polkiTotalQty: Record<string, string>;
  explicit?: PolkiExplicitSplit;
  previewLine?: PolkiAutoBonusPreviewLine;
  previewDebtAmount?: number;
  previewPending?: boolean;
  previewError?: boolean;
  /** Bonus dona — tovar sifatida omborga. */
  bonusGoodsQty?: number;
  /** Bonus dona — to‘lov (summa) sifatida. */
  bonusCashQty?: number;
  onBonusSplitChange?: (pairKey: string, next: { goodsQty: number; cashQty: number }) => void;
  disabled?: boolean;
};

export function PolkiReturnBonusSummary({
  row: r,
  pairKey: pk,
  polkiTotalQty,
  explicit,
  previewLine,
  previewDebtAmount = 0,
  previewPending,
  previewError,
  bonusGoodsQty,
  bonusCashQty,
  onBonusSplitChange,
  disabled
}: PolkiReturnBonusSummaryProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const totalQty = parsePolkiQty(polkiTotalQty[pk] ?? "");

  if (r.max_bonus <= 0 && totalQty <= 0) {
    return <span className="text-[11px] text-muted-foreground">Бонус не было</span>;
  }

  if (totalQty <= 0) {
    return <span className="text-[11px] text-muted-foreground">—</span>;
  }

  if (previewPending) {
    return <span className="text-[11px] text-muted-foreground">Расчёт…</span>;
  }

  if (previewError) {
    return (
      <span className="text-[11px] text-destructive">Ошибка расчёта</span>
    );
  }

  if (!explicit && !previewLine) {
    return <span className="text-[11px] text-muted-foreground">Расчёт…</span>;
  }

  const paid = explicit?.paid ?? previewLine?.paid_qty ?? 0;
  const autoBonus = explicit?.bonus ?? previewLine?.bonus_qty ?? 0;
  const unit = r.unit_price_bonus > 0 ? r.unit_price_bonus : r.unit_price_paid;

  const cashQty =
    bonusCashQty != null
      ? Math.min(Math.max(0, Math.floor(bonusCashQty)), Math.floor(autoBonus))
      : 0;
  const goodsQty =
    bonusGoodsQty != null
      ? Math.min(Math.max(0, Math.floor(bonusGoodsQty)), Math.floor(autoBonus) - cashQty)
      : Math.max(0, Math.floor(autoBonus) - cashQty);

  const cashSum = cashQty * unit;
  const unallocated = Math.max(0, Math.floor(autoBonus) - goodsQty - cashQty);

  const display = buildRowBonusDisplay({
    row: r,
    sharePaid: paid,
    shareBonus: goodsQty,
    previewLine: previewLine
      ? {
          bonus_warehouse_product_id: previewLine.bonus_warehouse_product_id,
          bonus_warehouse_product_name: previewLine.bonus_warehouse_product_name,
          allocation_mode: previewLine.allocation_mode,
          bonus_debt_qty: previewLine.bonus_debt_qty,
          bonus_debt_amount: previewLine.bonus_debt_amount,
          rule_label: previewLine.rule_label
        }
      : undefined,
    debtAmount: previewDebtAmount
  });

  if (!display && autoBonus <= 0 && paid <= 0) {
    return <span className="text-[11px] text-muted-foreground">—</span>;
  }

  return (
    <div className="space-y-1 text-[11px] leading-snug">
      {display ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className={cn(
              "inline-flex rounded px-1.5 py-0.5 text-[10px] font-medium",
              display.allocationMode === "mixed"
                ? "bg-violet-500/15 text-violet-900 dark:text-violet-100"
                : display.allocationMode === "peresort"
                  ? "bg-sky-500/15 text-sky-900 dark:text-sky-100"
                  : "bg-teal-500/15 text-teal-900 dark:text-teal-100"
            )}
          >
            {display.allocationLabel}
          </span>
          {display.ruleLabel ? (
            <span className="text-muted-foreground truncate max-w-[10rem]" title={display.ruleLabel}>
              {display.ruleLabel}
            </span>
          ) : null}
        </div>
      ) : null}

      {paid > 0 ? (
        <p>
          Оплата на склад:{" "}
          <span className="font-semibold tabular-nums">{paid}</span> шт
          <span className="text-muted-foreground"> · {r.name}</span>
        </p>
      ) : null}

      {goodsQty > 0 ? (
        <p className="text-teal-900 dark:text-teal-100">
          Бонус товаром:{" "}
          <span className="font-semibold tabular-nums">{goodsQty}</span> шт
          <span className="text-muted-foreground">
            {" "}
            · {display?.bonusWarehouseLabel ?? r.name}
          </span>
        </p>
      ) : null}

      {cashQty > 0 ? (
        <p className="text-sky-900 dark:text-sky-100">
          Бонус оплатой:{" "}
          <span className="font-semibold tabular-nums">{cashQty}</span> шт
          {" · "}
          <span className="tabular-nums font-semibold">
            {formatNumberGrouped(cashSum, { maxFractionDigits: 0 })} сум
          </span>
        </p>
      ) : null}

      {unallocated > 0 && autoBonus > 0 ? (
        <p className="text-amber-800 dark:text-amber-200">
          Не распределено бонуса:{" "}
          <span className="tabular-nums font-semibold">{unallocated}</span> шт
        </p>
      ) : null}

      {display && display.debtAmount > 0 ? (
        <p className="font-medium text-amber-800 dark:text-amber-200">
          Долг бонус → баланс:{" "}
          {display.debtQty > 0 ? (
            <>
              <span className="tabular-nums">{display.debtQty}</span> шт
              {" · "}
            </>
          ) : null}
          <span className="tabular-nums">
            {formatNumberGrouped(display.debtAmount, { maxFractionDigits: 0 })} сум
          </span>
        </p>
      ) : null}

      {autoBonus > 0 && onBonusSplitChange ? (
        <button
          type="button"
          disabled={disabled}
          className="mt-1 inline-flex rounded-md border border-teal-700/30 bg-teal-50 px-2 py-1 text-[10px] font-semibold text-teal-900 hover:bg-teal-100 disabled:opacity-50 dark:border-teal-600/40 dark:bg-teal-950/40 dark:text-teal-100"
          onClick={() => setDialogOpen(true)}
        >
          Расчет бонусов (товар / оплата)
        </button>
      ) : null}

      {autoBonus > 0 && onBonusSplitChange ? (
        <PolkiBonusCalcDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          row={r}
          bonusAvailable={autoBonus}
          goodsQty={goodsQty}
          cashQty={cashQty}
          ruleLabel={previewLine?.rule_label ?? display?.ruleLabel}
          minReturnHint={autoBonus > 0 ? autoBonus : null}
          onSave={(next) => onBonusSplitChange(pk, next)}
        />
      ) : null}
    </div>
  );
}
