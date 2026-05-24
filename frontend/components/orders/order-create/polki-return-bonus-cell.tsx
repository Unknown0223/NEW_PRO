"use client";

import type { Dispatch, SetStateAction } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { formatNumberGrouped } from "@/lib/format-numbers";
import type { PolkiPairRowModel } from "./types";
import {
  computePolkiLineDebt,
  peresortSelectOptions,
  parsePolkiQty
} from "./polki-bonus-balance.logic";
import { polkiSplitTotal } from "./utils";

export type PolkiReturnBonusCellProps = {
  row: PolkiPairRowModel;
  pairKey: string;
  defer: boolean;
  effPaid: number;
  effBonus: number;
  cashRaw: string;
  maxCashDefer: number;
  maxCashExtra: number;
  mutationPending: boolean;
  polkiTotalQty: Record<string, string>;
  polkiAutoBonusEnabled: boolean;
  polkiAutoBonusApplied: boolean;
  explicitPaid?: number;
  explicitBonus?: number;
  previewDebtAmount?: number;
  polkiPeresortByPairKey?: Record<string, number>;
  setPolkiPeresortByPairKey?: Dispatch<SetStateAction<Record<string, number>>>;
  polkiPeresortOptionsByProductId?: Map<number, Array<{ id: number; name: string }>>;
  setPolkiBonusToBalance: Dispatch<SetStateAction<Record<string, boolean>>>;
  setPolkiBonusCash: Dispatch<SetStateAction<Record<string, string>>>;
};

