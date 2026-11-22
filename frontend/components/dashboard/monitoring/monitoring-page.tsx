"use client";

import { PageShell } from "@/components/dashboard/page-shell";
import { MonitoringFiltersBar } from "@/components/dashboard/monitoring/monitoring-filters-bar";
import {
  MONITORING_SECTION_DEFAULT_ORDER,
  MONITORING_SECTION_PREFS_TABLE_ID,
  hiddenMonitoringSectionIds,
  visibleMonitoringSections,
  type MonitoringSectionId
} from "@/components/dashboard/monitoring/monitoring-section-config";
import { territoryTreeIdsToFilterLists } from "@/components/dashboard/monitoring/monitoring-territory-tree-utils";
import type { MonitoringDraft } from "@/components/dashboard/monitoring/types";
import { useMonitoringQueries } from "@/components/dashboard/monitoring/use-monitoring-queries";
import { decodeAccessTokenSub, defaultMonitoringDraft } from "@/components/dashboard/monitoring/utils";
import { salesMonthLabel } from "@/components/dashboard/sales-monitoring/pro/sales-pro-format";
import { SalesProPage } from "@/components/dashboard/sales-monitoring/pro/sales-pro-page";
import { buildSalesProUiModel } from "@/components/dashboard/sales-monitoring/sales-ui-model";
import { SalesMonitoringFiltersSkeleton } from "@/components/dashboard/sales-monitoring/sales-monitoring-filters-skeleton";
import { SalesMonitoringKpiSkeleton } from "@/components/dashboard/sales-monitoring/sales-monitoring-kpi-skeleton";
import { useAuthStore, useAuthStoreHydrated, useEffectiveRole } from "@/lib/auth-store";
import { useDashboardMeta } from "@/lib/use-dashboard-meta";
import { staffDashboardMultiItem } from "@/lib/order-picker-labels";
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
  const [branchPage] = useState(0);
  const [branchPageSize] = useState(200);
  const [skuPage] = useState(0);
  const [skuPageSize] = useState(20);

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
  const territoryNodes = useMemo(() => profileRefs?.territory_nodes ?? [], [profileRefs?.territory_nodes]);

  const visibleSectionIds = useMemo(
    () => visibleMonitoringSections(sectionPrefs.hiddenColumnIds),
    [sectionPrefs.hiddenColumnIds]
  );

  const { data, isLoading, isFetching, isError, queryString } = useMonitoringQueries({
    tenantSlug,
    hydrated,
    applied,
    branchVisible: true,
    skuVisible: false,
    branchPage,
    branchPageSize,
    skuPage,
    skuPageSize
  });

  const filterOptions = useMemo(
    () => ({
      branchOptions: (data?.meta?.branch_options ?? []).map((b) => ({ value: b, label: b })),
      agentOptions: (agents ?? []).map((a) => staffDashboardMultiItem(a)),
      supervisorOptions: (supervisors ?? []).map((s) => staffDashboardMultiItem(s))
    }),
    [data?.meta?.branch_options, agents, supervisors]
  );

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

  const proModel = useMemo(() => buildSalesProUiModel(data ?? null), [data]);
  const monthLabel = salesMonthLabel(applied.month, applied.year);

  return (
    <PageShell>
      {!hydrated ? (
        <p className="text-sm text-muted-foreground">Загрузка сессии…</p>
      ) : !tenantSlug ? (
        <p className="text-sm text-destructive">Сессия не найдена.</p>
      ) : (
        <div className="flex min-w-0 flex-col gap-6">
          <MonitoringFiltersBar
            appliedDraft={applied}
            onApply={apply}
            territoryNodes={territoryNodes}
            visibleSectionIds={visibleSectionIds}
            onVisibleSectionsChange={onVisibleSectionsChange}
            branchOptions={filterOptions.branchOptions}
            agentOptions={filterOptions.agentOptions}
          />

          {isLoading ? <SalesMonitoringKpiSkeleton cards={4} /> : null}
          {isError ? <p className="text-sm text-destructive">Не удалось загрузить мониторинг.</p> : null}

          {data ? (
            <SalesProPage
              key={monthLabel}
              model={proModel}
              loading={isFetching}
              monthLabel={monthLabel}
            />
          ) : !isLoading ? (
            <SalesMonitoringFiltersSkeleton />
          ) : null}
        </div>
      )}
    </PageShell>
  );
}
