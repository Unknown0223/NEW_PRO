"use client";

import { memo } from "react";
import { formatNumberGrouped } from "@/lib/format-numbers";
import type { OrderCreateVm } from "../../hooks/use-order-create";

/** Подсказка под таблицей: сколько строк доступно / выбрано. */
export const CompositionSummaryStrip = memo(function CompositionSummaryStrip({
  vm
}: {
  vm: OrderCreateVm;
}) {
  const {
    polkiContextQ,
    polkiRowsAll,
    polkiDisplayRows,
    polkiSelectedLinesCount,
    polkiTotalReturnQtySum,
    polkiEnteredTotalQtySum,
    isPolkiFree,
    polkiEstimatedSum,
    polkiAutoBonusDebtAmount,
    categoryFilterActive
  } = vm;

  if (!polkiContextQ.isSuccess) return null;

  const available = polkiRowsAll.length;
  const visible = polkiDisplayRows.length;

  return (
    <div className="mt-3 flex flex-col gap-2 border-t border-slate-100 pt-3 text-xs text-slate-600 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
      <p>
        Доступно позиций:{" "}
        <span className="font-semibold text-slate-800">{available}</span>
        {categoryFilterActive ? (
          <>
            {" · в таблице: "}
            <span className="font-semibold text-slate-800">{visible}</span>
          </>
        ) : null}
      </p>
      {polkiSelectedLinesCount > 0 ? (
        <p>
          На склад:{" "}
          <span className="font-semibold text-[#0a8f7e]">
            {polkiSelectedLinesCount} поз. · {formatNumberGrouped(polkiTotalReturnQtySum, { maxFractionDigits: 0 })} шт
          </span>
          {isPolkiFree &&
          polkiEnteredTotalQtySum > 0 &&
          Math.abs(polkiEnteredTotalQtySum - polkiTotalReturnQtySum) > 0.001 ? (
            <>
              {" · введено всего: "}
              <span className="font-semibold text-slate-700">
                {formatNumberGrouped(polkiEnteredTotalQtySum, { maxFractionDigits: 0 })} шт
              </span>
            </>
          ) : null}
          {polkiEstimatedSum > 0 ? (
            <>
              {" · сумма оплаты: "}
              <span className="font-mono font-semibold text-slate-800">
                {formatNumberGrouped(polkiEstimatedSum, { maxFractionDigits: 0 })}
              </span>
            </>
          ) : null}
          {polkiAutoBonusDebtAmount > 0 ? (
            <>
              {" · долг бонус: "}
              <span className="font-semibold text-amber-800">
                {formatNumberGrouped(polkiAutoBonusDebtAmount, { maxFractionDigits: 0 })}
              </span>
            </>
          ) : null}
        </p>
      ) : null}
    </div>
  );
});
