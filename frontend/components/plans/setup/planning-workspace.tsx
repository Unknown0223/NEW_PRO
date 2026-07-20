"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePermissions } from "@/lib/use-permissions";
import { getUserFacingError } from "@/lib/error-utils";
import {
  approvePlanningPlans,
  confirmPlanningPlans,
  fetchPlanningCenter,
  fetchPlanningDirections,
  patchPlanningTarget,
  planningKeys,
  returnPlanningPlansToDraft,
  type PlanningTarget
} from "./planning-api";
import { filterEmployeesWithAncestors } from "./planning-utils";
import { PlanningTopBar } from "./planning-top-bar";
import { PlanningTable } from "./planning-table";
import { TotalsSection } from "./totals-section";

export function PlanningWorkspace({ tenantSlug }: { tenantSlug: string }) {
  const perms = usePermissions();
  const qc = useQueryClient();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [directionId, setDirectionId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [banner, setBanner] = useState<string | null>(null);

  const canWrite = perms.has("plans.ustanovka_planov.update");
  const canApprove = perms.has("plans.ustanovka_planov.approve");

  const centerQ = useQuery({
    queryKey: planningKeys.center(tenantSlug, month, year, directionId),
    queryFn: () => fetchPlanningCenter(tenantSlug, month, year, directionId!),
    enabled: Boolean(tenantSlug) && directionId != null,
    staleTime: 30_000
  });

  useEffect(() => {
    const dirs = centerQ.data?.trade_directions ?? [];
    if (dirs.length === 0) return;
    if (directionId == null || !dirs.some((d) => d.id === directionId)) {
      setDirectionId(dirs[0]!.id);
    }
  }, [centerQ.data?.trade_directions, directionId]);

  const bootstrapQ = useQuery({
    queryKey: ["plans", "setup", "directions", tenantSlug],
    queryFn: () => fetchPlanningDirections(tenantSlug),
    enabled: Boolean(tenantSlug) && directionId == null,
    staleTime: 60_000
  });

  useEffect(() => {
    if (directionId != null) return;
    const dirs = bootstrapQ.data ?? centerQ.data?.trade_directions ?? [];
    if (dirs.length > 0) setDirectionId(dirs[0]!.id);
  }, [bootstrapQ.data, centerQ.data?.trade_directions, directionId]);

  const patchMut = useMutation({
    mutationFn: ({
      targetId,
      payload
    }: {
      targetId: number;
      payload: Parameters<typeof patchPlanningTarget>[2];
    }) => patchPlanningTarget(tenantSlug, targetId, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: planningKeys.center(tenantSlug, month, year, directionId) });
    },
    onError: (e) => setBanner(getUserFacingError(e))
  });

  const confirmMut = useMutation({
    mutationFn: () => confirmPlanningPlans(tenantSlug, month, year, directionId!),
    onSuccess: (res) => {
      setBanner(`Отправлено на согласование: ${res.plans_updated} план(ов), ${res.targets_updated} цел(ей).`);
      void qc.invalidateQueries({ queryKey: planningKeys.center(tenantSlug, month, year, directionId) });
    },
    onError: (e) => setBanner(getUserFacingError(e))
  });

  const approveMut = useMutation({
    mutationFn: () => approvePlanningPlans(tenantSlug, month, year, directionId!),
    onSuccess: (res) => {
      setBanner(`Одобрено: ${res.plans_updated} план(ов), ${res.targets_updated} цел(ей).`);
      void qc.invalidateQueries({ queryKey: planningKeys.center(tenantSlug, month, year, directionId) });
    },
    onError: (e) => setBanner(getUserFacingError(e))
  });

  const returnMut = useMutation({
    mutationFn: () => returnPlanningPlansToDraft(tenantSlug, month, year, directionId!),
    onSuccess: (res) => {
      setBanner(`Возвращено на редактирование: ${res.plans_updated} план(ов).`);
      void qc.invalidateQueries({ queryKey: planningKeys.center(tenantSlug, month, year, directionId) });
    },
    onError: (e) => setBanner(getUserFacingError(e))
  });

  const data = centerQ.data;
  const hasPendingPlans = (data?.plans ?? []).some((p) => p.status === "pending_approval");
  const hasApprovedPlans = (data?.plans ?? []).some((p) => p.status === "approved");
  const selectedDirection = data?.trade_directions.find((d) => d.id === directionId);

  const filteredGroups = useMemo(() => {
    if (!data || directionId == null) return [];
    return data.kpi_groups.filter((g) => g.trade_direction_id === directionId);
  }, [data, directionId]);

  const filteredEmployees = useMemo(() => {
    if (!data) return [];
    return filterEmployeesWithAncestors(data.employees, searchQuery);
  }, [data, searchQuery]);

  const tradeDirectionNames = data?.trade_directions.map((d) => d.name) ?? [];

  const handleUpdateTarget = useCallback(
    (target: PlanningTarget, field: string, value: string) => {
      if (!canWrite) return;
      const apiField = field === "orderCount" ? "order_count" : field;
      void patchMut.mutateAsync({ targetId: target.id, payload: { [apiField]: value } });
    },
    [canWrite, patchMut]
  );

  const handleUpdateStatus = useCallback(
    (target: PlanningTarget, status: string) => {
      if (!canWrite) return;
      void patchMut.mutateAsync({ targetId: target.id, payload: { status } });
    },
    [canWrite, patchMut]
  );

  const handleUpdateComment = useCallback(
    (target: PlanningTarget, comment: string) => {
      if (!canWrite) return;
      void patchMut.mutateAsync({ targetId: target.id, payload: { comment } });
    },
    [canWrite, patchMut]
  );

  const loading = centerQ.isLoading && !data;

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-3 py-16 text-slate-500">
        <Loader2 className="h-6 w-6 animate-spin" />
        <span className="text-sm font-medium">Загрузка данных...</span>
      </div>
    );
  }

  if (centerQ.isError) {
    return (
      <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        {getUserFacingError(centerQ.error)}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <PlanningTopBar
        month={month}
        year={year}
        tradeDirection={selectedDirection?.name ?? "—"}
        tradeDirections={tradeDirectionNames}
        directionId={directionId}
        onMonthChange={(m, y) => {
          setMonth(m);
          setYear(y);
        }}
        onTradeDirectionChange={(name) => {
          const dir = data?.trade_directions.find((d) => d.name === name);
          if (dir) setDirectionId(dir.id);
        }}
        onSearch={setSearchQuery}
        onRefresh={() => void centerQ.refetch()}
        loading={centerQ.isFetching}
      />

      {banner && (
        <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">{banner}</p>
      )}

      {data && directionId != null && (
        <>
          <PlanningTable
            employees={filteredEmployees}
            kpiGroups={filteredGroups}
            kpiTargets={data.kpi_targets}
            plans={data.plans}
            canWrite={canWrite}
            onUpdateTarget={handleUpdateTarget}
            onUpdateStatus={handleUpdateStatus}
            onUpdateComment={handleUpdateComment}
          />

          <TotalsSection
            employees={data.employees}
            kpiGroups={filteredGroups}
            kpiTargets={data.kpi_targets}
            plans={data.plans}
          />

          <div className="flex items-center justify-end gap-3 py-2">
            <Button
              type="button"
              variant="outline"
              disabled={!canWrite || patchMut.isPending || centerQ.isFetching}
              onClick={() => {
                void centerQ.refetch().then(() => {
                  setBanner("Данные обновлены.");
                });
              }}
            >
              {centerQ.isFetching ? "Обновление…" : "Обновить"}
            </Button>
            <Button
              type="button"
              className="bg-teal-600 hover:bg-teal-700"
              disabled={!canWrite || confirmMut.isPending || hasPendingPlans || hasApprovedPlans}
              onClick={() => void confirmMut.mutateAsync()}
            >
              {confirmMut.isPending ? "Отправка…" : "Подтвердить"}
            </Button>
            {canApprove && hasPendingPlans ? (
              <>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={approveMut.isPending}
                  onClick={() => void approveMut.mutateAsync()}
                >
                  {approveMut.isPending ? "…" : "Одобрить"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={returnMut.isPending}
                  onClick={() => void returnMut.mutateAsync()}
                >
                  {returnMut.isPending ? "…" : "Вернуть на редактирование"}
                </Button>
              </>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}
