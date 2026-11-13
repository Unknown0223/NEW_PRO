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
import { sumDescendantAgentMetric } from "./planning-utils";
import {
  filterPlanningEmployeesByPlanState,
  filterPlanningEmployeesByScope,
  planningFilialOptions,
  planningSvrOptions,
  type PlanningCompletionFilter,
  type PlanningIssueFilter
} from "./planning-scope-filters";
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
  const [filialIds, setFilialIds] = useState<number[]>([]);
  const [svrIds, setSvrIds] = useState<number[]>([]);
  const [kpiFilterIds, setKpiFilterIds] = useState<number[]>([]);
  const [completionFilter, setCompletionFilter] = useState<PlanningCompletionFilter>("all");
  const [issueFilter, setIssueFilter] = useState<PlanningIssueFilter>("all");
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
      setBanner(
        `Отправлено на согласование: ${res.plans_updated} план(ов). План уже учитывается в дашборде KPI. Для финального статуса нажмите «Одобрить».`
      );
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

  const directionGroups = useMemo(() => {
    if (!data || directionId == null) return [];
    return data.kpi_groups.filter((g) => g.trade_direction_id === directionId);
  }, [data, directionId]);

  const filteredGroups = useMemo(() => {
    if (kpiFilterIds.length === 0) return directionGroups;
    const set = new Set(kpiFilterIds);
    return directionGroups.filter((g) => set.has(g.id));
  }, [directionGroups, kpiFilterIds]);

  useEffect(() => {
    setColumnConfigs((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const g of directionGroups) {
        if (!next[g.id]) {
          next[g.id] = { groupId: g.id, metrics: ["Сумма"] };
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [directionGroups]);

  useEffect(() => {
    setFilialIds([]);
    setSvrIds([]);
    setKpiFilterIds([]);
    setSearchQuery("");
    setCompletionFilter("all");
    setIssueFilter("all");
  }, [directionId]);

  const filialOptions = useMemo(
    () => (data ? planningFilialOptions(data.employees) : []),
    [data]
  );
  const svrOptions = useMemo(
    () => (data ? planningSvrOptions(data.employees, filialIds) : []),
    [data, filialIds]
  );

  useEffect(() => {
    if (svrIds.length === 0) return;
    const valid = new Set(svrOptions.map((o) => o.id));
    const next = svrIds.filter((id) => valid.has(id));
    if (next.length !== svrIds.length) setSvrIds(next);
  }, [svrIds, svrOptions]);

  useEffect(() => {
    if (kpiFilterIds.length === 0) return;
    const valid = new Set(directionGroups.map((g) => g.id));
    const next = kpiFilterIds.filter((id) => valid.has(id));
    if (next.length !== kpiFilterIds.length) setKpiFilterIds(next);
  }, [directionGroups, kpiFilterIds]);

  const planStateMaps = useMemo(() => {
    const statusByUserId = new Map<number, string>();
    const mismatchByUserId = new Map<number, boolean>();
    if (!data) return { statusByUserId, mismatchByUserId };

    const groups =
      kpiFilterIds.length > 0
        ? data.kpi_groups.filter((g) => kpiFilterIds.includes(g.id))
        : data.kpi_groups.filter((g) => g.trade_direction_id === directionId);

    const primaryPlan = groups
      .map((g) => data.plans.find((p) => p.kpi_group_id === g.id))
      .find(Boolean);

    for (const emp of data.employees) {
      if (emp.role !== "agent") continue;
      let status = "draft";
      if (primaryPlan) {
        const t = data.kpi_targets.find(
          (x) => x.plan_id === primaryPlan.id && x.user_id === emp.id
        );
        status = t?.status ?? "draft";
      }
      // Bir nechta KPI: eng «yomon» status ustun
      for (const g of groups) {
        const plan = data.plans.find((p) => p.kpi_group_id === g.id);
        if (!plan) continue;
        const t = data.kpi_targets.find((x) => x.plan_id === plan.id && x.user_id === emp.id);
        const st = t?.status ?? "draft";
        if (st === "rejected") status = "rejected";
        else if (status !== "rejected" && st !== "approved") status = st;
        else if (status === "draft" && st === "approved") status = "approved";
      }
      statusByUserId.set(emp.id, status);
      mismatchByUserId.set(emp.id, false);
    }

    // SVR/filial mismatch — agentlarga yopishtirmaymiz; faqat rejected agent = problem
    // Parent mismatch: agar ota target ≠ agent yig‘indisi — ota problem, lekin filtr agentlar bo‘yicha.
    // Muammo: rejected yoki parent ostida rollup nomuvofiqligi (agent 0, lekin ota > 0 emas).
    for (const emp of data.employees) {
      if (emp.role === "agent") continue;
      for (const g of groups) {
        const plan = data.plans.find((p) => p.kpi_group_id === g.id);
        if (!plan) continue;
        const own = data.kpi_targets.find((t) => t.plan_id === plan.id && t.user_id === emp.id);
        const ownCost = Number.parseFloat(own?.cost ?? "0");
        if (!Number.isFinite(ownCost) || ownCost === 0) continue;
        const rollup = sumDescendantAgentMetric(emp.id, data.employees, (agentId) => {
          const t = data.kpi_targets.find((x) => x.plan_id === plan.id && x.user_id === agentId);
          return Number.parseFloat(t?.cost ?? "0") || 0;
        });
        if (Math.abs(ownCost - rollup) > 0.001) {
          // Ostidagi agentlarni «muammoli» deb belgilash — filtrda ko‘rinsin
          const mark = (id: number) => {
            for (const child of data.employees.filter((e) => e.parent_id === id)) {
              if (child.role === "agent") mismatchByUserId.set(child.id, true);
              else mark(child.id);
            }
          };
          mark(emp.id);
        }
      }
    }

    return { statusByUserId, mismatchByUserId };
  }, [data, directionId, kpiFilterIds]);

  const filteredEmployees = useMemo(() => {
    if (!data) return [];
    const scoped = filterPlanningEmployeesByScope(data.employees, {
      search: searchQuery,
      filialIds,
      svrIds
    });
    return filterPlanningEmployeesByPlanState(scoped, {
      completion: completionFilter,
      issue: issueFilter,
      statusByUserId: planStateMaps.statusByUserId,
      mismatchByUserId: planStateMaps.mismatchByUserId
    });
  }, [data, searchQuery, filialIds, svrIds, completionFilter, issueFilter, planStateMaps]);

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
        searchQuery={searchQuery}
        onSearch={setSearchQuery}
        onRefresh={() => void centerQ.refetch()}
        loading={centerQ.isFetching}
        canImport={canWrite && directionId != null && directionGroups.length > 0}
        onDownloadTemplate={() => void handleDownloadTemplate()}
        onImportFile={(f) => void handleImportFile(f)}
        importBusy={importBusy}
        filialOptions={filialOptions}
        svrOptions={svrOptions}
        kpiOptions={directionGroups.map((g) => ({ id: g.id, name: g.name }))}
        filialIds={filialIds}
        svrIds={svrIds}
        kpiIds={kpiFilterIds}
        onFilialIdsChange={setFilialIds}
        onSvrIdsChange={setSvrIds}
        onKpiIdsChange={setKpiFilterIds}
        completionFilter={completionFilter}
        issueFilter={issueFilter}
        onCompletionFilterChange={setCompletionFilter}
        onIssueFilterChange={setIssueFilter}
      />

      {banner && (
        <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">{banner}</p>
      )}

      {hasPendingPlans ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          Планы в статусе «На согласовании». Они уже входят в KPI дашборда / мобильный «Reja» / дневные KPI.
          {canApprove
            ? " Нажмите «Одобрить», чтобы зафиксировать статус «Одобрено»."
            : " Нужно право «Одобрить план» (plans.ustanovka_planov.approve), чтобы завершить согласование."}
        </p>
      ) : null}

      {data && !hasPendingPlans && !hasApprovedPlans && (data.plans?.length ?? 0) > 0 ? (
        <p className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-950">
          Планы в черновике. После заполнения нажмите «Подтвердить» — иначе суммы не попадут в дашборд и мобильные KPI.
        </p>
      ) : null}

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
            agentKpiIds={data.agent_kpi_ids}
            kpiGroupIdsWithAgents={data.kpi_group_ids_with_agents}
          />

          <TotalsSection
            employees={filteredEmployees}
            kpiGroups={filteredGroups}
            kpiTargets={data.kpi_targets}
            plans={data.plans}
            agentKpiIds={data.agent_kpi_ids}
            kpiGroupIdsWithAgents={data.kpi_group_ids_with_agents}
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
