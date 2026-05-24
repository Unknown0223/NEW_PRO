"use client";

import { PageShell } from "@/components/dashboard/page-shell";
import { OrdersBulkToolbar } from "@/components/orders/orders-list/orders-bulk-toolbar";
import { OrdersFiltersPanel } from "@/components/orders/orders-list/orders-filters-panel";
import { OrdersFiltersVisibilityMenu } from "@/components/orders/orders-list/orders-filters-visibility-menu";
import { OrdersListTable } from "@/components/orders/orders-list/orders-list-table";
import { OrdersSelectionTotalsDialog } from "@/components/orders/orders-list/orders-selection-totals-dialog";
import type { UseOrdersListPageResult } from "@/components/orders/orders-list/use-orders-list-page";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import { Card, CardContent } from "@/components/ui/card";
import { DateRangePopover, formatDateRangeButton } from "@/components/ui/date-range-popover";
import { formatNumberGrouped } from "@/lib/format-numbers";
import { cn } from "@/lib/utils";
import { CalendarDays } from "lucide-react";
import Link from "next/link";

export function OrdersPageContent({ page }: { page: UseOrdersListPageResult }) {
  const {
    clientIdFromUrl,
    filters,
    data,
    tenantSlug,
    ordersViewMode,
    setOrdersViewMode,
    replaceOrdersQuery,
    filterPanelRef,
    filterVisibilityOpen,
    setFilterVisibilityOpen,
    filterVisibility,
    setFilterVisibility,
    ordersDateRangeAnchorRef,
    ordersDateRangeOpen,
    setOrdersDateRangeOpen
  } = page;

  return (
    <PageShell>
      {clientIdFromUrl ? (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm shadow-sm">
          <span className="text-xs text-muted-foreground">
            Фильтр: клиент <span className="font-mono font-medium text-foreground">#{clientIdFromUrl}</span>
          </span>
          <Link className="text-xs text-primary underline-offset-2 hover:underline" href="/orders">
            Все заявки
          </Link>
          <Link
            className="text-xs text-primary underline-offset-2 hover:underline"
            href={`/clients/${clientIdFromUrl}`}
          >
            Карточка клиента
          </Link>
        </div>
      ) : null}

      <Card className="orders-hub-section orders-hub-section--filters rounded-none border-0 bg-transparent shadow-none hover:shadow-none">
        <CardContent className="space-y-4 p-4 sm:p-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between xl:gap-6">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-xl font-semibold tracking-tight text-foreground">Заявки</h1>
              {data ? (
                <span className="text-sm text-foreground/75">
                  Всего:{" "}
                  <span className="font-medium text-foreground">
                    {formatNumberGrouped(data.total)}
                  </span>
                </span>
              ) : null}
              <div className="inline-flex rounded-md border border-border bg-background p-0.5">
                <button
                  type="button"
                  className={cn(
                    "rounded px-2 py-1 text-xs",
                    ordersViewMode === "list"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground"
                  )}
                  onClick={() => setOrdersViewMode("list")}
                >
                  Список
                </button>
                <button
                  type="button"
                  className={cn(
                    "rounded px-2 py-1 text-xs",
                    ordersViewMode === "expeditor-summary"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground"
                  )}
                  onClick={() => setOrdersViewMode("expeditor-summary")}
                >
                  Суммарная по экспедиторам
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm font-medium text-foreground xl:flex-1 xl:justify-center">
              <label className="flex cursor-pointer items-center gap-2 whitespace-nowrap">
                <input
                  type="radio"
                  name="orders-date-mode"
                  className="size-4 border-input"
                  checked={filters.date_mode === "order"}
                  onChange={() => replaceOrdersQuery({ date_mode: "order", page: 1 })}
                />
                <span>Дата заказа</span>
              </label>
              <label className="flex cursor-pointer items-center gap-2 whitespace-nowrap">
                <input
                  type="radio"
                  name="orders-date-mode"
                  className="size-4 border-input"
                  checked={filters.date_mode === "ship"}
                  onChange={() => replaceOrdersQuery({ date_mode: "ship", page: 1 })}
                />
                <span>Дата отгрузки</span>
              </label>
              <label className="flex cursor-pointer items-center gap-2 whitespace-nowrap">
                <input
                  type="radio"
                  name="orders-date-mode"
                  className="size-4 border-input"
                  checked={filters.date_mode === "created"}
                  onChange={() => replaceOrdersQuery({ date_mode: "created", page: 1 })}
                />
                <span>Дата создания</span>
              </label>
            </div>

            <div className="flex flex-wrap items-end gap-2 xl:justify-end">
              <OrdersFiltersVisibilityMenu
                filterPanelRef={filterPanelRef}
                filterVisibilityOpen={filterVisibilityOpen}
                setFilterVisibilityOpen={setFilterVisibilityOpen}
                filterVisibility={filterVisibility}
                setFilterVisibility={setFilterVisibility}
              />
              <button
                ref={ordersDateRangeAnchorRef}
                type="button"
                className={cn(
                  buttonVariants({ variant: "outline", size: "sm" }),
                  "h-9 max-w-[min(100%,20rem)] gap-2 font-normal text-foreground",
                  ordersDateRangeOpen && "border-primary/60 bg-primary/5"
                )}
                aria-expanded={ordersDateRangeOpen}
                aria-haspopup="dialog"
                onClick={() => setOrdersDateRangeOpen((o) => !o)}
              >
                <CalendarDays className="h-4 w-4 shrink-0" />
                <span className="truncate text-xs sm:text-sm">
                  {formatDateRangeButton(filters.date_from, filters.date_to)}
                </span>
              </button>
              {tenantSlug ? (
                <Link
                  className={cn(
                    buttonVariants({ size: "sm" }),
                    "h-9 shrink-0 border-0 bg-blue-600 text-white hover:bg-blue-700"
                  )}
                  href="/orders/new"
                >
                  + Создать заказ
                </Link>
              ) : (
                <Button type="button" size="sm" className="h-9 shrink-0" disabled>
                  + Создать заказ
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <OrdersFiltersPanel
        tenantSlug={page.tenantSlug}
        filters={page.filters}
        filterDraft={page.filterDraft}
        setFilterDraft={page.setFilterDraft}
        filterVisibility={page.filterVisibility}
        setFilterVisibility={page.setFilterVisibility}
        filterVisibilityOpen={page.filterVisibilityOpen}
        setFilterVisibilityOpen={page.setFilterVisibilityOpen}
        filterPanelRef={page.filterPanelRef}
        canBulkCatalog={page.canBulkCatalog}
        paymentMethodFilterOpts={page.paymentMethodFilterOpts}
        paymentTypeFilterOpts={page.paymentTypeFilterOpts}
        productCategoriesQ={page.productCategoriesQ}
        productsFilterQ={page.productsFilterQ}
        warehousesQ={page.warehousesQ}
        agentsQ={page.agentsQ}
        expeditorsQ={page.expeditorsQ}
        applyFilterDraft={page.applyFilterDraft}
        resetFilterDraft={page.resetFilterDraft}
        refetch={page.refetch}
      />

      <OrdersListTable
        tenantSlug={page.tenantSlug}
        authHydrated={page.authHydrated}
        filters={page.filters}
        data={page.data}
        isLoading={page.isLoading}
        isError={page.isError}
        error={page.error}
        refetch={page.refetch}
        rows={page.rows}
        ordersViewMode={page.ordersViewMode}
        expeditorSummaryRows={page.expeditorSummaryRows}
        orderListTotalPages={page.orderListTotalPages}
        tablePrefs={page.tablePrefs}
        replaceOrdersQuery={page.replaceOrdersQuery}
        columnDialogOpen={page.columnDialogOpen}
        setColumnDialogOpen={page.setColumnDialogOpen}
        selectedOrderIds={page.selectedOrderIds}
        allOnPageSelected={page.allOnPageSelected}
        toggleOrderSelect={page.toggleOrderSelect}
        toggleSelectAllOnPage={page.toggleSelectAllOnPage}
        effectiveRole={page.effectiveRole}
        statusRowError={page.statusRowError}
        rowStatusMut={page.rowStatusMut}
        prefetchOrderDetail={page.prefetchOrderDetail}
      />

      <OrdersBulkToolbar
        tenantSlug={page.tenantSlug}
        selectedOrderIds={page.selectedOrderIds}
        bulkTargetStatus={page.bulkTargetStatus}
        setBulkTargetStatus={page.setBulkTargetStatus}
        bulkFeedback={page.bulkFeedback}
        setBulkFeedback={page.setBulkFeedback}
        bulkStatusMut={page.bulkStatusMut}
        canBulkCatalog={page.canBulkCatalog}
        bulkExpeditorChoice={page.bulkExpeditorChoice}
        setBulkExpeditorChoice={page.setBulkExpeditorChoice}
        bulkExpeditorMut={page.bulkExpeditorMut}
        bulkExpFeedback={page.bulkExpFeedback}
        setBulkExpFeedback={page.setBulkExpFeedback}
        expeditorsQ={page.expeditorsQ}
        setTotalsDialogOpen={page.setTotalsDialogOpen}
        downloadsOpen={page.downloadsOpen}
        setDownloadsOpen={page.setDownloadsOpen}
        nakladnoyTemplate={page.nakladnoyTemplate}
        setNakladnoyTemplate={page.setNakladnoyTemplate}
        nakladnoyPrefs={page.nakladnoyPrefs}
        setNakladnoyPrefs={page.setNakladnoyPrefs}
        nakladnoySettingsOpen={page.nakladnoySettingsOpen}
        setNakladnoySettingsOpen={page.setNakladnoySettingsOpen}
        nakladnoyFeedback={page.nakladnoyFeedback}
        setNakladnoyFeedback={page.setNakladnoyFeedback}
        nakladnoyMut={page.nakladnoyMut}
        clearSelection={page.clearSelection}
        authHydrated={page.authHydrated}
        paymentPrefill={page.paymentPrefill}
      />

      <OrdersSelectionTotalsDialog
        totalsDialogOpen={page.totalsDialogOpen}
        setTotalsDialogOpen={page.setTotalsDialogOpen}
        selectionTotals={page.selectionTotals}
      />

      <DateRangePopover
        open={page.ordersDateRangeOpen}
        onOpenChange={page.setOrdersDateRangeOpen}
        anchorRef={page.ordersDateRangeAnchorRef}
        dateFrom={page.filters.date_from}
        dateTo={page.filters.date_to}
        onApply={({ dateFrom, dateTo }) => {
          page.replaceOrdersQuery({ date_from: dateFrom, date_to: dateTo, page: 1 });
        }}
      />
    </PageShell>
  );
}
