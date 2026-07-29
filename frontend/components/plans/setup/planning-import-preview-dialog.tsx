"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { GroupedNumberInput } from "@/components/ui/grouped-number-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { getUserFacingError } from "@/lib/error-utils";
import { cn } from "@/lib/utils";
import { Loader2, Plus, Trash2 } from "lucide-react";
import type { PlanningEmployee, PlanningKpiGroup } from "./planning-api";
import {
  PLAN_IMPORT_METRICS,
  buildAgentContextMap,
  buildSmartCodeIndex,
  emptyPlanImportRow,
  planImportRowsToPayload,
  revalidatePlanImportRow,
  type PlanImportMetricKey,
  type PlanImportPreviewRow
} from "./planning-import-parse";
import { PLANNING_MONTHS } from "./planning-utils";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantSlug: string;
  directionId: number;
  initialMonth: number;
  initialYear: number;
  kpiGroups: PlanningKpiGroup[];
  employees: PlanningEmployee[];
  initialRows: PlanImportPreviewRow[];
  /** Fayldagi / shablondagi metrikalar — faqat shular ko‘rsatiladi */
  metricsByGroup: Record<number, PlanImportMetricKey[]>;
  onApplied: (month: number, year: number) => void;
};

function metricsForGroup(
  groupId: number,
  metricsByGroup: Record<number, PlanImportMetricKey[]>
): PlanImportMetricKey[] {
  const keys = metricsByGroup[groupId];
  return keys?.length ? keys : ["cost"];
}

function metricLabel(key: PlanImportMetricKey): string {
  return PLAN_IMPORT_METRICS.find((m) => m.key === key)?.label ?? key;
}

