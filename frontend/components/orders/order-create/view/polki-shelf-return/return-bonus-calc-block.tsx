"use client";

import { cn } from "@/lib/utils";
import type { OrderCreateVm } from "../../hooks/use-order-create";
import type { PolkiBonusCalcMode } from "./polki-bonus-calc";

const modeBtn =
  "flex-1 rounded-md border px-2 py-1.5 text-xs font-medium transition-colors";

/** Po zakaz: faqat «Авто» / «Ручной» (пересорт); miqdorlar jadvalda. */
export function ReturnPolkiBonusModeBlock({ vm }: { vm: OrderCreateVm }) {
  const {
    mutation,
    canShowPolkiGrid,
    polkiOrderIds,
    polkiBonusCalcMode,
    setPolkiBonusCalcMode
  } = vm;

  const disabled = mutation.isPending || !canShowPolkiGrid || polkiOrderIds.length === 0;

  const setMode = (m: PolkiBonusCalcMode) => setPolkiBonusCalcMode(m);

  return (
    <div className="space-y-2 rounded-lg border border-teal-800/15 bg-teal-50/40 p-3 dark:bg-teal-950/20">
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-teal-900 dark:text-teal-100">
          Режим бонуса
        </h3>
        <p className="mt-1 text-[10px] leading-snug text-muted-foreground">
          Количества — в таблице «Состав заявки». Оплата и бонус по правилам заказа; при нехватке
          бонуса — долг на баланс клиента.
        </p>
      </div>

      <div className="flex gap-1" role="group" aria-label="Режим расчёта">
        <button
          type="button"
          className={cn(
            modeBtn,
            polkiBonusCalcMode === "auto"
              ? "border-[#0a8f7e] bg-[#0a8f7e]/10 text-teal-900"
              : "border-border bg-card text-slate-600 hover:bg-muted"
          )}
          disabled={disabled}
          onClick={() => setMode("auto")}
        >
          Авто
        </button>
        <button
          type="button"
          className={cn(
            modeBtn,
            polkiBonusCalcMode === "manual"
              ? "border-[#0a8f7e] bg-[#0a8f7e]/10 text-teal-900"
              : "border-border bg-card text-slate-600 hover:bg-muted"
          )}
          disabled={disabled}
          onClick={() => setMode("manual")}
        >
          Ручной
        </button>
      </div>

      <p className="text-[10px] leading-snug text-muted-foreground">
        {polkiBonusCalcMode === "auto" ? (
          <>
            Пересорт бонуса на склад — автоматически (группа interchangeable). Цены — из
            выбранного заказа.
          </>
        ) : (
          <>
            Пересорт: в колонке «Бонус / баланс» выберите товар из разрешённой группы. Разделение
            оплата/бонус менять нельзя.
          </>
        )}
      </p>
    </div>
  );
}
