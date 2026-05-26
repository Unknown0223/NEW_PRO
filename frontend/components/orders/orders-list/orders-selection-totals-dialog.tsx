"use client";

import type { OrderDetailRow } from "@/components/orders/order-detail-view";
import { OrdersProductsByCategoryView } from "@/components/orders/orders-list/orders-products-by-category-view";
import {
  aggregateItemsAcrossOrders,
  computeItemTotals
} from "@/components/orders/orders-list/order-items-grouping";
import { downloadSelectionTotalsExcel } from "@/components/orders/orders-list/orders-selection-totals-excel";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { api } from "@/lib/api";
import { getUserFacingError } from "@/lib/error-utils";
import { formatGroupedInteger, formatNumberGrouped } from "@/lib/format-numbers";
import { STALE } from "@/lib/query-stale";
import { useQuery } from "@tanstack/react-query";
import { Download, Package } from "lucide-react";
import { useMemo, useState } from "react";
import type { UseOrdersListPageResult } from "./use-orders-list-page";

type Props = Pick<
  UseOrdersListPageResult,
  | "totalsPanelOpen"
  | "setTotalsPanelOpen"
  | "selectionTotals"
  | "tenantSlug"
  | "selectedOrderIds"
>;

async function fetchOrderDetailsBatch(
  tenantSlug: string,
  orderIds: number[]
): Promise<OrderDetailRow[]> {
  const chunkSize = 8;
  const out: OrderDetailRow[] = [];
  for (let i = 0; i < orderIds.length; i += chunkSize) {
    const chunk = orderIds.slice(i, i + chunkSize);
    const rows = await Promise.all(
      chunk.map(async (id) => {
        const { data } = await api.get<OrderDetailRow>(`/api/${tenantSlug}/orders/${id}`);
        return data;
      })
    );
    out.push(...rows);
  }
  return out;
}

export function OrdersSelectionTotalsDialog({
  totalsPanelOpen,
  setTotalsPanelOpen,
  selectionTotals,
  tenantSlug,
  selectedOrderIds
}: Props) {
  const [excelBusy, setExcelBusy] = useState(false);

  const orderIds = useMemo(
    () => Array.from(selectedOrderIds).filter((id) => Number.isFinite(id) && id > 0),
    [selectedOrderIds]
  );

  const linesQ = useQuery({
    queryKey: ["orders-selection-lines", tenantSlug, orderIds.join(",")],
    enabled: totalsPanelOpen && Boolean(tenantSlug) && orderIds.length > 0,
    staleTime: STALE.detail,
    queryFn: () => fetchOrderDetailsBatch(tenantSlug!, orderIds)
  });

  const aggregated = useMemo(() => {
    const allItems = (linesQ.data ?? []).flatMap((o) => o.items ?? []);
    return aggregateItemsAcrossOrders(allItems);
  }, [linesQ.data]);

  const grandTotals = useMemo(() => computeItemTotals(aggregated), [aggregated]);

  const onExcel = async () => {
    if (aggregated.length === 0) return;
    setExcelBusy(true);
    try {
      await downloadSelectionTotalsExcel(aggregated, selectionTotals.count);
    } finally {
      setExcelBusy(false);
    }
  };

  return (
    <Dialog
      open={totalsPanelOpen && orderIds.length > 0}
      onOpenChange={setTotalsPanelOpen}
    >
      <DialogContent
        overlayClassName="bg-black/35 supports-backdrop-filter:backdrop-blur-[2px]"
        className="flex h-auto w-[min(calc(100vw-2rem),72rem)] max-h-[min(90vh,900px)] max-w-none flex-col gap-3 overflow-hidden rounded-xl p-4 sm:max-w-none sm:gap-4 sm:p-5"
        showCloseButton
      >
        <DialogHeader className="shrink-0 space-y-2">
          <div className="flex flex-wrap items-start justify-between gap-3 pr-8">
            <div className="min-w-0">
              <DialogTitle>Итог по заказу</DialogTitle>
              <DialogDescription>
                Сводка по {formatGroupedInteger(selectionTotals.count)} выбранным заказам — товары
                сгруппированы по ассортименту (заказ и бонус отдельно), как в раскрытой строке
                заказа.
              </DialogDescription>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 shrink-0 gap-1.5"
              disabled={excelBusy || linesQ.isLoading || aggregated.length === 0}
              onClick={() => void onExcel()}
            >
              <Download className="size-3.5" />
              Excel
            </Button>
          </div>
        </DialogHeader>

        <dl className="grid shrink-0 grid-cols-2 gap-x-4 gap-y-1 rounded-lg border border-border bg-muted/20 p-3 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-muted-foreground">Заказов</dt>
            <dd className="font-medium tabular-nums">{formatGroupedInteger(selectionTotals.count)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Сумма</dt>
            <dd className="font-medium tabular-nums">
              {formatNumberGrouped(selectionTotals.total, { maxFractionDigits: 2 })}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Долг</dt>
            <dd className="font-medium tabular-nums">
              {formatNumberGrouped(selectionTotals.debt, { maxFractionDigits: 2 })}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Позиций</dt>
            <dd className="font-medium tabular-nums">{formatGroupedInteger(aggregated.length)}</dd>
          </div>
        </dl>

        <div className="max-h-[min(68vh,680px)] overflow-y-auto overflow-x-auto rounded-lg border border-teal-200/60 bg-[#f0fdfc] p-3 dark:border-teal-900/40 dark:bg-teal-950/25 sm:p-4">
          {linesQ.isLoading ? (
            <p className="py-4 text-center text-sm text-muted-foreground">Загрузка товаров…</p>
          ) : linesQ.isError ? (
            <p className="py-4 text-center text-sm text-destructive">
              {getUserFacingError(linesQ.error, "Не удалось загрузить строки заказов.")}
            </p>
          ) : aggregated.length === 0 ? (
            <p className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground">
              <Package className="size-4" aria-hidden />
              Нет строк товаров
            </p>
          ) : (
            <>
              <OrdersProductsByCategoryView items={aggregated} />
              {grandTotals.sum > 0 ? (
                <p className="mt-3 text-xs font-medium text-teal-800 dark:text-teal-300">
                  Итого: {formatNumberGrouped(grandTotals.sum, { maxFractionDigits: 2 })}
                  {grandTotals.bonusQty > 0
                    ? ` · бонус ${formatNumberGrouped(grandTotals.bonusQty, { maxFractionDigits: 3 })} шт.`
                    : ""}
                </p>
              ) : null}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
