"use client";

import { cn } from "@/lib/utils";
import { formatCompositionQty } from "./polki-order-composition";

export type OrderReturnBalanceView = {
  order_id: number;
  initial_paid_qty: number;
  initial_bonus_qty: number;
  returned_paid_qty: number;
  returned_bonus_qty: number;
  remaining_paid_qty: number;
  remaining_bonus_qty: number;
  fully_returned: boolean;
};

/** Zakaz bo‘yicha qoldiq: boshlang‘ich / qaytarilgan / hozir. */
export function ReturnOrderBalanceBlock({
  balance,
  className,
  dense = false
}: {
  balance: OrderReturnBalanceView;
  className?: string;
  dense?: boolean;
}) {
  if (balance.fully_returned) {
    return (
      <div
        className={cn(
          "rounded-lg border border-slate-200 bg-slate-50/80 dark:border-slate-700 dark:bg-slate-900/50",
          dense ? "p-2" : "p-3",
          className
        )}
        role="status"
      >
        <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">Заказ закрыт</p>
        <p className="mt-0.5 text-[10px] text-muted-foreground">
          По этому заказу возврат уже полностью оформлен (остаток 0 шт).
        </p>
      </div>
    );
  }

  const hasReturned = balance.returned_paid_qty > 0 || balance.returned_bonus_qty > 0;

  return (
    <BalanceOpenPanel balance={balance} hasReturned={hasReturned} className={className} dense={dense} />
  );
}

function BalanceOpenPanel({
  balance,
  hasReturned,
  className,
  dense
}: {
  balance: OrderReturnBalanceView;
  hasReturned: boolean;
  className?: string;
  dense?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border border-teal-600/30 bg-teal-50/60 dark:border-teal-700/40 dark:bg-teal-950/30",
        dense ? "p-2" : "p-3",
        className
      )}
      role="region"
      aria-label="Остаток по заказу"
    >
      <p className="text-[10px] font-semibold uppercase tracking-wide text-teal-800 dark:text-teal-200">
        Остаток · к возврату
      </p>
      <div className={cn("mt-2 grid gap-2", dense ? "grid-cols-2" : "sm:grid-cols-2")}>
        <QtyCell label="Оплата" value={balance.remaining_paid_qty} accent="text-slate-900 dark:text-slate-100" />
        {balance.remaining_bonus_qty > 0 || balance.initial_bonus_qty > 0 ? (
          <QtyCell
            label="Бонус"
            value={balance.remaining_bonus_qty}
            accent="text-amber-900 dark:text-amber-100"
          />
        ) : null}
      </div>
      {hasReturned ? (
        <p className="mt-2 text-[10px] leading-snug text-muted-foreground">
          Начало: опл. {formatCompositionQty(balance.initial_paid_qty)} шт
          {balance.initial_bonus_qty > 0
            ? ` · бон. ${formatCompositionQty(balance.initial_bonus_qty)} шт`
            : ""}
          {" · "}
          уже возвращено: опл. {formatCompositionQty(balance.returned_paid_qty)} шт
          {balance.returned_bonus_qty > 0
            ? ` · бон. ${formatCompositionQty(balance.returned_bonus_qty)} шт`
            : ""}
        </p>
      ) : null}
      <p className="mt-1 text-[10px] text-teal-900/80 dark:text-teal-100/80">
        Нельзя вернуть больше остатка.
      </p>
    </div>
  );
}

function QtyCell({
  label,
  value,
  accent
}: {
  label: string;
  value: number;
  accent: string;
}) {
  return (
    <div className="rounded-md bg-white/70 px-2 py-1.5 dark:bg-slate-950/40">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className={cn("text-sm font-bold tabular-nums", accent)}>
        {formatCompositionQty(value)} <span className="text-xs font-normal">шт</span>
      </div>
    </div>
  );
}