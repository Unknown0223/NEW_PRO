"use client";

import { PageShell } from "@/components/dashboard/page-shell";
import { decodeAccessTokenSub } from "@/components/dashboard/sales/auth-utils";
import { defaultSalesDraft, SalesFiltersBar } from "@/components/dashboard/sales/sales-filters-bar";
import { SalesDashboardBody } from "@/components/dashboard/sales/sales-dashboard-body";
import { createSalesExportHandlers, salesExportPrefix } from "@/components/dashboard/sales/sales-export";
import { SalesDashboardKpiSkeleton } from "@/components/dashboard/sales/sales-dashboard-kpi-skeleton";
import { SalesDashboardTableSkeleton } from "@/components/dashboard/sales/sales-dashboard-table-skeleton";
import type { QuickRangeKey, SalesFilterDraft } from "@/components/dashboard/sales/types";
import { useSalesQueries } from "@/components/dashboard/sales/use-sales-queries";
import { useSalesPaymentDisplay } from "@/components/dashboard/sales/use-sales-payment-display";
import { useAuthStore, useAuthStoreHydrated, useEffectiveRole } from "@/lib/auth-store";
import { createTerritoryLabelResolver } from "@/lib/territory-filter-labels";
import { useDashboardMeta } from "@/lib/use-dashboard-meta";
import { useDashboardSectionVisible } from "@/hooks/use-dashboard-section-visible";
import { useEffect, useMemo, useState } from "react";

export function DashboardSales() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const tenantSlug = useAuthStore((s) => s.tenantSlug);
  const role = useEffectiveRole();
  const hydrated = useAuthStoreHydrated();
  const selfSupervisorId = useMemo(
    () => (role === "supervisor" ? decodeAccessTokenSub(accessToken) : null),
    [role, accessToken]
  );
  const selfSupervisorIdStr = selfSupervisorId != null ? String(selfSupervisorId) : "";

  const [draft, setDraft] = useState<SalesFilterDraft>(() => defaultSalesDraft());
  const [applied, setApplied] = useState<SalesFilterDraft>(() => defaultSalesDraft());
  const [quickRange, setQuickRange] = useState<QuickRangeKey>("last30");

  const analyticsSection = useDashboardSectionVisible({
    enabled: Boolean(tenantSlug) && hydrated
  });
  const breakdownSection = useDashboardSectionVisible({
    enabled: Boolean(tenantSlug) && hydrated
  });

  useEffect(() => {
    if (!selfSupervisorIdStr) return;
    const patch = (prev: SalesFilterDraft) =>
      prev.supervisor_ids.length === 1 && prev.supervisor_ids[0] === selfSupervisorIdStr
        ? prev
        : { ...prev, supervisor_ids: [selfSupervisorIdStr] };
    setDraft(patch);
    setApplied(patch);
  }, [selfSupervisorIdStr]);

  const {
    supervisors,
    clientRefs,
    profileRefs,
    productCategories,
    catalogBrands,
    catalogGroups,
    catalogManufacturers,
    reportFilters: reportFiltersRaw
  } = useDashboardMeta(tenantSlug, hydrated);

  const { data, isLoading, isFetching, isError } = useSalesQueries({
    tenantSlug,
    hydrated,
    applied,
    analyticsVisible: analyticsSection.visible,
    breakdownVisible: breakdownSection.visible,
    agentPage: 1,
    agentPageSize: 200
  });

  const resolvePayment = useSalesPaymentDisplay(profileRefs?.payment_method_entries);
  const resolveTerritoryDisplay = useMemo(
    () =>
      createTerritoryLabelResolver({
        zones: clientRefs?.zones,
        region_options: clientRefs?.region_options,
        city_options: clientRefs?.city_options,
        city_territory_hints: clientRefs?.city_territory_hints,
        territory_nodes: profileRefs?.territory_nodes
      }),
    [clientRefs, profileRefs?.territory_nodes]
  );

  const applyFilters = () => {
    setApplied({
      ...draft,
      supervisor_ids: selfSupervisorIdStr ? [selfSupervisorIdStr] : draft.supervisor_ids
    });
  };

  const resetFilters = () => {
    const fresh = defaultSalesDraft(selfSupervisorIdStr);
    setDraft(fresh);
    setApplied(fresh);
    setQuickRange("last30");
  };

  const exportPrefix = useMemo(() => salesExportPrefix(applied), [applied]);
  const exporters = useMemo(
    () =>
      data
        ? createSalesExportHandlers(data, exportPrefix, {
            resolvePayment,
            resolveTerritory: resolveTerritoryDisplay
          })
        : null,
    [data, exportPrefix, resolvePayment, resolveTerritoryDisplay]
  );

  const exportBtn = (
    <button
      type="button"
      className="inline-flex h-12 shrink-0 items-center rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
      disabled={!exporters}
      onClick={() => exporters && void exporters.all()}
    >
      Excel
    </button>
  );

  return (
    <PageShell>
      {!hydrated ? (
        <p className="text-sm text-muted-foreground">Загрузка сессии…</p>
      ) : !tenantSlug ? (
        <p className="text-sm text-destructive">Сессия не найдена. Войдите заново.</p>
      ) : (
        <div className="mx-auto max-w-[1680px] space-y-4">
          <SalesFiltersBar
            draft={draft}
            setDraft={setDraft}
            onApply={applyFilters}
            onReset={resetFilters}
            selfSupervisorIdStr={selfSupervisorIdStr}
            supervisors={supervisors}
            clientRefs={clientRefs}
            profileRefs={profileRefs}
            reportFilters={reportFiltersRaw as never}
            productCategories={productCategories}
            catalogManufacturers={catalogManufacturers}
            catalogGroups={catalogGroups}
            catalogBrands={catalogBrands}
            quickRange={quickRange}
            setQuickRange={setQuickRange}
            exportAction={exportBtn}
          />

          {isError ? (
            <p className="text-sm text-destructive">Не удалось загрузить дашборд продаж.</p>
          ) : null}

          {isLoading ? (
            <>
              <SalesDashboardKpiSkeleton cards={4} />
              <div className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_480px]">
                <SalesDashboardTableSkeleton rows={6} />
                <SalesDashboardTableSkeleton rows={4} />
              </div>
            </>
          ) : null}

          {data ? (
            <>
              {isFetching && !isLoading ? (
                <p className="text-xs font-medium text-teal-700">Обновление данных…</p>
              ) : null}
              <SalesDashboardBody
                data={data}
                resolvePayment={resolvePayment}
                resolveTerritory={resolveTerritoryDisplay}
                exporters={exporters}
                analyticsRef={analyticsSection.ref}
                breakdownRef={breakdownSection.ref}
              />
            </>
          ) : null}
        </div>
      )}
    </PageShell>
  );
}
