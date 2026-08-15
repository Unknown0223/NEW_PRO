"use client";

import { useEffect, useMemo, useState } from "react";
import { Minus, Plus, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatNumberGrouped } from "@/lib/format-numbers";
import { cn } from "@/lib/utils";
import type { PolkiPairRowModel } from "../../types";

export type PolkiBonusCalcDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  row: PolkiPairRowModel;
  /** Preview/auto bo‘yicha qaytarilishi kerak bo‘lgan bonus dona. */
  bonusAvailable: number;
  /** Hozirgi: tovar sifatida (dona). */
  goodsQty: number;
  /** Hozirgi: to‘lov sifatida (dona → summa). */
  cashQty: number;
  ruleLabel?: string | null;
  minReturnHint?: number | null;
  onSave: (next: { goodsQty: number; cashQty: number }) => void;
};

function Stepper({
  label,
  value,
  max,
  disabled,
  onChange
}: {
  label: string;
  value: number;
  max: number;
  disabled?: boolean;
  onChange: (n: number) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <p className="min-w-0 flex-1 text-[13px] leading-snug text-slate-700">{label}</p>
      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          disabled={disabled || value <= 0}
          className={cn(
            "inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700",
            "disabled:opacity-40"
          )}
          aria-label="Уменьшить"
          onClick={() => onChange(Math.max(0, value - 1))}
        >
          <Minus className="h-4 w-4" />
        </button>
        <span className="min-w-[2rem] text-center text-base font-semibold tabular-nums text-slate-900">
          {value}
        </span>
        <button
          type="button"
          disabled={disabled || value >= max}
          className={cn(
            "inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700",
            "disabled:opacity-40"
          )}
          aria-label="Увеличить"
          onClick={() => onChange(Math.min(max, value + 1))}
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

/** Bonus qaytarish: tovar (dona) vs to‘lov (summa) — rasmga mos dialog. */
export function PolkiBonusCalcDialog({
  open,
  onOpenChange,
  row,
  bonusAvailable,
  goodsQty,
  cashQty,
  ruleLabel,
  minReturnHint,
  onSave
}: PolkiBonusCalcDialogProps) {
  const maxB = Math.max(0, Math.floor(bonusAvailable));
  const [goods, setGoods] = useState(goodsQty);
  const [cash, setCash] = useState(cashQty);

  useEffect(() => {
    if (!open) return;
    setGoods(Math.min(Math.max(0, Math.floor(goodsQty)), maxB));
    setCash(Math.min(Math.max(0, Math.floor(cashQty)), maxB));
  }, [open, goodsQty, cashQty, maxB]);

  const unit = row.unit_price_bonus > 0 ? row.unit_price_bonus : row.unit_price_paid;
  const cashSum = cash * unit;
  const allocated = goods + cash;
  const remaining = Math.max(0, maxB - allocated);

  const goodsMax = Math.max(0, maxB - cash);
  const cashMax = Math.max(0, maxB - goods);

  const hint = useMemo(() => {
    if (minReturnHint != null && minReturnHint > 0) {
      return `Минимальное количество возврата: ${minReturnHint}`;
    }
    if (maxB > 0) return `Доступно бонуса к возврату: ${maxB} шт`;
    return null;
  }, [minReturnHint, maxB]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center" role="dialog" aria-modal>
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Закрыть"
        onClick={() => onOpenChange(false)}
      />
      <div className="relative z-[1] flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl bg-[#f3f5f7] shadow-xl sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-slate-200/80 px-4 py-3">
          <h2 className="flex-1 text-center text-[17px] font-semibold text-slate-900">Расчет бонусов</h2>
          <button
            type="button"
            className="absolute right-3 top-3 rounded-md p-1 text-slate-500 hover:bg-slate-200/60"
            onClick={() => onOpenChange(false)}
            aria-label="Закрыть"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-3 overflow-y-auto px-4 py-3">
          {ruleLabel ? (
            <p className="text-center text-sm font-semibold text-slate-800">{ruleLabel}</p>
          ) : null}
          {hint ? (
            <div className="relative rounded-lg bg-white px-3 py-2 text-center text-[12px] text-slate-600 shadow-sm">
              {hint}
              <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-rose-500" aria-hidden />
            </div>
          ) : null}

          <div className="rounded-xl border border-slate-200/80 bg-white p-3 shadow-sm">
            <p className="text-[14px] font-semibold leading-snug text-slate-900">{row.name}</p>
            <dl className="mt-2 space-y-1 text-[12px] text-slate-600">
              <div className="flex justify-between gap-2">
                <dt>Цена</dt>
                <dd className="tabular-nums font-medium text-slate-800">
                  {formatNumberGrouped(unit, { maxFractionDigits: 0 })}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt>Общее количество</dt>
                <dd className="tabular-nums font-medium text-slate-800">{maxB} Шт.</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt>Доступное количество для возврата</dt>
                <dd className="tabular-nums font-medium text-slate-800">{remaining} Шт.</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt>Сумма возврата в виде оплаты</dt>
                <dd className="tabular-nums font-medium text-slate-800">
                  {formatNumberGrouped(cashSum, { maxFractionDigits: 0 })}
                </dd>
              </div>
            </dl>
          </div>

          <div className="space-y-3 rounded-xl border border-slate-200/80 bg-white p-3 shadow-sm">
            <Stepper
              label="Количество возврата в виде товара"
              value={goods}
              max={goodsMax}
              onChange={(n) => setGoods(n)}
            />
            <Stepper
              label="Количество возврата в виде оплаты"
              value={cash}
              max={cashMax}
              onChange={(n) => setCash(n)}
            />
          </div>

          {remaining > 0 && allocated > 0 ? (
            <p className="text-[11px] text-amber-800">
              Не распределено: {remaining} шт — при оформлении может стать «Долг бонус».
            </p>
          ) : null}
        </div>

        <div className="space-y-2 border-t border-slate-200/80 bg-[#f3f5f7] px-4 py-3">
          <Button
            type="button"
            variant="outline"
            className="h-11 w-full gap-2 border-slate-300 bg-white text-slate-800"
            onClick={() => {
              setGoods(0);
              setCash(0);
            }}
          >
            <RefreshCw className="h-4 w-4" />
            Сбросить распределение
          </Button>
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-11 border-slate-300 bg-white"
              onClick={() => onOpenChange(false)}
            >
              Закрыть
            </Button>
            <Button
              type="button"
              className="h-11 bg-[#0a8f7e] text-white hover:bg-[#087a6c]"
              onClick={() => {
                onSave({ goodsQty: goods, cashQty: cash });
                onOpenChange(false);
              }}
            >
              Сохранить
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
