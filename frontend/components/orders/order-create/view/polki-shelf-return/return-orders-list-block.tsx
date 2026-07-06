"use client";

import { useMemo } from "react";
import { ChevronDown, ChevronRight, Gift } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatNumberGrouped } from "@/lib/format-numbers";
import type { OrderCreateVm } from "../../hooks/use-order-create";
import { buildPolkiOrdersListEntries } from "./polki-orders-list";
import { polkiReturnEmptyListMessage } from "@/lib/return-filter-messages";
import { ReturnFilterDebugPanel } from "./return-filter-debug-panel";
import { PolkiOrderCompositionDetails } from "./polki-order-composition-details";
import { formatCompositionQty, formatCompositionSum } from "./polki-order-composition";
import { polkiCard } from "./polki-return-ui";
import type { POLKI_RETURN_MODE_META } from "./polki-return-mode";

type ModeMeta = (typeof POLKI_RETURN_MODE_META)[keyof typeof POLKI_RETURN_MODE_META];

export function ReturnOrdersListBlock({
  vm,
  mode,
  variant = "card"
}: {
  vm: OrderCreateVm;
  mode: ModeMeta;
  variant?: "card" | "strip";
}) {
  const {
    mutation,
    hasClient,
    canPickWarehouse,
    isPolkiFree,
    isPolkiByOrder,
    polkiContextQ,
    polkiOrdersPickQ,
    polkiOrdersForPick,
    polkiOrdersPickRawCount,
    polkiOrderFilterMeta,
    polkiOrderGroups,
    polkiRowsAll,
    polkiOrderIdSet,
    polkiOrderIds,
    selectPolkiOrder,
    polkiExpandedOrderId,
    setPolkiExpandedOrderId
  } = vm;

  const pickById = useMemo(
    () => new Map(polkiOrdersForPick.map((o) => [o.id, o])),
    [polkiOrdersForPick]
  );

  const entries = useMemo(
    () =>
      buildPolkiOrdersListEntries({
        isPolkiByOrder,
        polkiOrderIdSet,
        polkiOrdersForPick,
        contextOrders: polkiContextQ.data?.orders,
        polkiOrderGroups,
        polkiRowsAll,
        pickById,
        orderBalanceById: vm.polkiOrderBalanceById
      }),
    [
      isPolkiByOrder,
      polkiOrderIdSet,
      polkiOrdersForPick,
      polkiContextQ.data?.orders,
      polkiOrderGroups,
      polkiRowsAll,
      pickById,
      vm.polkiOrderBalanceById
    ]
  );

  const loading = isPolkiByOrder ? polkiOrdersPickQ.isLoading : polkiContextQ.isLoading;
  const listExpandedId = polkiExpandedOrderId;
  const showCheckboxes = mode.showOrderCheckboxes;

  const openOrder = (orderId: number) => {
    selectPolkiOrder(orderId);
    setPolkiExpandedOrderId((prev) => (prev === orderId ? null : orderId));
  };

  const listBody =
    !hasClient || (!isPolkiFree && !canPickWarehouse) ? (
      <p className="text-xs text-slate-500">
        {isPolkiFree ? "Выберите клиента." : "Выберите клиента и склад возврата."}
      </p>
    ) : loading ? (
      <p className="text-xs text-muted-foreground">Загрузка заказов…</p>
    ) : entries.length === 0 ? (
      <div className="space-y-2">
        <p className="text-xs text-amber-900 rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5">
          {polkiReturnEmptyListMessage({
            filterMeta: polkiOrderFilterMeta,
            deliveredOrdersCount: polkiOrdersPickRawCount,
            returnableCount: polkiOrdersForPick.length,
            isByOrder: isPolkiByOrder
          })}
        </p>
        {polkiOrderFilterMeta &&
        (polkiOrderFilterMeta.period_enabled ||
          polkiOrderFilterMeta.balance_zero_enabled ||
          polkiOrderFilterMeta.empty_reason) ? (
          <ReturnFilterDebugPanel meta={polkiOrderFilterMeta} />
        ) : null}
      </div>
    ) : (
      <div
        className={cn(
          variant === "strip"
            ? "flex gap-2 overflow-x-auto pb-1"
            : "min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-0.5"
        )}
      >
        {entries.map((e) => {
          const isOpen = listExpandedId === e.orderId;
          return (
            <div
              key={e.orderId}
              className={cn(
                "overflow-hidden rounded-lg border transition-colors",
                variant === "strip" && "min-w-[220px] max-w-[280px] shrink-0",
                isOpen
                  ? "border-teal-600/35 bg-teal-50/60 dark:bg-teal-950/25"
                  : "border-border/80 bg-card dark:border-slate-700"
              )}
            >
              <div className="flex items-stretch">
                {showCheckboxes && e.pickable ? (
                  <div
                    className="flex items-center border-r border-border/60 px-2"
                    onClick={(ev) => ev.stopPropagation()}
                  >
                    <input
                      type="radio"
                      name="polki-order-pick"
                      className="size-4 border-input"
                      checked={e.selected}
                      disabled={mutation.isPending}
                      aria-label={`Заказ ${e.orderNumber}`}
                      onChange={() => selectPolkiOrder(e.orderId)}
                    />
                  </div>
                ) : null}
                <button
                  type="button"
                  className="flex min-w-0 flex-1 items-start gap-2 px-2.5 py-2 text-left"
                  aria-expanded={isOpen}
                  disabled={mutation.isPending}
                  onClick={() => openOrder(e.orderId)}
                >
                  {isOpen ? (
                    <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-teal-700" aria-hidden />
                  ) : (
                    <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span className="font-mono text-xs font-semibold text-slate-800">
                        №{e.orderNumber}
                      </span>
                      <span className="text-[11px] tabular-nums text-muted-foreground">
                        {e.orderDate}
                      </span>
                      {e.hasBonus ? (
                        <Gift className="h-3.5 w-3.5 text-amber-600" aria-label="Есть бонус" />
                      ) : null}
                    </div>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">
                      {e.statusLabel}
                      {e.lineCount > 0 ? ` · ${e.lineCount} поз.` : ""}
                    </p>
                  </div>
                  <div className="shrink-0 text-right text-[10px] tabular-nums text-slate-600">
                    <div>{e.sumDisplay !== "—" ? `${e.sumDisplay} сум` : "—"}</div>
                    {e.hasBonus ? (
                      <div className="text-amber-700">бон. {e.bonusSumDisplay}</div>
                    ) : null}
                  </div>
                </button>
              </div>

              {isOpen && variant === "card" ? (
                <div className="border-t border-teal-800/15 bg-card/70 px-3 py-2 text-[11px] dark:bg-teal-950/15">
                  <dl className="grid grid-cols-2 gap-x-3 gap-y-1">
                    <div>
                      <dt className="text-muted-foreground">Склад</dt>
                      <dd className="font-medium">{e.warehouseName ?? "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Остаток</dt>
                      <dd className="font-medium tabular-nums">
                        {e.balance ? (
                          <>
                            опл. {formatNumberGrouped(e.balance.remaining_paid_qty, { maxFractionDigits: 0 })}
                            {e.balance.remaining_bonus_qty > 0
                              ? ` · бон. ${formatNumberGrouped(e.balance.remaining_bonus_qty, { maxFractionDigits: 0 })}`
                              : ""}
                          </>
                        ) : (
                          <>
                            опл. {formatNumberGrouped(e.maxPaid, { maxFractionDigits: 0 })}
                            {e.maxBonus > 0
                              ? ` · бон. ${formatNumberGrouped(e.maxBonus, { maxFractionDigits: 0 })}`
                              : ""}
                          </>
                        )}
                      </dd>
                    </div>
                  </dl>

                  {e.composition ? (
                    <div className="mt-2 border-t border-teal-800/10 pt-2">
                      <PolkiOrderCompositionDetails composition={e.composition} dense />
                      <p className="mt-2 tabular-nums text-[10px] font-medium text-teal-900 dark:text-teal-100">
                        Итого: опл. {formatCompositionQty(e.composition.paidQtyTotal)} шт
                        {e.composition.paidSumTotal > 0
                          ? ` · ${formatCompositionSum(e.composition.paidSumTotal)} сум`
                          : ""}
                        {e.composition.bonusQtyTotal > 0
                          ? ` · бон. ${formatCompositionQty(e.composition.bonusQtyTotal)} шт`
                          : ""}
                      </p>
                    </div>
                  ) : null}

                  <p className="mt-2 text-[10px] text-teal-800 dark:text-teal-200/90">
                    Количества к возврату — в «Состав заявки» ниже.
                  </p>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    );

  if (variant === "strip") {
    return (
      <div className={cn(polkiCard, "p-4")}>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-slate-800">{mode.ordersListTitle}</h2>
            <p className="text-[10px] text-muted-foreground">{mode.ordersListHint}</p>
          </div>
        </div>
        {listBody}
      </div>
    );
  }

  return (
    <div className={cn(polkiCard, "flex min-h-[280px] flex-col p-4")}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-[15px] font-semibold text-slate-800">{mode.ordersListTitle}</h2>
          <p className="text-[10px] text-muted-foreground">{mode.ordersListHint}</p>
        </div>
      </div>

      <div className="min-h-0 flex-1">{listBody}</div>

      {showCheckboxes && polkiOrderIds.length > 0 ? (
        <p className="mt-2 text-[10px] text-muted-foreground">
          Выбран один заказ — возврат только по нему.
        </p>
      ) : null}
    </div>
  );
}
