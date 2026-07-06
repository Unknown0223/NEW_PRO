"use client";

import type { OrderCreateVm } from "../../hooks/use-order-create";
import { formatPolkiMoneySum } from "./polki-format-display";

export function ReturnContextStrip({ vm }: { vm: OrderCreateVm }) {
  const { clientSummaryQ, polkiContextQ, isPolkiFree, isPolkiByOrder } = vm;

  if (!clientSummaryQ.data && !polkiContextQ.data) return null;

  return (
    <div className="flex flex-col gap-2 text-xs text-slate-600 sm:flex-row sm:flex-wrap sm:gap-4">
      {clientSummaryQ.data ? (
        <p className="rounded-lg border border-border/80 bg-card px-3 py-2">
          <span className="font-medium text-slate-800">Финансы: </span>
          баланс{" "}
          <span className="font-mono tabular-nums text-slate-900">
            {formatPolkiMoneySum(clientSummaryQ.data.account_balance)}
          </span>
          {" · кредит "}
          <span className="font-mono tabular-nums text-slate-900">
            {formatPolkiMoneySum(clientSummaryQ.data.credit_limit)}
          </span>
        </p>
      ) : null}
      {polkiContextQ.data && (polkiContextQ.data.items?.length ?? 0) > 0 ? (
        <p className="rounded-lg border border-amber-200/80 bg-amber-50/80 px-3 py-2">
          <span className="font-medium text-amber-900">Макс. к возврату: </span>
          <span className="tabular-nums font-medium text-amber-900">
            {formatPolkiMoneySum(polkiContextQ.data.max_returnable_value)}
          </span>
          {isPolkiFree
            ? " · введите «всего к возврату» по строкам (не больше «макс» в ячейке); бонус и долг — автоматически"
            : isPolkiByOrder
              ? " · по выбранному заказу; количество не больше «макс. всего» в строке"
              : ""}
        </p>
      ) : null}
    </div>
  );
}
