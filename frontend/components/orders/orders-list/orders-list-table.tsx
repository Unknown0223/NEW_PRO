"use client";

import { TableColumnSettingsDialog } from "@/components/data-table/table-column-settings-dialog";
import {
  dataTableStickyActionsThSingle
} from "@/components/data-table/table-row-actions";
import { QueryErrorState } from "@/components/common/query-error-state";
import { OrdersListTableRow } from "@/components/orders/orders-list/orders-list-table-row";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getUserFacingError } from "@/lib/error-utils";
import { formatGroupedInteger, formatNumberGrouped } from "@/lib/format-numbers";
import { downloadXlsxSheet } from "@/lib/download-xlsx";
import {
  ORDER_LIST_COLUMNS,
  orderListExportCell
} from "@/lib/orders-list-columns";
import { cn } from "@/lib/utils";
import { ListOrdered, RefreshCw } from "lucide-react";
import type { UseOrdersListPageResult } from "./use-orders-list-page";

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
  | "ordersViewMode"
  | "expeditorSummaryRows"
  | "orderListTotalPages"
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
  | "prefetchOrderDetail"
>;

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
    ordersViewMode,
    expeditorSummaryRows,
    orderListTotalPages,
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
    prefetchOrderDetail
  } = props;

  const rowStatusPendingId =
    rowStatusMut.isPending && rowStatusMut.variables ? rowStatusMut.variables.id : null;

  const onStatusChange = (id: number, status: string) => {
    rowStatusMut.mutate({ id, status });
  };

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
        <Card className="overflow-hidden rounded-none border-0 bg-transparent shadow-none hover:shadow-none">
          <CardContent className="p-0">
            <div
              className="table-toolbar flex flex-wrap items-end gap-2 border-b border-border/80 bg-muted/30 px-3 py-2 sm:px-4"
              role="toolbar"
              aria-label="Таблица: поиск и экспорт"
            >
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
                  {[15, 20, 30, 50, 100].map((n) => (
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
                disabled={rows.length === 0}
                onClick={() => {
                  const order = tablePrefs.visibleColumnOrder;
                  const headers = order.map(
                    (id) => ORDER_LIST_COLUMNS.find((c) => c.id === id)?.label ?? id
                  );
                  const dataRows = rows.map((o) => order.map((colId) => orderListExportCell(o, colId)));
                  downloadXlsxSheet(
                    `zakazlar_${new Date().toISOString().slice(0, 10)}.xlsx`,
                    "Zakazlar",
                    headers,
                    dataRows
                  );
                }}
              >
                Excel
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 w-9 shrink-0 p-0"
                onClick={() => void refetch()}
              >
                <RefreshCw className="mx-auto h-4 w-4" />
              </Button>
            </div>

            {isLoading ? (
              <p className="px-3 py-6 text-sm text-muted-foreground sm:px-4">Загрузка…</p>
            ) : isError ? (
              <div className="p-4 sm:p-5">
                <QueryErrorState
                  message={getUserFacingError(error, "Zakazlarni yuklab bo'lmadi.")}
                  onRetry={() => void refetch()}
                />
              </div>
            ) : rows.length === 0 ? (
              <p className="px-3 py-6 text-sm text-muted-foreground sm:px-4">
                {data?.total === 0
                  ? "Filtr yoki qidiruv bo‘yicha zakaz topilmadi."
                  : "Hozircha zakaz yo‘q."}
              </p>
            ) : ordersViewMode === "expeditor-summary" ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] border-collapse text-sm">
                  <thead className="app-table-thead">
                    <tr className="text-left">
                      <th className="px-3 py-2">Экспедитор</th>
                      <th className="px-3 py-2 text-right">Накладные</th>
                      <th className="px-3 py-2 text-right">Кол-во</th>
                      <th className="px-3 py-2 text-right">Сумма</th>
                      <th className="px-3 py-2 text-right">Отгружен</th>
                      <th className="px-3 py-2 text-right">Доставлен</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expeditorSummaryRows.map((r) => (
                      <tr key={r.expeditor} className="border-b border-border last:border-0">
                        <td className="px-3 py-2">{r.expeditor}</td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {formatGroupedInteger(r.orders)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {formatNumberGrouped(r.qty, { maxFractionDigits: 3 })}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {formatNumberGrouped(r.total, { maxFractionDigits: 2 })}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {formatGroupedInteger(r.delivering)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {formatGroupedInteger(r.delivered)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[960px] border-collapse text-sm">
                    <thead className="app-table-thead">
                      <tr className="text-left">
                        <th className="w-10 px-3 py-2">
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
                            colId === "total_sum" ||
                            colId === "discount_sum" ||
                            colId === "bonus_qty" ||
                            colId === "balance" ||
                            colId === "debt";
                          return (
                            <th
                              key={colId}
                              className={cn("px-3 py-2", right && "text-right")}
                            >
                              {label}
                            </th>
                          );
                        })}
                        <th className={cn(dataTableStickyActionsThSingle)}>
                          <span className="sr-only">Tafsilot</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((o) => (
                        <OrdersListTableRow
                          key={o.id}
                          order={o}
                          visibleColumnOrder={tablePrefs.visibleColumnOrder}
                          selected={selectedOrderIds.has(o.id)}
                          onToggleSelect={toggleOrderSelect}
                          effectiveRole={effectiveRole}
                          statusRowError={statusRowError}
                          rowStatusPendingId={rowStatusPendingId}
                          onStatusChange={onStatusChange}
                          onPrefetchDetail={prefetchOrderDetail}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
                {data ? (
                  <div className="table-content-footer flex flex-wrap items-center justify-between gap-2 border-t border-border/80 bg-muted/25 px-3 py-3 text-sm sm:px-4">
                    <span className="text-foreground/80">
                      Страница{" "}
                      <span className="font-medium tabular-nums text-foreground">
                        {formatGroupedInteger(Math.min(filters.page, orderListTotalPages))}
                      </span>{" "}
                      /{" "}
                      <span className="tabular-nums text-foreground">
                        {formatGroupedInteger(orderListTotalPages)}
                      </span>
                    </span>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={filters.page <= 1}
                        onClick={() => replaceOrdersQuery({ page: Math.max(1, filters.page - 1) })}
                      >
                        Назад
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={filters.page >= orderListTotalPages}
                        onClick={() => replaceOrdersQuery({ page: filters.page + 1 })}
                      >
                        Далее
                      </Button>
                    </div>
                  </div>
                ) : null}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
