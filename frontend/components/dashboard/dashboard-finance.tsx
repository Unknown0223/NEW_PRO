"use client";

import { PageShell } from "@/components/dashboard/page-shell";
import { FinanceBalanceSection } from "@/components/dashboard/finance/finance-balance-section";
import { FinanceCategoryChart } from "@/components/dashboard/finance/finance-category-chart";
import { FinanceClientLedger } from "@/components/dashboard/finance/finance-client-ledger";
import {
  FinanceDataTable,
  categoryTableColumns,
  territoryTableColumns
} from "@/components/dashboard/finance/finance-data-table";
import { FinanceDebtChart } from "@/components/dashboard/finance/finance-debt-chart";
import {
  buildCategoryTotalsRow,
  buildTerritoryTotalsRow
} from "@/components/dashboard/finance/finance-export";
import {
  FinanceFiltersBar,
  defaultFinanceDraft,
  type QuickRangeKey
} from "@/components/dashboard/finance/finance-filters-bar";
import { FinanceKpiSection } from "@/components/dashboard/finance/finance-kpi-section";
import { FinancePeriodChart } from "@/components/dashboard/finance/finance-period-chart";
import { FinanceSummaryStrip } from "@/components/dashboard/finance/finance-summary-strip";
import { FinanceDashboardKpiSkeleton } from "@/components/dashboard/finance/finance-dashboard-kpi-skeleton";
import { FinanceDashboardTableSkeleton } from "@/components/dashboard/finance/finance-dashboard-table-skeleton";
import { useFinanceQueries } from "@/components/dashboard/finance/use-finance-queries";
import type { FinanceFilterDraft } from "@/components/dashboard/finance/types";
import { useAuthStore, useAuthStoreHydrated, useEffectiveRole } from "@/lib/auth-store";
import { createTerritoryLabelResolver } from "@/lib/territory-filter-labels";
import { useDashboardMeta } from "@/lib/use-dashboard-meta";
import { useUserTablePrefs } from "@/hooks/use-user-table-prefs";
import { useDashboardSectionVisible } from "@/hooks/use-dashboard-section-visible";
import { useEffect, useMemo, useState } from "react";

const CLIENTS_TABLE_ID = "dashboard-finance/clients-debt-list";
const CLIENTS_DEFAULT_ORDER = ["client", "agent", "supervisor", "ledger_balance", "delivered_debt", "effective_balance"];

function decodeAccessTokenSub(accessToken: string | null | undefined): number | null {
  if (!accessToken) return null;
  try {
    const parts = accessToken.split(".");
    if (parts.length < 2) return null;
    const payload = parts[1]!;
    const b64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64.length % 4;
    const padded = pad ? b64 + "=".repeat(4 - pad) : b64;
    const json = JSON.parse(atob(padded)) as { sub?: unknown };
    const id = Number.parseInt(String(json.sub ?? ""), 10);
    return Number.isFinite(id) && id > 0 ? id : null;
  } catch {
    return null;
  }
}