export function PlanningImportPreviewDialog({
  open,
  onOpenChange,
  tenantSlug,
  directionId,
  initialMonth,
  initialYear,
  kpiGroups,
  employees,
  initialRows,
  metricsByGroup,
  onApplied
}: Props) {
  const [rows, setRows] = useState<PlanImportPreviewRow[]>([]);
  const [month, setMonth] = useState(initialMonth);
  const [year, setYear] = useState(initialYear);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const smartIndex = useMemo(() => buildSmartCodeIndex(employees), [employees]);
  const agentCtx = useMemo(() => buildAgentContextMap(employees), [employees]);

  useEffect(() => {
    if (!open) return;
    setRows(initialRows.map((r) => revalidatePlanImportRow({ ...r }, smartIndex, agentCtx)));
    setMonth(initialMonth);
    setYear(initialYear);
    setSaving(false);
    setError(null);
  }, [open, initialRows, initialMonth, initialYear, smartIndex, agentCtx]);

  const okCount = rows.filter((r) => r.status === "ok").length;
  const warnCount = rows.filter((r) => r.status === "warning").length;
  const errCount = rows.filter((r) => r.status === "error").length;

  function patchRow(id: string, patch: Partial<PlanImportPreviewRow>) {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        const next = { ...r, ...patch };
        if (patch.smartCode !== undefined || patch.agentName !== undefined) {
          return revalidatePlanImportRow(next, smartIndex, agentCtx);
        }
        return next;
      })
    );
  }

  function setMetric(id: string, kpiId: number, metric: PlanImportMetricKey, value: string) {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        return {
          ...r,
          metrics: {
            ...r.metrics,
            [kpiId]: { ...(r.metrics[kpiId] ?? {}), [metric]: value }
          }
        };
      })
    );
  }

  function addRow() {
    setRows((prev) => [...prev, emptyPlanImportRow(kpiGroups)]);
  }

  function removeRow(id: string) {
    setRows((prev) => (prev.length <= 1 ? prev : prev.filter((r) => r.id !== id)));
  }

  async function handleApply() {
    const payloadRows = planImportRowsToPayload(rows, kpiGroups);
    if (payloadRows.length === 0) {
      setError("Нет строк для сохранения. Укажите smart-код и хотя бы одно значение KPI.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const { data } = await api.post<{
        data: {
          updated: number;
          created_targets: number;
          skipped: number;
          missing_codes: string[];
          unknown_kpi_groups: string[];
        };
      }>(`/api/${tenantSlug}/plans/setup/import`, {
        month,
        year,
        direction_id: directionId,
        rows: payloadRows
      });
      const res = data.data;
      if (res.missing_codes.length > 0) {
        setError(
          `Сохранено: ${res.updated}. Не найдены коды: ${res.missing_codes.slice(0, 8).join(", ")}${
            res.missing_codes.length > 8 ? "…" : ""
          }`
        );
        if (res.updated > 0) onApplied(month, year);
        return;
      }
      onOpenChange(false);
      onApplied(month, year);
    } catch (e) {
      setError(getUserFacingError(e, "Не удалось импортировать план."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] w-[min(96vw,1200px)] max-w-none flex-col gap-0 overflow-hidden p-0 sm:max-w-[min(96vw,1200px)]">
        <DialogHeader className="border-b px-5 py-4">
          <DialogTitle>Импорт планов — проверка</DialogTitle>
          <DialogDescription>
            Значения можно править вручную. Повторный импорт обновляет существующие планы по smart-коду.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-end gap-3 border-b bg-slate-50/80 px-5 py-3">
          <div className="space-y-1">
            <Label className="text-xs text-slate-500">Месяц приёма</Label>
            <select
              className="border-input bg-background h-9 rounded-md border px-2 text-sm"
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
            >
              {PLANNING_MONTHS.map((name, i) => (
                <option key={name} value={i + 1}>
                  {name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-slate-500">Год</Label>
            <Input
              type="number"
              className="h-9 w-24"
              value={year}
              onChange={(e) => setYear(Number.parseInt(e.target.value, 10) || year)}
            />
          </div>
          <p className="text-muted-foreground ml-auto text-xs">
            OK: {okCount} · предупрежд.: {warnCount} · ошибки: {errCount}
          </p>
        </div>

        <div className="min-h-0 flex-1 overflow-auto px-3 py-3">
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full min-w-[960px] border-collapse text-left text-xs">
              <thead className="sticky top-0 z-[1] bg-slate-100">
                <tr>
                  <th className="border-b px-2 py-2" rowSpan={2}>
                    Агент
                  </th>
                  <th className="border-b px-2 py-2" rowSpan={2}>
                    Smart код
                  </th>
                  <th className="border-b px-2 py-2" rowSpan={2}>
                    Филиал
                  </th>
                  <th className="border-b px-2 py-2" rowSpan={2}>
                    SVR
                  </th>
                  {kpiGroups.map((g) => (
                    <th
                      key={g.id}
                      className="border-b border-l px-2 py-1 text-center font-semibold"
                      colSpan={metricsForGroup(g.id, metricsByGroup).length}
                    >
                      {g.name}
                    </th>
                  ))}
                  <th className="border-b px-2 py-2" rowSpan={2}>
                    Статус
                  </th>
                  <th className="border-b px-2 py-2" rowSpan={2} />
                </tr>
                <tr>
                  {kpiGroups.map((g) =>
                    metricsForGroup(g.id, metricsByGroup).map((key) => (
                      <th key={`${g.id}-${key}`} className="border-b border-l px-1 py-1 text-center font-normal">
                        {metricLabel(key)}
                      </th>
                    ))
                  )}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-t even:bg-slate-50/50">
                    <td className="px-1 py-1">
                      <Input
                        className="h-8 min-w-[8rem] text-xs"
                        value={row.agentName}
                        onChange={(e) => patchRow(row.id, { agentName: e.target.value })}
                      />
                    </td>
                    <td className="px-1 py-1">
                      <Input
                        className="h-8 min-w-[6rem] font-mono text-xs"
                        value={row.smartCode}
                        onChange={(e) => patchRow(row.id, { smartCode: e.target.value })}
                      />
                    </td>
                    <td className="px-1 py-1">
                      <Input
                        className="h-8 min-w-[6rem] text-xs"
                        value={row.filial}
                        onChange={(e) => patchRow(row.id, { filial: e.target.value })}
                      />
                    </td>
                    <td className="px-1 py-1">
                      <Input
                        className="h-8 min-w-[6rem] text-xs"
                        value={row.svr}
                        onChange={(e) => patchRow(row.id, { svr: e.target.value })}
                      />
                    </td>
                    {kpiGroups.map((g) =>
                      metricsForGroup(g.id, metricsByGroup).map((key) => (
                        <td key={`${row.id}-${g.id}-${key}`} className="border-l px-0.5 py-1">
                          <GroupedNumberInput
                            className="h-8 min-w-[4.5rem] text-right text-xs tabular-nums"
                            maxFractionDigits={key === "order_count" ? 0 : 2}
                            value={row.metrics[g.id]?.[key] ?? ""}
                            onValueChange={(v) => setMetric(row.id, g.id, key, v)}
                          />
                        </td>
                      ))
                    )}
                    <td className="px-2 py-1">
                      <span
                        className={cn(
                          "whitespace-nowrap",
                          row.status === "ok" && "text-emerald-700",
                          row.status === "warning" && "text-amber-700",
                          row.status === "error" && "text-destructive"
                        )}
                        title={row.message}
                      >
                        {row.status === "ok" ? "OK" : row.message || row.status}
                      </span>
                    </td>
                    <td className="px-1 py-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => removeRow(row.id)}
                        disabled={rows.length <= 1}
                        title="Удалить строку"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Button type="button" variant="outline" size="sm" className="mt-3" onClick={addRow}>
            <Plus className="mr-1 size-3.5" />
            Добавить строку
          </Button>
        </div>

        {error ? <p className="text-destructive px-5 pb-2 text-sm">{error}</p> : null}

        <DialogFooter className="border-t px-5 py-3">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Отмена
          </Button>
          <Button
            type="button"
            className="bg-teal-600 hover:bg-teal-700"
            disabled={saving || rows.length === 0}
            onClick={() => void handleApply()}
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Сохранение…
              </>
            ) : (
              "Принять импорт"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
