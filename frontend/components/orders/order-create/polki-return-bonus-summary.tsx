"use client";

import { cn } from "@/lib/utils";
import { formatNumberGrouped } from "@/lib/format-numbers";
import type { PolkiPairRowModel } from "./types";
import { buildRowBonusDisplay, parsePolkiQty } from "./polki-bonus-balance.logic";
import type {
  PolkiAutoBonusPreviewLine,
  PolkiExplicitSplit
} from "./hooks/use-polki-auto-bonus";

export type PolkiReturnBonusSummaryProps = {
  row: PolkiPairRowModel;
  pairKey: string;
  polkiTotalQty: Record<string, string>;
  explicit?: PolkiExplicitSplit;
  previewLine?: PolkiAutoBonusPreviewLine;
  previewDebtAmount?: number;
  previewPending?: boolean;
  previewError?: boolean;
};

export function PolkiReturnBonusSummary({
  row: r,
  pairKey: pk,
  polkiTotalQty,
  explicit,
  previewLine,
  previewDebtAmount = 0,
  previewPending,
  previewError
}: PolkiReturnBonusSummaryProps) {
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
  const bonus = explicit?.bonus ?? previewLine?.bonus_qty ?? 0;

  const display = buildRowBonusDisplay({
    row: r,
    sharePaid: paid,
    shareBonus: bonus,
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

  if (!display) {
    return <span className="text-[11px] text-muted-foreground">—</span>;
  }

  return (
    <div className="space-y-1 text-[11px] leading-snug">
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

      {display.paidQty > 0 ? (
        <p>
          Оплата на склад:{" "}
          <span className="font-semibold tabular-nums">{display.paidQty}</span> шт
          <span className="text-muted-foreground"> · {r.name}</span>
        </p>
      ) : null}

      {display.bonusQty > 0 ? (
        <p>
          Бонус на склад:{" "}
          <span className="font-semibold tabular-nums">{display.bonusQty}</span> шт
          <span className="text-muted-foreground"> · {display.bonusWarehouseLabel}</span>
        </p>
      ) : null}

      {display.debtAmount > 0 ? (
        <p className="font-medium text-amber-800 dark:text-amber-200">
          Долг бонус → баланс (qarzdorlik), не на склад:{" "}
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
    </div>
  );
}
