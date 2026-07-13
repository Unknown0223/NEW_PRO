"use client";

import { TableColumnSettingsDialog } from "@/components/data-table/table-column-settings-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { PageError } from "@/components/ui/page-error";
import { OrderStatusDatetimeDialog } from "@/components/orders/orders-list/order-status-datetime-dialog";
import { OrdersListTableRow } from "@/components/orders/orders-list/orders-list-table-row";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getUserFacingError } from "@/lib/error-utils";
import { formatGroupedInteger } from "@/lib/format-numbers";
import { OrdersExcelExportDialog } from "@/components/orders/orders-list/orders-excel-export-dialog";
import { ORDER_LIST_COLUMNS, orderListColumnThClass } from "@/lib/orders-list-columns";
import {
  orderMilestoneDatetimeDialogTitle,
  orderStatusDatetimeDialogTitle
} from "@/lib/order-status-datetime";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { ChevronLeft, ChevronRight, ListOrdered, Package, RefreshCw, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { UseOrdersListPageResult } from "./use-orders-list-page";

/**
 * CURSOR / AI AGENT — DO NOT CHANGE expand/scroll layout without explicit user request.
 * Zakaz ochilganda gorizontal scroll siljishi: orders-list-expand-layout.ts va
 * OrdersListExpandedRow. Jadval min-w-[3200px] saqlanadi; panel alohida sticky qatlam.
 */
const ORDERS_TABLE_MIN_CLASS = "w-full min-w-[3200px] border-collapse text-xs";
/** Ustun nomlari qatori (sticky) */
const ORDERS_TABLE_HEADER_REM = 2.75;
/** Bir qator balandligi (py-2.5 + kontent) */
const ORDERS_TABLE_ROW_REM = 3.125;
const ORDERS_TABLE_SCROLL_CLASS =
  "orders-list-table-scroll scrollbar-none overflow-x-auto overflow-y-auto";
const ORDERS_TABLE_HEAD_CELL = "orders-list-table-th-sticky";

/** Scroll oynasi: har doim sahifa limiti (15) qator sig‘imi, ma’lumot kam bo‘lsa ham */
function ordersTableScrollMaxHeight(pageSize: number): string {
  const layoutRows = Math.max(1, Math.min(pageSize, 50));
  return `min(78vh, ${ORDERS_TABLE_HEADER_REM + layoutRows * ORDERS_TABLE_ROW_REM}rem)`;
}

type OrdersListTableProps = Pick<
  UseOrdersListPageResult,
  | "tenantSlug"
  | "authHydrated"
  | "filters"
  | "data"
  | "isLoading"
  | "isError"
  | "error"
  | "refetch"
  | "rows"
  | "orderListTotalPages"
  | "ordersFiltersApplied"
  | "tablePrefs"
  | "replaceOrdersQuery"
  | "columnDialogOpen"
  | "setColumnDialogOpen"
  | "selectedOrderIds"
  | "allOnPageSelected"
  | "toggleOrderSelect"
  | "toggleSelectAllOnPage"
  | "effectiveRole"
  | "statusRowError"
  | "rowStatusMut"
  | "milestoneAtMut"
  | "prefetchOrderDetail"
>;

type PendingStatusDialog =
  | { kind: "status"; orderId: number; status: string; orderType?: string | null }
  | { kind: "milestone"; orderId: number; milestone: string; orderType?: string | null };

export function OrdersListTable(props: OrdersListTableProps) {
  const {
    tenantSlug,
    authHydrated,
    filters,
    data,
    isLoading,
    isError,
    error,
    refetch,
    rows,
    orderListTotalPages,
    ordersFiltersApplied,
    tablePrefs,
    replaceOrdersQuery,
    columnDialogOpen,
    setColumnDialogOpen,
    selectedOrderIds,
    allOnPageSelected,
    toggleOrderSelect,
    toggleSelectAllOnPage,
    effectiveRole,
    statusRowError,
    rowStatusMut,
    milestoneAtMut,
    prefetchOrderDetail
  } = props;

  const rowStatusPendingId = rowStatusMut.isPending
    ? rowStatusMut.variables?.id ?? null
    : milestoneAtMut.isPending
      ? milestoneAtMut.variables?.id ?? null
      : null;

  const [pendingStatusDialog, setPendingStatusDialog] = useState<PendingStatusDialog | null>(null);
  const [expandedOrderId, setExpandedOrderId] = useState<number | null>(null);
  const [excelExportOpen, setExcelExportOpen] = useState(false);
  const [searchDraft, setSearchDraft] = useState(filters.search);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [expandPanelWidth, setExpandPanelWidth] = useState<number | null>(null);

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const sync = () => setExpandPanelWidth(el.clientWidth);
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => ro.disconnect();
  }, [rows.length, ordersFiltersApplied, isLoading]);

  useEffect(() => {
    setSearchDraft(filters.search);
  }, [filters.search]);

  useEffect(() => {
    setExpandedOrderId(null);
  }, [filters.page]);

  const tableScrollMaxHeight = useMemo(
    () => ordersTableScrollMaxHeight(tablePrefs.pageSize),
    [tablePrefs.pageSize]
  );

  const toggleExpand = useCallback(
    (id: number) => {
      const scrollEl = scrollContainerRef.current;
      const savedScrollLeft = scrollEl?.scrollLeft ?? 0;
      setExpandedOrderId((prev) => {
        const next = prev === id ? null : id;
        if (next != null) prefetchOrderDetail(next);
        return next;
      });
      queueMicrotask(() => {
        requestAnimationFrame(() => {
          if (scrollEl) scrollEl.scrollLeft = savedScrollLeft;
        });
      });
    },
    [prefetchOrderDetail]
  );

  const onStatusChange = (id: number, status: string) => {
    const order = rows.find((r) => r.id === id);
    setPendingStatusDialog({
      kind: "status",
      orderId: id,
      status,
      orderType: order?.order_type
    });
  };

  const onChangeShipDate = (id: number) => {
    const order = rows.find((r) => r.id === id);
    setPendingStatusDialog({
      kind: "milestone",
      orderId: id,
      milestone: "confirmed",
      orderType: order?.order_type
    });
  };

  const dialogPending =
    rowStatusMut.isPending || milestoneAtMut.isPending;

  if (!authHydrated) {
    return <p className="text-sm text-muted-foreground">Загрузка сессии…</p>;
  }
  if (!tenantSlug) {
    return (
      <p className="text-sm text-destructive">
        <a href="/login" className="underline">
          Войти снова
        </a>
      </p>
    );
  }

  return (
    <>
      <TableColumnSettingsDialog
        open={columnDialogOpen}
        onOpenChange={setColumnDialogOpen}
        title="Ustunlarni boshqarish"
        description="Ko‘rinadigan ustunlar va tartib. Sizning akkauntingiz uchun saqlanadi (server)."
        columns={ORDER_LIST_COLUMNS}
        columnOrder={tablePrefs.columnOrder}
        hiddenColumnIds={tablePrefs.hiddenColumnIds}
        saving={tablePrefs.saving}
        onSave={(next) => tablePrefs.saveColumnLayout(next)}
        onReset={() => tablePrefs.resetColumnLayout()}
      />

      <div className="orders-hub-section orders-hub-section--table">
        <Card className="rounded-lg border border-border bg-card shadow-sm">
          <CardContent className="p-0">
            <div
              className="table-toolbar flex flex-wrap items-center gap-2 border-b border-border bg-muted/20 px-3 py-2 sm:px-4"
              role="toolbar"
              aria-label="Таблица: поиск и экспорт"
            >
              <div className="relative min-w-[12rem] flex-1 sm:max-w-md">
                <Search
                  className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <Input
                  type="search"
                  placeholder="Поиск по №, клиенту, комментарию…"
                  className="h-9 pl-9 text-sm"
                  value={searchDraft}
                  onChange={(e) => setSearchDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      replaceOrdersQuery({ search: searchDraft.trim(), page: 1 });
                    }
                  }}
                />
              </div>
              <label className="shrink-0 text-xs font-medium text-foreground/85">
                <span className="sr-only">Строк на странице</span>
                <select
                  className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground"
                  value={tablePrefs.pageSize}
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    tablePrefs.setPageSize(n);
                    replaceOrdersQuery({ page: 1 });
                  }}
                >
                  {[10, 15, 20, 30, 50, 100].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 shrink-0 gap-1"
                onClick={() => setColumnDialogOpen(true)}
              >
                <ListOrdered className="h-4 w-4" />
                Колонки
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 shrink-0"
                disabled={rows.length === 0 || !tenantSlug}
                onClick={() => setExcelExportOpen(true)}
              >
                Excel
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 w-9 shrink-0 p-0"
                onClick={() => void refetch()}
                aria-label="Обновить"
              >
                <RefreshCw className="mx-auto h-4 w-4" />
              </Button>
              {data ? (
                <div
                  className="ml-auto flex shrink-0 items-center gap-2 border-l border-border/80 pl-2 sm:pl-3"
                  role="navigation"
                  aria-label="Страницы таблицы"
                >
                  <span className="whitespace-nowrap text-sm text-foreground/80">
                    Страница{" "}
                    <span className="font-medium tabular-nums text-foreground">
                      {formatGroupedInteger(Math.min(filters.page, orderListTotalPages))}
                    </span>{" "}
                    /{" "}
                    <span className="tabular-nums text-foreground">
                      {formatGroupedInteger(orderListTotalPages)}
                    </span>
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-9 w-9 shrink-0 p-0"
                    disabled={filters.page <= 1}
                    onClick={() => replaceOrdersQuery({ page: Math.max(1, filters.page - 1) })}
                    aria-label="Назад"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-9 w-9 shrink-0 p-0"
                    disabled={filters.page >= orderListTotalPages}
                    onClick={() => replaceOrdersQuery({ page: filters.page + 1 })}
                    aria-label="Далее"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              ) : null}
            </div>

            {!ordersFiltersApplied ? (
              <div className="py-16 text-center text-muted-foreground">
                <Package className="mx-auto mb-3 size-12 text-muted-foreground/40" aria-hidden />
                <p className="text-lg font-medium text-foreground">Выберите фильтры</p>
                <p className="mt-1 text-sm">
                  Укажите период и условия, затем нажмите «Применить» — список заказов загрузится.
                </p>
              </div>
            ) : isLoading ? (
              <p className="px-3 py-6 text-sm text-muted-foreground sm:px-4">Загрузка…</p>
            ) : isError ? (
              <div className="p-4 sm:p-5">
                <PageError
                  message={getUserFacingError(error, "Zakazlarni yuklab bo'lmadi.")}
                  onRetry={() => void refetch()}
                />
              </div>
            ) : rows.length === 0 ? (
              <EmptyState
                title="Заказы не найдены"
                description={
                  data?.total === 0
                    ? "По выбранным фильтрам и периоду заказов нет. Измените условия или создайте новый заказ."
                    : "На этой странице нет строк — перейдите на другую страницу."
                }
                className="mx-4 my-8 border-none bg-transparent"
              />
            ) : (
              <>
                <div
                  ref={scrollContainerRef}
                  className={ORDERS_TABLE_SCROLL_CLASS}
                  style={{ maxHeight: tableScrollMaxHeight }}
                >
                  <table className={ORDERS_TABLE_MIN_CLASS}>
                    <thead className="app-table-thead">
                      <tr className="text-left font-medium text-muted-foreground">
                        <th className={cn("w-10 px-3 py-2", ORDERS_TABLE_HEAD_CELL)}>
                          <input
                            type="checkbox"
                            className="size-4 rounded border-input"
                            checked={allOnPageSelected}
                            onChange={toggleSelectAllOnPage}
                            aria-label="Joriy sahifadagi barcha zakazlarni tanlash"
                          />
                        </th>
                        {tablePrefs.visibleColumnOrder.map((colId) => {
                          const label =
                            ORDER_LIST_COLUMNS.find((c) => c.id === colId)?.label ?? colId;
                          const right =
                            colId === "qty" ||
                            colId === "volume_m3" ||
                            colId === "total_sum" ||
                            colId === "bonus_sum" ||
                            colId === "cumulative_bonus" ||
                            colId === "discount_sum" ||
                            colId === "balance" ||
                            colId === "debt" ||
                            colId === "client_id";
                          return (
                            <th
                              key={colId}
                              className={cn(
                                "px-3 py-2",
                                ORDERS_TABLE_HEAD_CELL,
                                orderListColumnThClass(colId),
                                right && "text-right"
                              )}
                            >
                              {label}
                            </th>
                          );
                        })}
                        <th
                          className={cn(
                            "sticky right-0 w-11 min-w-[2.75rem] px-2 py-2 text-center font-medium shadow-[inset_1px_0_0_hsl(var(--border))]",
                            ORDERS_TABLE_HEAD_CELL,
                            "orders-list-table-th-sticky-right"
                          )}
                        >
                          <span className="sr-only">Tafsilot</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((o) => (
                        <OrdersListTableRow
                          key={o.id}
                          order={o}
                          tenantSlug={tenantSlug!}
                          visibleColumnOrder={tablePrefs.visibleColumnOrder}
                          selected={selectedOrderIds.has(o.id)}
                          expanded={expandedOrderId === o.id}
                          onToggleExpand={toggleExpand}
                          onToggleSelect={toggleOrderSelect}
                          effectiveRole={effectiveRole}
                          statusRowError={statusRowError}
                          rowStatusPendingId={rowStatusPendingId}
                          onStatusChange={onStatusChange}
                          onChangeShipDate={onChangeShipDate}
                          onPrefetchDetail={prefetchOrderDetail}
                          expandPanelWidth={expandPanelWidth}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
      <OrderStatusDatetimeDialog
        open={pendingStatusDialog != null}
        onOpenChange={(open) => {
          if (!open && !dialogPending) setPendingStatusDialog(null);
        }}
        title={
          pendingStatusDialog?.kind === "milestone"
            ? orderMilestoneDatetimeDialogTitle()
            : pendingStatusDialog
              ? orderStatusDatetimeDialogTitle(
                  pendingStatusDialog.status,
                  pendingStatusDialog.orderType
                )
              : ""
        }
        isPending={dialogPending}
        onConfirm={(datetimeLocal) => {
          if (!pendingStatusDialog) return;
          const occurred_at = new Date(datetimeLocal).toISOString();
          if (pendingStatusDialog.kind === "milestone") {
            milestoneAtMut.mutate(
              {
                id: pendingStatusDialog.orderId,
                milestone: pendingStatusDialog.milestone,
                occurred_at
              },
              { onSuccess: () => setPendingStatusDialog(null) }
            );
          } else {
            rowStatusMut.mutate(
              {
                id: pendingStatusDialog.orderId,
                status: pendingStatusDialog.status,
                occurred_at
              },
              { onSuccess: () => setPendingStatusDialog(null) }
            );
          }
        }}
      />

      {tenantSlug ? (
        <OrdersExcelExportDialog
          open={excelExportOpen}
          onOpenChange={setExcelExportOpen}
          tenantSlug={tenantSlug}
          orders={rows}
          visibleColumnOrder={tablePrefs.visibleColumnOrder}
        />
      ) : null}
    </>
  );
}
