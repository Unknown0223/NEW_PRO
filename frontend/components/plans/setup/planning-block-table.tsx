"use client";

import { Fragment, useCallback, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { SlidersHorizontal } from "lucide-react";
import type { PlanningEmployee, PlanningKpiGroup, PlanningPlan, PlanningTarget } from "./planning-api";
import type { PlanningColumnConfig, PlanningSvrBlock } from "./planning-blocks";
import {
  CommentCell,
  KpiCell,
  StatusButton,
  metricFields,
  metricOptions,
  numericValue,
  type MetricField
} from "./planning-cells";
import {
  canEmployeeSetPlan,
  computeMetricColumnWidths,
  getPlanningRoleLabel,
  isPlanningKpiCellEditable,
  sumDescendantAgentMetric
} from "./planning-utils";

type Props = {
  block: PlanningSvrBlock;
  blockTitle: string;
  blockSubtitle: string | null;
  kpiGroups: PlanningKpiGroup[];
  allEmployees: PlanningEmployee[];
  kpiTargets: PlanningTarget[];
  plans: PlanningPlan[];
  canWrite: boolean;
  columnConfigs: Record<number, PlanningColumnConfig>;
  onColumnConfigsChange: (next: Record<number, PlanningColumnConfig>) => void;
  onUpdateTarget: (target: PlanningTarget, field: MetricField, value: string) => void;
  onUpdateStatus: (target: PlanningTarget, status: string) => void;
  onUpdateComment: (target: PlanningTarget, comment: string) => void;
  agentKpiIds?: Record<string, number[]>;
  kpiGroupIdsWithAgents?: number[];
};

export function PlanningBlockTable({
  block,
  blockTitle,
  blockSubtitle,
  kpiGroups,
  allEmployees,
  kpiTargets,
  plans,
  canWrite,
  columnConfigs,
  onColumnConfigsChange,
  onUpdateTarget,
  onUpdateStatus,
  onUpdateComment,
  agentKpiIds,
  kpiGroupIdsWithAgents
}: Props) {
  const [openFilter, setOpenFilter] = useState<number | null>(null);
  const [localValues, setLocalValues] = useState<Record<string, string>>({});

  const getConfig = useCallback(
    (groupId: number) => columnConfigs[groupId] ?? { groupId, metrics: ["Сумма"] },
    [columnConfigs]
  );

  const getPlanForGroup = useCallback(
    (groupId: number) => plans.find((plan) => plan.kpi_group_id === groupId),
    [plans]
  );

  const getTarget = useCallback(
    (planId: number, userId: number) =>
      kpiTargets.find((target) => target.plan_id === planId && target.user_id === userId),
    [kpiTargets]
  );

  const updateTargetValue = (target: PlanningTarget, field: MetricField, value: string) => {
    setLocalValues((previous) => ({ ...previous, [`${target.id}:${field}`]: value }));
    onUpdateTarget(target, field, value);
  };

  const toggleMetric = (groupId: number, metric: string) => {
    const current = getConfig(groupId).metrics;
    const updated = current.includes(metric)
      ? current.filter((item) => item !== metric)
      : [...current, metric];
    onColumnConfigsChange({
      ...columnConfigs,
      [groupId]: { groupId, metrics: updated.length > 0 ? updated : ["Сумма"] }
    });
  };

  const agentSubtreeSum = useCallback(
    (planId: number, empId: number, metric: string): number => {
      const field = metricFields[metric];
      if (!field) return 0;
      return sumDescendantAgentMetric(empId, allEmployees, (agentId) => {
        const childTarget = getTarget(planId, agentId);
        const val = childTarget?.[field];
        return typeof val === "number" ? val : numericValue(val);
      });
    },
    [allEmployees, getTarget]
  );

  const metricColWidths = useMemo(
    () =>
      computeMetricColumnWidths({
        groups: kpiGroups.map((g) => ({ id: g.id, metrics: getConfig(g.id).metrics })),
        employees: block.rows.map((r) => r.emp),
        kpiTargets,
        plans,
        localValues
      }),
    [kpiGroups, block.rows, columnConfigs, kpiTargets, plans, localValues, getConfig]
  );

  const primaryGroup = kpiGroups[0];
  const primaryPlan = primaryGroup ? getPlanForGroup(primaryGroup.id) : undefined;
  if (!primaryPlan || kpiGroups.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/50 px-3 py-4 text-sm text-slate-500">
        <p className="font-medium text-slate-700">{blockTitle}</p>
        <p className="mt-1 text-xs">Нет KPI, привязанных к агентам этого блока.</p>
      </div>
    );
  }

  const rowCount = block.rows.length;

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 border-b border-slate-100 bg-slate-50/90 px-3 py-2">
        <h3 className="text-sm font-semibold text-slate-800">{blockTitle}</h3>
        {blockSubtitle ? (
          <span className="text-[11px] text-slate-500">{blockSubtitle}</span>
        ) : null}
        <span className="ml-auto text-[10px] text-slate-400">
          KPI: {kpiGroups.map((g) => g.name).join(" · ") || "—"}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-max min-w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/80">
              <th
                rowSpan={2}
                className="min-w-[180px] px-2 py-2 text-left text-xs font-medium text-slate-500"
              >
                Ф.И.О
              </th>
              <th
                rowSpan={2}
                className="min-w-[120px] px-2 py-2 text-left text-xs font-medium text-slate-500"
              >
                Роль
              </th>
              {kpiGroups.map((group) => {
                const config = getConfig(group.id);
                const isOpen = openFilter === group.id;
                const groupWidth = config.metrics.reduce(
                  (sum, m) => sum + (metricColWidths[`${group.id}:${m}`] ?? 88),
                  0
                );
                return (
                  <th
                    key={group.id}
                    className="border-l border-slate-200 px-1 py-1.5 text-center align-bottom"
                    colSpan={config.metrics.length}
                    style={{ minWidth: groupWidth }}
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span className="whitespace-nowrap text-xs font-semibold text-slate-700">
                        {group.name}
                      </span>
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setOpenFilter(isOpen ? null : group.id)}
                          className="flex h-5 w-5 shrink-0 items-center justify-center rounded hover:bg-slate-200"
                          title="Метрики"
                        >
                          <SlidersHorizontal className="h-3 w-3 text-slate-500" />
                        </button>
                        {isOpen ? (
                          <>
                            <div
                              className="fixed inset-0 z-40"
                              onClick={() => setOpenFilter(null)}
                              aria-hidden
                            />
                            <div className="absolute right-0 top-7 z-50 w-44 rounded-lg border border-slate-200 bg-white py-2 shadow-xl">
                              <div className="space-y-1 p-2">
                                {metricOptions.map((metric) => (
                                  <label
                                    key={metric}
                                    className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 hover:bg-slate-50"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={config.metrics.includes(metric)}
                                      onChange={() => toggleMetric(group.id, metric)}
                                      className="h-3.5 w-3.5 rounded border-slate-300 accent-teal-600"
                                    />
                                    <span className="text-xs text-slate-700">{metric}</span>
                                  </label>
                                ))}
                              </div>
                            </div>
                          </>
                        ) : null}
                      </div>
                    </div>
                  </th>
                );
              })}
              <th
                rowSpan={2}
                className="min-w-[96px] border-l border-slate-200 px-2 py-2 text-left text-xs font-medium text-slate-500"
              >
                Комментарий
              </th>
              <th
                rowSpan={2}
                className="min-w-[118px] px-2 py-2 text-left text-xs font-medium text-slate-500"
              >
                Статус
              </th>
            </tr>
            <tr className="border-b border-slate-200 bg-slate-50/50">
              {kpiGroups.flatMap((group) => {
                const config = getConfig(group.id);
                return config.metrics.map((metric) => {
                  const colKey = `${group.id}:${metric}`;
                  const colW = metricColWidths[colKey] ?? 88;
                  return (
                    <th
                      key={colKey}
                      className="border-l border-slate-200 px-1 py-1 text-center"
                      style={{ minWidth: colW, width: colW }}
                    >
                      <span className="inline-block whitespace-nowrap rounded border border-teal-200 bg-teal-50 px-1.5 py-0.5 text-[10px] font-medium text-teal-700">
                        {metric}
                      </span>
                    </th>
                  );
                });
              })}
            </tr>
          </thead>
          <tbody>
            {block.rows.map(({ emp, depth }, index) => {
              const hasChildren = block.rows.some(
                (r) => r.emp.parent_id === emp.id && r.depth === depth + 1
              );
              const primaryTarget = getTarget(primaryPlan.id, emp.id);
              const rowCanEdit = canWrite && canEmployeeSetPlan(emp);
              const rowBg =
                depth === 0 ? "bg-white" : depth % 2 === 0 ? "bg-slate-50/30" : "bg-white";
              const isLastRow = index === rowCount - 1;

              return (
                <Fragment key={emp.id}>
                  <tr
                    className={cn(
                      "border-b border-slate-100 transition-colors hover:bg-slate-50/60",
                      rowBg
                    )}
                  >
                    <td className="px-2 py-1.5">
                      <div
                        className="flex items-center gap-1"
                        style={{ paddingLeft: `${depth * 12 + 4}px` }}
                      >
                        <span
                          className={cn(
                            "text-[12px] leading-tight",
                            depth === 0 ? "font-semibold text-slate-800" : "text-slate-700"
                          )}
                        >
                          {emp.name}
                        </span>
                      </div>
                    </td>
                    <td className="px-2 py-1.5">
                      <span className="whitespace-nowrap text-[11px] text-slate-500">
                        {getPlanningRoleLabel(emp)}
                      </span>
                    </td>
                    {kpiGroups.flatMap((group) => {
                      const plan = getPlanForGroup(group.id);
                      const target = plan ? getTarget(plan.id, emp.id) : undefined;
                      const config = getConfig(group.id);
                      const linked = isPlanningKpiCellEditable(
                        emp,
                        group.id,
                        agentKpiIds,
                        kpiGroupIdsWithAgents
                      );
                      return config.metrics.map((metric) => {
                        const field = metricFields[metric];
                        const colKey = `${group.id}:${metric}`;
                        const colW = metricColWidths[colKey] ?? 88;
                        if (!linked) {
                          return (
                            <td
                              key={colKey}
                              className="border-l border-slate-100 px-1 py-1 text-center text-[11px] text-slate-300"
                              style={{ minWidth: colW, width: colW }}
                              title="Агент не привязан к этой KPI-группе"
                            >
                              —
                            </td>
                          );
                        }
                        const override = target
                          ? localValues[`${target.id}:${field}`]
                          : undefined;
                        const raw =
                          override !== undefined
                            ? override
                            : target?.[field];
                        const val =
                          typeof raw === "number" ? String(raw) : String(raw ?? "0");
                        const rollupVal = plan ? agentSubtreeSum(plan.id, emp.id, metric) : 0;
                        const targetNum = numericValue(val);
                        const displayVal =
                          hasChildren && targetNum === 0 ? String(rollupVal) : val;
                        const hasMismatch =
                          hasChildren &&
                          targetNum !== 0 &&
                          Math.abs(targetNum - rollupVal) > 0.001;
                        const isTarget =
                          hasChildren && (targetNum !== 0 || rollupVal !== 0);
                        return (
                          <td
                            key={colKey}
                            className="border-l border-slate-100 px-1 py-1"
                            style={{ minWidth: colW, width: colW }}
                          >
                            <KpiCell
                              value={displayVal}
                              onChange={(value) =>
                                target && updateTargetValue(target, field, value)
                              }
                              disabled={!rowCanEdit || !target}
                              hasMismatch={hasMismatch}
                              isTarget={isTarget}
                            />
                          </td>
                        );
                      });
                    })}
                    <td className="border-l border-slate-200 bg-white px-1.5 py-1.5">
                      <CommentCell
                        value={primaryTarget?.comment || ""}
                        onChange={(val) =>
                          primaryTarget && onUpdateComment(primaryTarget, val)
                        }
                        disabled={!rowCanEdit || !primaryTarget}
                      />
                    </td>
                    <td className="bg-white px-1.5 py-1.5">
                      {primaryTarget ? (
                        <StatusButton
                          status={primaryTarget.status || "draft"}
                          onChange={(status) => onUpdateStatus(primaryTarget, status)}
                          disabled={!rowCanEdit}
                          isLastRow={isLastRow}
                        />
                      ) : null}
                    </td>
                  </tr>
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