export function PolkiReturnBonusCell({
  row: r,
  pairKey: pk,
  defer,
  effPaid,
  effBonus,
  cashRaw,
  maxCashDefer,
  maxCashExtra,
  mutationPending,
  polkiTotalQty,
  polkiAutoBonusEnabled,
  polkiAutoBonusApplied,
  explicitPaid,
  explicitBonus,
  previewDebtAmount,
  polkiPeresortByPairKey,
  setPolkiPeresortByPairKey,
  polkiPeresortOptionsByProductId,
  setPolkiBonusToBalance,
  setPolkiBonusCash
}: PolkiReturnBonusCellProps) {
  const manualLocked = polkiAutoBonusEnabled;
  const totalQty = parsePolkiQty(polkiTotalQty[pk] ?? "");
  const physBonus = defer ? 0 : effBonus;
  const peresortOpts = peresortSelectOptions(
    r.product_id,
    r.name,
    polkiPeresortOptionsByProductId?.get(r.product_id)
  );
  const hasPeresortChoice = peresortOpts.length > 1;
  const peresortEnabled =
    !mutationPending &&
    physBonus > 0 &&
    !defer &&
    (!manualLocked || polkiAutoBonusApplied);

  const cashCap = defer ? maxCashDefer : maxCashExtra;
  const debtLine = manualLocked
    ? previewDebtAmount ?? 0
    : computePolkiLineDebt({
        row: r,
        totalQty,
        deferToBalance: defer,
        cashRaw,
        explicitPaid,
        explicitBonus
      });

  if (r.max_bonus <= 0) {
    return (
      <div className="flex flex-wrap items-center gap-2 text-[11px]">
        <span className="text-muted-foreground">Бонус не было</span>
        {!manualLocked ? (
          <label className="flex items-center gap-1.5 text-muted-foreground">
            <span className="whitespace-nowrap">На баланс, ₽</span>
            <Input
              type="number"
              min={0}
              step="any"
              placeholder="0"
              className="h-7 w-[5.5rem] tabular-nums text-xs"
              value={cashRaw}
              onChange={(e) => setPolkiBonusCash((prev) => ({ ...prev, [pk]: e.target.value }))}
              disabled={mutationPending}
            />
          </label>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {manualLocked ? (
        <p className="text-[10px] text-teal-800 dark:text-teal-200/90">
          {polkiAutoBonusApplied ? (
            <>
              Авто: опл. <span className="font-semibold tabular-nums">{effPaid}</span>
              {" · "}бон. <span className="font-semibold tabular-nums">{effBonus}</span>
            </>
          ) : (
            <span className="text-muted-foreground">
              Авто-бонус: «Пересчитать» → «Применить»
            </span>
          )}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span
          className="inline-flex shrink-0 items-center rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-900 dark:text-amber-100"
          title="Лимит бонусных единиц по доставленным продажам"
        >
          Бонус макс {formatNumberGrouped(r.max_bonus, { maxFractionDigits: 0 })} шт
          {r.unit_price_bonus > 0 ? (
            <span className="ml-1 tabular-nums opacity-90">
              × {formatNumberGrouped(r.unit_price_bonus, { maxFractionDigits: 0 })}
            </span>
          ) : null}
        </span>

        <label className="flex min-w-0 items-center gap-1 text-[10px] text-muted-foreground">
          <span className="shrink-0 whitespace-nowrap">На склад:</span>
          {setPolkiPeresortByPairKey ? (
            <select
              className={cn(
                "h-7 min-w-0 max-w-[10rem] flex-1 truncate rounded-md border border-input bg-background px-1.5 text-[11px]",
                !peresortEnabled && "cursor-not-allowed opacity-60"
              )}
              title={
                hasPeresortChoice
                  ? "Пересорт — товар из группы interchangeable"
                  : "Нет группы пересорта — только этот товар"
              }
              value={String(polkiPeresortByPairKey?.[pk] ?? r.product_id)}
              disabled={!peresortEnabled}
              onChange={(e) => {
                const pid = Number.parseInt(e.target.value, 10);
                if (!Number.isFinite(pid)) return;
                setPolkiPeresortByPairKey((prev) => ({ ...prev, [pk]: pid }));
              }}
            >
              {peresortOpts.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          ) : (
            <span className="truncate text-foreground">{r.name}</span>
          )}
        </label>

        {!manualLocked ? (
          <>
            <label
              className={cn(
                "flex shrink-0 cursor-pointer items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px]",
                defer
                  ? "border-amber-400/50 bg-amber-500/10 text-amber-950 dark:text-amber-50"
                  : "border-border/80 text-foreground"
              )}
              title="Бонус не на склад — сумма на баланс клиента"
            >
              <input
                type="checkbox"
                className="h-3 w-3 shrink-0 rounded border-input"
                checked={defer}
                disabled={mutationPending}
                onChange={(e) => {
                  const on = e.target.checked;
                  setPolkiBonusToBalance((prev) => ({ ...prev, [pk]: on }));
                  if (on) {
                    const sp = polkiSplitTotal(r, totalQty);
                    const sug = sp.effBonus * r.unit_price_bonus;
                    if (sug > 0) {
                      setPolkiBonusCash((prev) => ({ ...prev, [pk]: String(Math.round(sug)) }));
                    }
                  }
                }}
              />
              <span className="whitespace-nowrap">На баланс</span>
            </label>

            <label className="flex shrink-0 items-center gap-1 text-[10px] text-muted-foreground">
              <span className="whitespace-nowrap">{defer ? "Сумма ₽" : "Доп. ₽"}</span>
              <Input
                type="number"
                min={0}
                step="any"
                placeholder="0"
                className="h-7 w-[5.5rem] tabular-nums text-xs"
                value={cashRaw}
                onChange={(e) => setPolkiBonusCash((prev) => ({ ...prev, [pk]: e.target.value }))}
                disabled={mutationPending}
              />
              <span className="whitespace-nowrap tabular-nums text-[10px]">
                / {formatNumberGrouped(cashCap, { maxFractionDigits: 0 })}
              </span>
            </label>
          </>
        ) : null}
      </div>

      {debtLine > 0 ? (
        <p className="text-[10px] font-medium text-amber-800 dark:text-amber-200">
          Долг бонус ≈ {formatNumberGrouped(debtLine, { maxFractionDigits: 0 })} сум
        </p>
      ) : null}
    </div>
  );
}
