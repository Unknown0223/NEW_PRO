"use client";

import { PageShell } from "@/components/dashboard/page-shell";
import { toDonutSlices } from "@/components/dashboard/monitoring/donut-slices";
import { MonitoringDashboardBody } from "@/components/dashboard/monitoring/monitoring-dashboard-body";
import { MonitoringFiltersBar } from "@/components/dashboard/monitoring/monitoring-filters-bar";
import {
  MONITORING_SECTION_DEFAULT_ORDER,
  MONITORING_SECTION_PREFS_TABLE_ID,
  hiddenMonitoringSectionIds,
  visibleMonitoringSections,
  type MonitoringSectionId
} from "@/components/dashboard/monitoring/monitoring-section-config";
import { territoryTreeIdsToFilterLists } from "@/components/dashboard/monitoring/monitoring-territory-tree-utils";
import {
  MON_BRANCH_COLS,
  MON_BRANCH_DEFAULT_ORDER,
  MON_BRANCH_TABLE_ID,
  MON_SKU_COLS,
  MON_SKU_DEFAULT_ORDER,
  MON_SKU_TABLE_ID
} from "@/components/dashboard/monitoring/table-constants";
import type { MonitoringDraft } from "@/components/dashboard/monitoring/types";
import { useMonitoringQueries } from "@/components/dashboard/monitoring/use-monitoring-queries";
import { decodeAccessTokenSub, defaultMonitoringDraft, num } from "@/components/dashboard/monitoring/utils";
import { SalesMonitoringFiltersSkeleton } from "@/components/dashboard/sales-monitoring/sales-monitoring-filters-skeleton";
import { SalesMonitoringKpiSkeleton } from "@/components/dashboard/sales-monitoring/sales-monitoring-kpi-skeleton";
import { TableColumnSettingsDialog } from "@/components/data-table/table-column-settings-dialog";
import { useAuthStore, useAuthStoreHydrated, useEffectiveRole } from "@/lib/auth-store";
import { useDashboardMeta } from "@/lib/use-dashboard-meta";
import { staffDashboardMultiItem } from "@/lib/order-picker-labels";
import { useDashboardSectionVisible } from "@/hooks/use-dashboard-section-visible";
import { useUserTablePrefs } from "@/hooks/use-user-table-prefs";
import { useCallback, useEffect, useMemo, useState } from "react";

