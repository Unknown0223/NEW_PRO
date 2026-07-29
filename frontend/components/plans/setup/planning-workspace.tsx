"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePermissions } from "@/lib/use-permissions";
import { getUserFacingError } from "@/lib/error-utils";
import { downloadXlsxAoa } from "@/lib/download-xlsx";
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
import { PlanningImportPreviewDialog } from "./planning-import-preview-dialog";
import {
  buildPlanImportTemplateAoa,
  parsePlanImportMatrix,
  type PlanImportMetricKey,
  type PlanImportPreviewRow
} from "./planning-import-parse";
import type { PlanningColumnConfig } from "./planning-table";

export function PlanningWorkspace({ tenantSlug }: { tenantSlug: string }) {
  const perms = usePermissions();
  const qc = useQueryClient();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [directionId, setDirectionId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [banner, setBanner] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importRows, setImportRows] = useState<PlanImportPreviewRow[]>([]);
  const [importMetricsByGroup, setImportMetricsByGroup] = useState<
    Record<number, PlanImportMetricKey[]>
  >({});
  const [importBusy, setImportBusy] = useState(false);
  const [columnConfigs, setColumnConfigs] = useState<Record<number, PlanningColumnConfig>>({});

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

  useEffect(() => {
    setColumnConfigs((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const g of filteredGroups) {
        if (!next[g.id]) {
          next[g.id] = { groupId: g.id, metrics: ["Сумма"] };
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [filteredGroups]);

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

  const handleDownloadTemplate = useCallback(async () => {
    if (!data || directionId == null) return;
    try {
      const metricsByGroup: Record<number, string[]> = {};
      for (const g of filteredGroups) {
        metricsByGroup[g.id] = columnConfigs[g.id]?.metrics?.length
          ? columnConfigs[g.id]!.metrics
          : ["Сумма"];
      }
      const { aoa, merges } = buildPlanImportTemplateAoa({
        kpiGroups: filteredGroups,
        employees: data.employees,
        plans: data.plans,
        targets: data.kpi_targets,
        metricsByGroup,
        directionName: selectedDirection?.name,
        month,
        year
      });
      const dirSlug = (selectedDirection?.name ?? "plan")
        .replace(/[^\w\-а-яА-ЯёЁ]+/gi, "_")
        .slice(0, 40);
      const metricHint = [...new Set(Object.values(metricsByGroup).flat())]
        .join("-")
        .replace(/\s+/g, "")
        .slice(0, 40);
      await downloadXlsxAoa(
        `plan-${dirSlug}-${year}-${String(month).padStart(2, "0")}-${metricHint || "summa"}.xlsx`,
        "Планы",
        aoa,
        {
          merges,
          colWidths: [
            22,
            14,
            16,
            18,
            ...filteredGroups.flatMap((g) =>
              (metricsByGroup[g.id] ?? ["Сумма"]).map(() => 12)
            )
          ]
        }
      );
      setBanner(
        `Шаблон Excel скачан (${selectedDirection?.name ?? "—"}, ${String(month).padStart(2, "0")}.${year}, колонки как на экране). Заполните и загрузите через «Импорт Excel».`
      );
    } catch (e) {
      setBanner(getUserFacingError(e, "Не удалось скачать шаблон."));
    }
  }, [data, directionId, filteredGroups, columnConfigs, selectedDirection?.name, month, year]);

  const handleImportFile = useCallback(
    async (file: File) => {
      if (!data || directionId == null) return;
      setImportBusy(true);
      setBanner(null);
      try {
        const XLSX = await import("xlsx");
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: "array" });
        const sheetName = wb.SheetNames[0];
        if (!sheetName) throw new Error("EMPTY_SHEET");
        const matrix = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[sheetName]!, {
          header: 1,
          defval: ""
        }) as unknown[][];
        const parsed = parsePlanImportMatrix(matrix, filteredGroups, data.employees);
        setImportRows(parsed.rows);
        setImportMetricsByGroup(parsed.metricsByGroup);
        setImportOpen(true);
      } catch (e) {
        setBanner(getUserFacingError(e, "Не удалось прочитать Excel."));
      } finally {
        setImportBusy(false);
      }
    },
    [data, directionId, filteredGroups]
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
        canImport={canWrite && directionId != null && filteredGroups.length > 0}
        onDownloadTemplate={() => void handleDownloadTemplate()}
        onImportFile={(f) => void handleImportFile(f)}
        importBusy={importBusy}
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
            columnConfigs={columnConfigs}
            onColumnConfigsChange={setColumnConfigs}
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

          <PlanningImportPreviewDialog
            open={importOpen}
            onOpenChange={setImportOpen}
            tenantSlug={tenantSlug}
            directionId={directionId}
            initialMonth={month}
            initialYear={year}
            kpiGroups={filteredGroups}
            employees={data.employees}
            initialRows={importRows}
            metricsByGroup={importMetricsByGroup}
            onApplied={(m, y) => {
              setMonth(m);
              setYear(y);
              setBanner(
                `Импорт принят на ${String(m).padStart(2, "0")}.${y}. Существующие значения обновлены по smart-коду.`
              );
              void qc.invalidateQueries({ queryKey: ["plans", "setup", tenantSlug] });
            }}
          />
        </>
      )}
    </div>
  );
}
