"use client";



import { PageShell } from "@/components/dashboard/page-shell";

import { OrdersBulkToolbar } from "@/components/orders/orders-list/orders-bulk-toolbar";

import { OrdersFiltersPanel } from "@/components/orders/orders-list/orders-filters-panel";

import { OrdersListTable } from "@/components/orders/orders-list/orders-list-table";

import { OrdersSelectionTotalsDialog } from "@/components/orders/orders-list/orders-selection-totals-dialog";

import type { UseOrdersListPageResult } from "@/components/orders/orders-list/use-orders-list-page";

import Link from "next/link";



export function OrdersPageContent({ page }: { page: UseOrdersListPageResult }) {

  const { clientIdFromUrl, data } = page;



  const hasSelection = page.selectedOrderIds.size > 0;

  return (

    <PageShell className={hasSelection ? "pb-24" : undefined}>

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



      <OrdersFiltersPanel

        tenantSlug={page.tenantSlug}

        filters={page.filters}

        filterDraft={page.filterDraft}

        setFilterDraft={page.setFilterDraft}

        filterVisibility={page.filterVisibility}

        setFilterVisibility={page.setFilterVisibility}

        filterVisibilityOpen={page.filterVisibilityOpen}

        setFilterVisibilityOpen={page.setFilterVisibilityOpen}

        canBulkCatalog={page.canBulkCatalog}

        paymentMethodFilterOpts={page.paymentMethodFilterOpts}

        paymentTypeFilterOpts={page.paymentTypeFilterOpts}

        nakladnoyTypeFilterOpts={page.nakladnoyTypeFilterOpts}

        clientCategoryFilterOpts={page.clientCategoryFilterOpts}

        tradeDirectionFilterOpts={page.tradeDirectionFilterOpts}

        priceTypeFilterOpts={page.priceTypeFilterOpts}

        buildTerritoryCascade={page.buildTerritoryCascade}

        productCategoriesQ={page.productCategoriesQ}

        productsFilterQ={page.productsFilterQ}

        warehousesQ={page.warehousesQ}

        agentsQ={page.agentsQ}

        expeditorsQ={page.expeditorsQ}

        applyFilterDraft={page.applyFilterDraft}

        resetFilterDraft={page.resetFilterDraft}

        refetch={page.refetch}

        ordersTotal={data?.total}

        ordersDateRangeAnchorRef={page.ordersDateRangeAnchorRef}

        ordersDateRangeOpen={page.ordersDateRangeOpen}

        setOrdersDateRangeOpen={page.setOrdersDateRangeOpen}

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

        milestoneAtMut={page.milestoneAtMut}

        prefetchOrderDetail={page.prefetchOrderDetail}

      />

      <OrdersBulkToolbar
        tenantSlug={page.tenantSlug}
        selectedOrderIds={page.selectedOrderIds}
        selectedRows={page.selectedRows}
        tablePrefs={page.tablePrefs}
        bulkFeedback={page.bulkFeedback}
        setBulkFeedback={page.setBulkFeedback}
        bulkStatusMut={page.bulkStatusMut}
        bulkExpeditorMut={page.bulkExpeditorMut}
        bulkExpFeedback={page.bulkExpFeedback}
        setBulkExpFeedback={page.setBulkExpFeedback}
        bulkConsignmentMut={page.bulkConsignmentMut}
        bulkConsignmentFeedback={page.bulkConsignmentFeedback}
        canBulkCatalog={page.canBulkCatalog}
        totalsPanelOpen={page.totalsPanelOpen}
        setTotalsPanelOpen={page.setTotalsPanelOpen}
        nakladnoyTemplate={page.nakladnoyTemplate}
        setNakladnoyTemplate={page.setNakladnoyTemplate}
        nakladnoyPrefs={page.nakladnoyPrefs}
        setNakladnoyPrefs={page.setNakladnoyPrefs}
        nakladnoyMut={page.nakladnoyMut}
        nakladnoyFeedback={page.nakladnoyFeedback}
        setNakladnoyFeedback={page.setNakladnoyFeedback}
        clearSelection={page.clearSelection}
        authHydrated={page.authHydrated}
        paymentPrefill={page.paymentPrefill}
        expeditorsQ={page.expeditorsQ}
      />

      <OrdersSelectionTotalsDialog
        totalsPanelOpen={page.totalsPanelOpen}
        setTotalsPanelOpen={page.setTotalsPanelOpen}
        selectionTotals={page.selectionTotals}
        tenantSlug={page.tenantSlug}
        selectedOrderIds={page.selectedOrderIds}
      />

    </PageShell>

  );

}


