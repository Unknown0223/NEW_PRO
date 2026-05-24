"use client";

import { buildFinanceQueryString } from "@/components/dashboard/finance/build-finance-query";
import type {
  FinanceDashboardSnapshot,
  FinanceDebtsPayload,
  FinanceFilterDraft,
  FinanceSummaryPayload
} from "@/components/dashboard/finance/types";
import { api } from "@/lib/api";
import { STALE } from "@/lib/query-stale";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

type UseFinanceQueriesArgs = {
  tenantSlug: string | null;
  hydrated: boolean;
  applied: FinanceFilterDraft;
  clientsPage: number;
  clientsPageSize: number;
  ledgerVisible: boolean;
};

export function useFinanceQueries({
  tenantSlug,
  hydrated,
  applied,
  clientsPage,
  clientsPageSize,
  ledgerVisible
}: UseFinanceQueriesArgs) {
  const queryString = useMemo(() => buildFinanceQueryString(applied), [applied]);
  const debtsQueryString = useMemo(
    () => buildFinanceQueryString(applied, { page: clientsPage, limit: clientsPageSize }),
    [applied, clientsPage, clientsPageSize]
  );

  const summaryQ = useQuery({
    queryKey: ["dashboard-finance", "summary", tenantSlug, queryString],
    enabled: Boolean(tenantSlug) && hydrated,
    staleTime: STALE.report,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: 1,
    queryFn: async () => {
      const { data } = await api.get<FinanceSummaryPayload>(
        `/api/${tenantSlug}/dashboard/finance/summary?${queryString}`
      );
      return data;
    }
  });

  const debtsQ = useQuery({
    queryKey: ["dashboard-finance", "debts", tenantSlug, debtsQueryString],
    enabled: Boolean(tenantSlug) && hydrated && summaryQ.isSuccess && ledgerVisible,
    staleTime: STALE.report,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: 1,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const { data } = await api.get<FinanceDebtsPayload>(
        `/api/${tenantSlug}/dashboard/finance/debts?${debtsQueryString}`
      );
      return data;
    }
  });

  return useMemo(() => {
    const summary = summaryQ.data;
    if (!summary) {
      return {
        data: undefined as FinanceDashboardSnapshot | undefined,
        isLoading: summaryQ.isLoading,
        isFetching: summaryQ.isFetching || debtsQ.isFetching,
        isError: summaryQ.isError || debtsQ.isError,
        clientsTotal: 0
      };
    }
    const debts = debtsQ.data;
    const merged: FinanceDashboardSnapshot = {
      ...summary,
      filters: applied,
      territory_debts: debts?.territory_debts ?? [],
      clients_debt_list: debts?.clients_debt_list ?? []
    };
    return {
      data: merged,
      isLoading: summaryQ.isLoading,
      isFetching: summaryQ.isFetching || debtsQ.isFetching,
      isError: summaryQ.isError || debtsQ.isError,
      clientsTotal: debts?.clients_total ?? 0,
      debtsLoading: debtsQ.isLoading && ledgerVisible
    };
  }, [summaryQ, debtsQ, applied, ledgerVisible]);
}
