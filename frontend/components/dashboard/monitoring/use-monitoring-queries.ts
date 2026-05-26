"use client";

import { buildMonitoringQuery } from "@/components/dashboard/monitoring/build-monitoring-query";
import {
  fetchMonitoringCharts,
  fetchMonitoringSummary,
  fetchMonitoringTables
} from "@/components/dashboard/monitoring/api";
import type { MonitoringDraft, MonitoringSnapshot } from "@/components/dashboard/monitoring/types";
import { STALE } from "@/lib/query-stale";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

export function useMonitoringQueries(opts: {
  tenantSlug: string | null;
  hydrated: boolean;
  applied: MonitoringDraft;
  branchVisible: boolean;
  skuVisible: boolean;
  branchPage: number;
  branchPageSize: number;
  skuPage: number;
  skuPageSize: number;
}) {
  const { tenantSlug, hydrated, applied, branchVisible, skuVisible, branchPage, branchPageSize, skuPage, skuPageSize } =
    opts;

  const queryString = useMemo(() => buildMonitoringQuery(applied), [applied]);

  const summaryQ = useQuery({
    queryKey: ["sales-monitoring", "summary", tenantSlug, queryString],
    enabled: Boolean(tenantSlug) && hydrated,
    staleTime: STALE.report,
    queryFn: () => fetchMonitoringSummary(tenantSlug!, queryString)
  });

  const chartsQ = useQuery({
    queryKey: ["sales-monitoring", "charts", tenantSlug, queryString],
    enabled: Boolean(tenantSlug) && hydrated && summaryQ.isSuccess,
    staleTime: STALE.report,
    queryFn: () => fetchMonitoringCharts(tenantSlug!, queryString)
  });

  const branchTablesQ = useQuery({
    queryKey: ["sales-monitoring", "tables", "branch", tenantSlug, queryString, branchPage, branchPageSize],
    enabled: Boolean(tenantSlug) && hydrated && summaryQ.isSuccess && branchVisible,
    staleTime: STALE.report,
    queryFn: () => fetchMonitoringTables(tenantSlug!, queryString, branchPage + 1, branchPageSize, "branch")
  });

  const skuTablesQ = useQuery({
    queryKey: ["sales-monitoring", "tables", "sku", tenantSlug, queryString, skuPage, skuPageSize],
    enabled: Boolean(tenantSlug) && hydrated && summaryQ.isSuccess && skuVisible,
    staleTime: STALE.report,
    queryFn: () => fetchMonitoringTables(tenantSlug!, queryString, skuPage + 1, skuPageSize, "sku_matrix")
  });

  const merged = useMemo(() => {
    const summary = summaryQ.data;
    const charts = chartsQ.data;
    const branchTables = branchTablesQ.data;
    const skuTables = skuTablesQ.data;
    const isFetching =
      summaryQ.isFetching || chartsQ.isFetching || branchTablesQ.isFetching || skuTablesQ.isFetching;
    const isError = summaryQ.isError || chartsQ.isError || branchTablesQ.isError || skuTablesQ.isError;

    if (!summary?.plan_fact) {
      return {
        data: undefined as MonitoringSnapshot | undefined,
        isLoading: summaryQ.isLoading,
        isFetching,
        isError,
        branchTotal: 0,
        skuTotal: 0
      };
    }

    const data: MonitoringSnapshot = {
      plan_fact: summary.plan_fact,
      summary: summary.summary,
      period: summary.period!,
      akb_okb: summary.akb_okb!,
      portfolio_akb: summary.akb_okb!,
      year_comparison: summary.year_comparison,
      meta: summary.meta,
      category_sales: charts?.category_sales ?? [],
      product_group_sales: charts?.product_group_sales ?? [],
      trade_directions: charts?.trade_directions ?? [],
      daily_sales: charts?.daily_sales ?? [],
      sales_channels: charts?.sales_channels ?? [],
      branch_performance: branchTables?.branch_performance ?? [],
      supervisor_performance: [],
      sku_matrix: skuTables?.sku_matrix ?? [],
      client_daily_sales: []
    };

    return {
      data,
      isLoading: summaryQ.isLoading,
      isFetching,
      isError,
      branchTotal: branchTables?.sku_total ?? data.branch_performance.length,
      skuTotal: skuTables?.sku_total ?? data.sku_matrix.length
    };
  }, [summaryQ, chartsQ, branchTablesQ, skuTablesQ]);

  return {
    queryString,
    summaryQ,
    ...merged
  };
}