export function DashboardSalesMonitoring() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const tenantSlug = useAuthStore((s) => s.tenantSlug);
  const role = useEffectiveRole();
  const hydrated = useAuthStoreHydrated();
  const selfSupervisorIdStr = useMemo(() => {
    const id = role === "supervisor" ? decodeAccessTokenSub(accessToken) : null;
    return id != null ? String(id) : "";
  }, [role, accessToken]);

  const [applied, setApplied] = useState<MonitoringDraft>(() => defaultMonitoringDraft());

  const [branchPage, setBranchPage] = useState(0);
  const [branchPageSize, setBranchPageSize] = useState(20);
  const [skuPage, setSkuPage] = useState(0);
  const [skuPageSize, setSkuPageSize] = useState(20);

  const [branchColumnsOpen, setBranchColumnsOpen] = useState(false);
  const [skuColumnsOpen, setSkuColumnsOpen] = useState(false);

  const branchTablePrefs = useUserTablePrefs({
    tenantSlug,
    tableId: MON_BRANCH_TABLE_ID,
    defaultColumnOrder: MON_BRANCH_DEFAULT_ORDER,
    defaultPageSize: 20,
    allowedPageSizes: [10, 20, 50]
  });
  const skuTablePrefs = useUserTablePrefs({
    tenantSlug,
    tableId: MON_SKU_TABLE_ID,
    defaultColumnOrder: MON_SKU_DEFAULT_ORDER,
    defaultPageSize: 20,
    allowedPageSizes: [10, 20, 50]
  });

  const sectionPrefs = useUserTablePrefs({
    tenantSlug,
    tableId: MONITORING_SECTION_PREFS_TABLE_ID,
    defaultColumnOrder: MONITORING_SECTION_DEFAULT_ORDER
  });

  useEffect(() => {
    if (!selfSupervisorIdStr) return;
    const patch = (p: MonitoringDraft) =>
      p.supervisor_ids.length === 1 && p.supervisor_ids[0] === selfSupervisorIdStr
        ? p
        : { ...p, supervisor_ids: [selfSupervisorIdStr] };
    setApplied(patch);
  }, [selfSupervisorIdStr]);

  const { agents, supervisors, profileRefs } = useDashboardMeta(tenantSlug, hydrated);
  const territoryNodes = profileRefs?.territory_nodes ?? [];

  const visibleSectionIds = useMemo(
    () => visibleMonitoringSections(sectionPrefs.hiddenColumnIds),
    [sectionPrefs.hiddenColumnIds]
  );

  const sectionVisible = (id: MonitoringSectionId) => visibleSectionIds.has(id);

  const branchSection = useDashboardSectionVisible({ enabled: Boolean(tenantSlug) && hydrated });
  const skuSection = useDashboardSectionVisible({ enabled: Boolean(tenantSlug) && hydrated });

  const { data, isLoading, isError, branchTotal, skuTotal, queryString } = useMonitoringQueries({
    tenantSlug,
    hydrated,
    applied,
    branchVisible: branchSection.visible && sectionVisible("byBranches"),
    skuVisible: skuSection.visible && sectionVisible("bySku"),
    branchPage,
    branchPageSize,
    skuPage,
    skuPageSize
  });

  useEffect(() => {
    setBranchPage(0);
    setSkuPage(0);
  }, [queryString]);

  const filterOptions = useMemo(
    () => ({
      branchOptions: (data?.meta?.branch_options ?? []).map((b) => ({ value: b, label: b })),
      agentOptions: (agents ?? []).map((a) => staffDashboardMultiItem(a)),
      supervisorOptions: (supervisors ?? []).map((s) => staffDashboardMultiItem(s))
    }),
    [data?.meta?.branch_options, agents, supervisors]
  );

  const categorySlices = useMemo(() => {
    const rows = (data?.category_sales ?? [])
      .map((r) => ({
        name: r.category,
        value: num(r.sales_sum),
        share_pct: r.share_pct,
        orders_count: r.orders_count,
        line_qty: r.line_qty != null ? num(r.line_qty) : undefined
      }))
      .sort((a, b) => b.value - a.value);
    return toDonutSlices(rows, 8, "Прочие категории");
  }, [data?.category_sales]);

  const buildAppliedFromDraft = useCallback(
    (source: MonitoringDraft): MonitoringDraft => {
      const lists = territoryTreeIdsToFilterLists(territoryNodes, source.territory_tree_node_ids);
      return {
        ...source,
        ...lists,
        territory_ids: []
      };
    },
    [territoryNodes]
  );

  const apply = useCallback(
    (draft: MonitoringDraft) => setApplied(buildAppliedFromDraft(draft)),
    [buildAppliedFromDraft]
  );

  const onVisibleSectionsChange = useCallback(
    (next: Set<MonitoringSectionId>) => {
      void sectionPrefs.saveColumnLayout({
        columnOrder: [...sectionPrefs.columnOrder],
        hiddenColumnIds: hiddenMonitoringSectionIds(next)
      });
    },
    [sectionPrefs]
  );

  return (
    <PageShell>
      {!hydrated ? (
        <p className="text-sm text-muted-foreground">Загрузка сессии…</p>
      ) : !tenantSlug ? (
        <p className="text-sm text-destructive">Сессия не найдена.</p>
      ) : (
        <div className="flex flex-col gap-6">
          <TableColumnSettingsDialog
            open={branchColumnsOpen}
            onOpenChange={setBranchColumnsOpen}
            title="Столбцы"
            columns={[...MON_BRANCH_COLS]}
            columnOrder={branchTablePrefs.columnOrder}
            hiddenColumnIds={branchTablePrefs.hiddenColumnIds}
            saving={branchTablePrefs.saving}
            onSave={(n) => branchTablePrefs.saveColumnLayout(n)}
            onReset={() => branchTablePrefs.resetColumnLayout()}
          />
          <TableColumnSettingsDialog
            open={skuColumnsOpen}
            onOpenChange={setSkuColumnsOpen}
            title="Столбцы"
            columns={[...MON_SKU_COLS]}
            columnOrder={skuTablePrefs.columnOrder}
            hiddenColumnIds={skuTablePrefs.hiddenColumnIds}
            saving={skuTablePrefs.saving}
            onSave={(n) => skuTablePrefs.saveColumnLayout(n)}
            onReset={() => skuTablePrefs.resetColumnLayout()}
          />

          <MonitoringFiltersBar
            appliedDraft={applied}
            onApply={apply}
            territoryNodes={territoryNodes}
            visibleSectionIds={visibleSectionIds}
            onVisibleSectionsChange={onVisibleSectionsChange}
            branchOptions={filterOptions.branchOptions}
            agentOptions={filterOptions.agentOptions}
          />

          {isLoading ? <SalesMonitoringKpiSkeleton cards={3} /> : null}
          {isError ? <p className="text-sm text-destructive">Не удалось загрузить мониторинг.</p> : null}

          {data ? (
            <MonitoringDashboardBody
              data={data}
              appliedMonth={applied.month}
              appliedYear={applied.year}
              categorySlices={categorySlices}
              branchTotal={branchTotal}
              branchPage={branchPage}
              branchPageSize={branchPageSize}
              onBranchPageChange={setBranchPage}
              onBranchPageSizeChange={(s) => {
                setBranchPageSize(s);
                setBranchPage(0);
              }}
              skuTotal={skuTotal}
              skuPage={skuPage}
              skuPageSize={skuPageSize}
              onSkuPageChange={setSkuPage}
              onSkuPageSizeChange={(s) => {
                setSkuPageSize(s);
                setSkuPage(0);
              }}
              skuRows={data.sku_matrix}
              skuVisibleColumnOrder={skuTablePrefs.visibleColumnOrder}
              onOpenSkuColumns={() => setSkuColumnsOpen(true)}
              visibleSectionIds={visibleSectionIds}
            />
          ) : !isLoading ? (
            <SalesMonitoringFiltersSkeleton />
          ) : null}
        </div>
      )}
    </PageShell>
  );
}