export function DashboardFinance() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const tenantSlug = useAuthStore((s) => s.tenantSlug);
  const role = useEffectiveRole();
  const hydrated = useAuthStoreHydrated();
  const selfSupervisorId = useMemo(
    () => (role === "supervisor" ? decodeAccessTokenSub(accessToken) : null),
    [role, accessToken]
  );
  const selfSupervisorIdStr = selfSupervisorId != null ? String(selfSupervisorId) : "";

  const [draft, setDraft] = useState<FinanceFilterDraft>(() => defaultFinanceDraft());
  const [applied, setApplied] = useState<FinanceFilterDraft>(() => defaultFinanceDraft());
  const [quickRange, setQuickRange] = useState<QuickRangeKey>("last30");
  const [clientsPage, setClientsPage] = useState(1);

  const ledgerSection = useDashboardSectionVisible({
    enabled: Boolean(tenantSlug) && hydrated
  });

  const clientsTablePrefs = useUserTablePrefs({
    tenantSlug,
    tableId: CLIENTS_TABLE_ID,
    defaultColumnOrder: CLIENTS_DEFAULT_ORDER,
    defaultPageSize: 10,
    allowedPageSizes: [10, 20, 30, 50, 100, 200]
  });

  useEffect(() => {
    if (!selfSupervisorIdStr) return;
    const patch = (prev: FinanceFilterDraft) =>
      prev.supervisor_ids.length === 1 && prev.supervisor_ids[0] === selfSupervisorIdStr
        ? prev
        : { ...prev, supervisor_ids: [selfSupervisorIdStr] };
    setDraft(patch);
    setApplied(patch);
  }, [selfSupervisorIdStr]);

  useEffect(() => {
    setClientsPage(1);
  }, [clientsTablePrefs.pageSize, applied]);

  const {
    agents,
    supervisors,
    clientRefs,
    profileRefs,
    reportFilters: reportFiltersRaw,
    productCategories
  } = useDashboardMeta(tenantSlug, hydrated);

  const { data, isLoading, isFetching, isError, clientsTotal } = useFinanceQueries({
    tenantSlug,
    hydrated,
    applied,
    clientsPage,
    clientsPageSize: clientsTablePrefs.pageSize,
    ledgerVisible: ledgerSection.visible
  });

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
    setClientsPage(1);
  };

  const resetFilters = () => {
    const fresh = defaultFinanceDraft(selfSupervisorIdStr);
    setDraft(fresh);
    setApplied(fresh);
    setQuickRange("last30");
    setClientsPage(1);
  };

  const categoryCols = useMemo(() => categoryTableColumns(), []);
  const territoryCols = useMemo(() => territoryTableColumns(resolveTerritoryDisplay), [resolveTerritoryDisplay]);
  const categoryTotals = useMemo(() => (data ? buildCategoryTotalsRow(data) : undefined), [data]);
  const territoryTotals = useMemo(() => (data ? buildTerritoryTotalsRow(data) : undefined), [data]);

  return (
    <PageShell>
      {!hydrated ? (
        <p className="text-sm text-muted-foreground">Загрузка сессии…</p>
      ) : !tenantSlug ? (
        <p className="text-sm text-destructive">Сессия не найдена. Войдите заново.</p>
      ) : (
        <div className="flex flex-col gap-6">
          <FinanceFiltersBar
            draft={draft}
            setDraft={setDraft}
            onApply={applyFilters}
            onReset={resetFilters}
            selfSupervisorIdStr={selfSupervisorIdStr}
            agents={agents}
            supervisors={supervisors}
            clientRefs={clientRefs}
            profileRefs={profileRefs}
            reportFilters={reportFiltersRaw as never}
            productCategories={productCategories}
            quickRange={quickRange}
            setQuickRange={setQuickRange}
          />

          {isError ? <p className="text-sm text-destructive">Не удалось загрузить финансовый дашборд.</p> : null}

          {isLoading ? (
            <>
              <FinanceDashboardKpiSkeleton cards={5} />
              <div className="grid gap-6 xl:grid-cols-12">
                <div className="xl:col-span-7">
                  <FinanceDashboardTableSkeleton rows={4} />
                </div>
                <div className="xl:col-span-5">
                  <FinanceDashboardTableSkeleton rows={4} />
                </div>
              </div>
            </>
          ) : null}

          {data ? (
            <>
              {isFetching && !isLoading ? (
                <p className="text-xs font-medium text-teal-700">Обновление данных…</p>
              ) : null}

              <FinanceSummaryStrip summary={data.summary} />

              <FinanceKpiSection data={data} />
              <FinanceBalanceSection data={data} />

              <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
                <div className="min-w-0 xl:col-span-7">
                  <FinanceCategoryChart data={data} />
                </div>
                <div className="min-w-0 xl:col-span-5">
                  <FinanceDebtChart debtRatioPct={data.summary.debt_ratio_pct} />
                </div>
              </div>

              <FinancePeriodChart data={data} />

              <FinanceDataTable
                title="По категориям"
                subtitle={
                  applied.payment_types.length > 0
                    ? "Суммы по выбранным способам оплаты"
                    : "Общая сумма по категории"
                }
                data={data.category_analytics}
                columns={categoryCols}
                totals={categoryTotals}
                searchKeys={[(row) => row.category]}
                exportFileName="finance-categories.csv"
                minWidth={720}
              />

              <FinanceDataTable
                title="Долги по территориям"
                subtitle="Агрегация задолженности"
                data={data.territory_debts}
                columns={territoryCols}
                totals={territoryTotals}
                searchKeys={[(row) => resolveTerritoryDisplay(row.territory)]}
                exportFileName="territory-debt.csv"
                minWidth={640}
              />

              <div ref={ledgerSection.ref}>
                <FinanceClientLedger
                  rows={data.clients_debt_list}
                  total={clientsTotal}
                  page={clientsPage}
                  pageSize={clientsTablePrefs.pageSize}
                  onPageChange={setClientsPage}
                  onPageSizeChange={(size) => {
                    clientsTablePrefs.setPageSize(size);
                    setClientsPage(1);
                  }}
                  columnOrder={clientsTablePrefs.columnOrder}
                  hiddenColumnIds={clientsTablePrefs.hiddenColumnIds}
                  onSaveColumns={(next) => clientsTablePrefs.saveColumnLayout(next)}
                  onResetColumns={() => clientsTablePrefs.resetColumnLayout()}
                  columnsSaving={clientsTablePrefs.saving}
                  isFetching={isFetching}
                />
              </div>
            </>
          ) : null}
        </div>
      )}
    </PageShell>
  );
}
