"use client";

import { PageShell } from "@/components/dashboard/page-shell";
import {
  FinanceFiltersBar,
  defaultFinanceDraft,
  type QuickRangeKey
} from "@/components/dashboard/finance/finance-filters-bar";
import { FinanceProPage } from "@/components/dashboard/finance/pro/finance-pro-page";
import { buildFinanceProUiModel } from "@/components/dashboard/finance/finance-ui-model";
import { useFinanceQueries } from "@/components/dashboard/finance/use-finance-queries";
import type { FinanceFilterDraft } from "@/components/dashboard/finance/types";
import { useAuthStore, useAuthStoreHydrated, useEffectiveRole } from "@/lib/auth-store";
import { useDashboardMeta } from "@/lib/use-dashboard-meta";
import { useEffect, useMemo, useState } from "react";

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
  const [quickRange, setQuickRange] = useState<QuickRangeKey>("custom");

  const { agents, supervisors, clientRefs, profileRefs, reportFilters: reportFiltersRaw, productCategories } =
    useDashboardMeta(tenantSlug, hydrated);

  const { data, isLoading, isFetching, isError } = useFinanceQueries({
    tenantSlug,
    hydrated,
    applied,
    clientsPage: 1,
    clientsPageSize: 10,
    ledgerVisible: false
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

  const applyFilters = () => {
    setApplied({
      ...draft,
      supervisor_ids: selfSupervisorIdStr ? [selfSupervisorIdStr] : draft.supervisor_ids
    });
  };

  const resetFilters = () => {
    const fresh = defaultFinanceDraft(selfSupervisorIdStr);
    setDraft(fresh);
    setApplied(fresh);
    setQuickRange("custom");
  };

  const proModel = useMemo(() => (data ? buildFinanceProUiModel(data) : null), [data]);

  const handleProPeriodChange = (from: string, to: string) => {
    const next = { ...draft, from, to };
    setDraft(next);
    setApplied({ ...next, supervisor_ids: selfSupervisorIdStr ? [selfSupervisorIdStr] : next.supervisor_ids });
    setQuickRange("custom");
  };

  return (
    <PageShell className="space-y-6">
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
          {isFetching && !isLoading ? (
            <p className="text-xs font-medium text-teal-700">Обновление данных…</p>
          ) : null}

          {proModel ? (
            <FinanceProPage
              model={proModel}
              loading={isFetching}
              from={applied.from}
              to={applied.to}
              onPeriodChange={handleProPeriodChange}
            />
          ) : isLoading ? (
            <p className="text-sm text-muted-foreground">Загрузка финансов…</p>
          ) : null}
        </div>
      )}
    </PageShell>
  );
}