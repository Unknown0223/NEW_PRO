"use client";

import { buildSalesQueryString } from "@/components/dashboard/sales/build-sales-query";
import type {
  SalesAnalyticsPayload,
  SalesBreakdownPayload,
  SalesDashboardSnapshot,
  SalesFilterDraft,
  SalesSummaryPayload
} from "@/components/dashboard/sales/types";
import { api } from "@/lib/api";
import { STALE } from "@/lib/query-stale";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

type UseSalesQueriesArgs = {
  tenantSlug: string | null;
  hydrated: boolean;
  applied: SalesFilterDraft;
  analyticsVisible: boolean;
  breakdownVisible: boolean;
  agentPage: number;
  agentPageSize: number;
};

export function useSalesQueries({
  tenantSlug,
  hydrated,
  applied,
  analyticsVisible,
  breakdownVisible,
  agentPage,
  agentPageSize
}: UseSalesQueriesArgs) {
  const queryString = useMemo(() => buildSalesQueryString(applied), [applied]);
  const breakdownQueryString = useMemo(
    () => buildSalesQueryString(applied, { page: agentPage, limit: agentPageSize }),
    [applied, agentPage, agentPageSize]
  );

  const summaryQ = useQuery({
    queryKey: ["dashboard-sales", "summary", tenantSlug, queryString],
    enabled: Boolean(tenantSlug) && hydrated,
    staleTime: STALE.report,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: 1,
    queryFn: async () => {
      const { data } = await api.get<SalesSummaryPayload>(
        `/api/${tenantSlug}/dashboard/sales/summary?${queryString}`
      );
      return data;
    }
  });

  const analyticsQ = useQuery({
    queryKey: ["dashboard-sales", "analytics", tenantSlug, queryString],
    enabled: Boolean(tenantSlug) && hydrated && summaryQ.isSuccess && analyticsVisible,
    staleTime: STALE.report,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: 1,
    queryFn: async () => {
      const { data } = await api.get<SalesAnalyticsPayload>(
        `/api/${tenantSlug}/dashboard/sales/analytics?${queryString}`
      );
      return data;
    }
  });

  const breakdownQ = useQuery({
    queryKey: ["dashboard-sales", "breakdown", tenantSlug, breakdownQueryString],
    enabled: Boolean(tenantSlug) && hydrated && summaryQ.isSuccess && breakdownVisible,
    staleTime: STALE.report,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: 1,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const { data } = await api.get<SalesBreakdownPayload>(
        `/api/${tenantSlug}/dashboard/sales/breakdown?${breakdownQueryString}`
      );
      return data;
    }
  });

  return useMemo(() => {
    const summary = summaryQ.data;
    if (!summary) {
      return {
        data: undefined as SalesDashboardSnapshot | undefined,
        isLoading: summaryQ.isLoading,
        isFetching: summaryQ.isFetching || analyticsQ.isFetching || breakdownQ.isFetching,
        isError: summaryQ.isError || analyticsQ.isError || breakdownQ.isError,
        agentTotal: 0
      };
    }
    const analytics = analyticsQ.data;
    const breakdown = breakdownQ.data;
    const merged: SalesDashboardSnapshot = {
      ...summary,
      product_category_analytics: analytics?.product_category_analytics ?? [],
      product_group_analytics: analytics?.product_group_analytics ?? [],
      category_performance_table: analytics?.category_performance_table ?? [],
      sales_dynamics: analytics?.sales_dynamics ?? [],
      refusal_reason_analytics: analytics?.refusal_reason_analytics ?? [],
      territory_analytics: breakdown?.territory_analytics ?? [],
      agent_analytics: breakdown?.agent_analytics ?? []
    };
    return {
      data: merged,
      isLoading: summaryQ.isLoading,
      isFetching: summaryQ.isFetching || analyticsQ.isFetching || breakdownQ.isFetching,
      isError: summaryQ.isError || analyticsQ.isError || breakdownQ.isError,
      agentTotal: breakdown?.agent_total ?? 0
    };
  }, [summaryQ, analyticsQ, breakdownQ]);
}
