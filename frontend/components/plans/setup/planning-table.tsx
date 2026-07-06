"use client";

import { Fragment, useCallback, useMemo, useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import {
  Check,
  ChevronDown,
  ChevronUp,
  Link2,
  Pencil,
  Sigma,
  SlidersHorizontal,
  AlertCircle
} from "lucide-react";
import type { PlanningEmployee, PlanningKpiGroup, PlanningPlan, PlanningTarget } from "./planning-api";
import {
  computeMetricColumnWidths,
  formatNumber,
  getPlanningRoleLabel,
  canEmployeeSetPlan
} from "./planning-utils";
import { buildPlanningTreeHelpers, defaultExpandedPlanningNodes } from "./planning-tree";

type MetricField = "cost" | "count" | "volume" | "acb" | "order_count";

const metricOptions = ["Сумма", "Количество", "Объем", "АКБ", "Кол-во-заказов"] as const;

const metricFields: Record<string, MetricField> = {
  Сумма: "cost",
  Количество: "count",
  Объем: "volume",
  АКБ: "acb",
  "Кол-во-заказов": "order_count"
};

function numericValue(value: string | number | null | undefined) {
  if (typeof value === "number") return value;
  const normalized = String(value ?? "0").replace(/\s/g, "").replace(/,/g, ".");
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function KpiCell({
  value,
  onChange,
  disabled = false,
  hasMismatch = false,
  isTarget = false
}: {
  value: string;
  onChange?: (val: string) => void;
  disabled?: boolean;
  hasMismatch?: boolean;
  isTarget?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [local, setLocal] = useState(value);

  useEffect(() => {
    if (!editing) setLocal(value);
  }, [value, editing]);

  const commit = () => {
    setEditing(false);
    if (local !== value && onChange) onChange(local);
  };

  const displayValue = numericValue(value) === 0 ? "" : formatNumber(value);

  if (editing && !disabled) {
    return (
      <input
        type="text"
        value={local}
        onChange={(event) => setLocal(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => event.key === "Enter" && commit()}
        className={cn(
          "h-6 w-full rounded border bg-white px-1 text-[11px] text-slate-700 outline-none ring-1",
          hasMismatch ? "border-red-400 ring-red-200" : "border-teal-400 ring-teal-200"
        )}
        autoFocus
      />
    );
  }

  const borderColor = hasMismatch
    ? "border-red-400 bg-red-50/50 text-red-700"
    : isTarget
      ? "border-teal-400 bg-teal-50/50 text-teal-800"
      : "border-slate-200 bg-[#f8fafb] text-slate-600";

  return (
    <button
      type="button"
      onClick={() => !disabled && setEditing(true)}
      disabled={disabled}
      className={cn(
        "flex h-6 w-full items-center gap-0.5 rounded border px-1 text-[11px] transition-colors",
        borderColor,
        !disabled && "cursor-pointer hover:bg-white"
      )}
    >
      {!isTarget && !hasMismatch && <Link2 className="h-2.5 w-2.5 shrink-0 text-teal-500" />}
      {hasMismatch && <AlertCircle className="h-2.5 w-2.5 shrink-0 text-red-500" />}
      {isTarget && !hasMismatch && <Sigma className="h-2.5 w-2.5 shrink-0 text-teal-600" />}
      <span className="whitespace-nowrap text-[11px] font-medium">{displayValue}</span>
    </button>
  );
}

function CommentCell({
  value,
  onChange,
  disabled
}: {
  value: string;
  onChange: (val: string) => void;
  disabled?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [local, setLocal] = useState(value);

  useEffect(() => {
    setLocal(value);
  }, [value]);

  const commit = () => {
    setEditing(false);
    if (local !== value) onChange(local);
  };

  if (editing && !disabled) {
    return (
      <input
        type="text"
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === "Enter" && commit()}
        className="h-7 w-full rounded border border-slate-300 px-1.5 text-xs outline-none focus:border-teal-500"
        autoFocus
        placeholder="Комментарий..."
      />
    );
  }

  return (
    <div className="group flex items-center gap-1">
      <span
        className={cn(
          "truncate text-[11px] text-slate-400",
          !disabled && "cursor-pointer hover:text-slate-600"
        )}
        onClick={() => !disabled && setEditing(true)}
      >
        {value || "Комментарий..."}
      </span>
      {!disabled && (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="shrink-0 rounded p-0.5 opacity-0 transition-opacity hover:bg-slate-100 group-hover:opacity-100"
        >
          <Pencil className="h-2.5 w-2.5 text-slate-400" />
        </button>
      )}
    </div>
  );
}

function StatusButton({
  status,
  onChange,
  disabled,
  isLastRow = false
}: {
  status: string;
  onChange: (status: string) => void;
  disabled?: boolean;
  isLastRow?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const options = [
    { value: "in_progress", label: "В процессе", bg: "bg-orange-50 border-orange-200 text-orange-600" },
    {
      value: "rejected",
      label: "Возвращено для редактирования",
      bg: "bg-orange-50 border-orange-200 text-orange-600"
    },
    { value: "approved", label: "Одобрено", bg: "bg-emerald-50 border-emerald-200 text-emerald-700" },
    { value: "pending_approval", label: "На согласовании", bg: "bg-amber-50 border-amber-200 text-amber-700" },
    { value: "draft", label: "Черновик", bg: "bg-slate-50 border-slate-200 text-slate-600" }
  ];

  const current = options.find((option) => option.value === status) ?? options[0];
  const isUp = status === "in_progress";

  if (disabled) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-0.5 rounded border px-1.5 py-0.5 text-[10px] font-medium whitespace-nowrap",
          current.bg
        )}
      >
        {current.label}
      </span>
    );
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          "inline-flex items-center gap-0.5 rounded border px-1.5 py-0.5 text-[10px] font-medium whitespace-nowrap transition-colors",
          current.bg
        )}
      >
        {isUp ? <ChevronUp className="h-2.5 w-2.5" /> : <ChevronDown className="h-2.5 w-2.5" />}
        {current.label}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-[60]" onClick={() => setOpen(false)} aria-hidden />
          <div
            className={cn(
              "absolute z-[70] w-56 rounded-lg border border-slate-200 bg-white py-1 shadow-xl",
              isLastRow ? "bottom-full mb-1" : "top-full mt-1"
            )}
          >
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-center gap-2 px-2.5 py-1.5 text-xs transition-colors hover:bg-slate-50",
                  status === option.value && "bg-slate-50"
                )}
              >
                {status === option.value && <Check className="h-3 w-3 text-teal-600" />}
                <span className={cn(status !== option.value && "ml-5")}>{option.label}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

interface ColumnConfig {
  groupId: number;
  metrics: string[];
}

interface PlanningTableProps {
  employees: PlanningEmployee[];
  kpiGroups: PlanningKpiGroup[];
  kpiTargets: PlanningTarget[];
  plans: PlanningPlan[];
  canWrite: boolean;
  onUpdateTarget: (target: PlanningTarget, field: MetricField, value: string) => void;
  onUpdateStatus: (target: PlanningTarget, status: string) => void;
  onUpdateComment: (target: PlanningTarget, comment: string) => void;
}

export function PlanningTable({
  employees,
  kpiGroups,
  kpiTargets,
  plans,
  canWrite,
  onUpdateTarget,
  onUpdateStatus,
  onUpdateComment
}: PlanningTableProps) {
  const visibleGroups = kpiGroups;
  const [openFilter, setOpenFilter] = useState<number | null>(null);
  const [localValues, setLocalValues] = useState<Record<string, string>>({});
  const [columnConfigs, setColumnConfigs] = useState<Record<number, ColumnConfig>>(() => {
    const configs: Record<number, ColumnConfig> = {};
    kpiGroups.forEach((group) => {
      configs[group.id] = { groupId: group.id, metrics: ["Сумма"] };
    });
    return configs;
  });

  useEffect(() => {
    setColumnConfigs((prev) => {
      const next = { ...prev };
      for (const g of kpiGroups) {
        if (!next[g.id]) next[g.id] = { groupId: g.id, metrics: ["Сумма"] };
      }
      return next;
    });
  }, [kpiGroups]);

  const { getChildren, rootEmployees } = useMemo(
    () => buildPlanningTreeHelpers(employees),
    [employees]
  );

  const [expandedEmployees, setExpandedEmployees] = useState<Set<number>>(() => new Set());

  useEffect(() => {
    setExpandedEmployees(defaultExpandedPlanningNodes(employees));
  }, [employees]);

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

  const getTargetValue = useCallback(
    (target: PlanningTarget | undefined, field: MetricField) => {
      if (!target) return "0";
      const override = localValues[`${target.id}:${field}`];
      if (override !== undefined) return override;
      const value = target[field];
      return typeof value === "number" ? String(value) : String(value ?? "0");
    },
    [localValues]
  );

  const updateTargetValue = (target: PlanningTarget, field: MetricField, value: string) => {
    setLocalValues((previous) => ({ ...previous, [`${target.id}:${field}`]: value }));
    onUpdateTarget(target, field, value);
  };

  const toggleEmployee = (id: number) => {
    setExpandedEmployees((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleMetric = (groupId: number, metric: string) => {
    setColumnConfigs((previous) => {
      const current = getConfig(groupId).metrics;
      const updated = current.includes(metric)
        ? current.filter((item) => item !== metric)
        : [...current, metric];
      return {
        ...previous,
        [groupId]: { groupId, metrics: updated.length > 0 ? updated : ["Сумма"] }
      };
    });
  };

  const selectAllMetrics = (groupId: number) => {
    setColumnConfigs((previous) => ({
      ...previous,
      [groupId]: { groupId, metrics: [...metricOptions] }
    }));
  };

  const clearMetrics = (groupId: number) => {
    setColumnConfigs((previous) => ({
      ...previous,
      [groupId]: { groupId, metrics: ["Сумма"] }
    }));
  };

  const rootEmployeesList = rootEmployees;

  const getChildrenOf = getChildren;

  const childrenSum = useCallback(
    (planId: number, empId: number, metric: string): number => {
      const field = metricFields[metric];
      return getChildrenOf(empId).reduce((sum, child) => {
        const childTarget = getTarget(planId, child.id);
        const val = childTarget?.[field];
        return sum + (typeof val === "number" ? val : numericValue(val));
      }, 0);
    },
    [getChildrenOf, getTarget]
  );

  const allEmployeesFlat = useMemo(() => {
    const list: { emp: PlanningEmployee; depth: number }[] = [];
    const traverse = (emps: PlanningEmployee[], depth: number) => {
      for (const emp of emps) {
        list.push({ emp, depth });
        if (expandedEmployees.has(emp.id)) {
          traverse(getChildrenOf(emp.id), depth + 1);
        }
      }
    };
    traverse(rootEmployeesList, 0);
    return list;
  }, [rootEmployeesList, expandedEmployees, getChildrenOf]);

  function renderEmployee(
    emp: PlanningEmployee,
    primaryPlanId: number,
    depth: number,
    index: number,
    total: number,
    colWidths: Record<string, number>
  ) {
    const primaryTarget = getTarget(primaryPlanId, emp.id);
    const children = getChildrenOf(emp.id);
    const hasChildren = children.length > 0;
    const isExpanded = expandedEmployees.has(emp.id);
    const isLastRow = index === total - 1;
    const rowBg = depth === 0 ? "bg-white" : depth % 2 === 0 ? "bg-slate-50/30" : "bg-white";
    const rowCanEdit = canWrite && canEmployeeSetPlan(emp);

    return (
      <Fragment key={emp.id}>
        <tr className={cn("border-b border-slate-100 transition-colors hover:bg-slate-50/60", rowBg)}>
          <td className="px-2 py-1.5">
            <div className="flex items-center gap-1" style={{ paddingLeft: `${depth * 12 + 4}px` }}>
              {hasChildren ? (
                <button
                  type="button"
                  onClick={() => toggleEmployee(emp.id)}
                  className="flex h-4 w-4 shrink-0 items-center justify-center rounded transition-colors hover:bg-slate-200"
                >
                  <ChevronDown
                    className={cn("h-3 w-3 text-slate-500 transition-transform", !isExpanded && "-rotate-90")}
                  />
                </button>
              ) : (
                <span className="w-4 shrink-0" />
              )}
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
            <span className="text-[11px] text-slate-500 whitespace-nowrap">{getPlanningRoleLabel(emp)}</span>
          </td>

          {visibleGroups.flatMap((group) => {
            const plan = getPlanForGroup(group.id);
            const target = plan ? getTarget(plan.id, emp.id) : undefined;
            const config = getConfig(group.id);

            return config.metrics.map((metric) => {
              const field = metricFields[metric];
              const targetVal = target?.[field];
              const val = typeof targetVal === "number" ? String(targetVal) : String(targetVal ?? "0");
              const childSumVal = plan ? childrenSum(plan.id, emp.id, metric) : 0;
              const targetNum = numericValue(val);
              const hasMismatch = hasChildren && targetNum !== 0 && childSumVal !== targetNum;
              const isTarget = hasChildren && targetNum !== 0;
              const colKey = `${group.id}:${metric}`;
              const colW = colWidths[colKey] ?? 88;

              return (
                <td
                  key={colKey}
                  className="border-l border-slate-100 px-1 py-1"
                  style={{ minWidth: colW, width: colW }}
                >
                  <KpiCell
                    value={val}
                    onChange={(value) => target && updateTargetValue(target, field, value)}
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
              onChange={(val) => primaryTarget && onUpdateComment(primaryTarget, val)}
              disabled={!rowCanEdit || !primaryTarget}
            />
          </td>
          <td className="bg-white px-1.5 py-1.5">
            {primaryTarget && (
              <StatusButton
                status={primaryTarget.status || "draft"}
                onChange={(status) => onUpdateStatus(primaryTarget, status)}
                disabled={!rowCanEdit}
                isLastRow={isLastRow}
              />
            )}
          </td>
        </tr>
      </Fragment>
    );
  }

  const primaryGroup = visibleGroups[0];
  const primaryPlan = primaryGroup ? getPlanForGroup(primaryGroup.id) : undefined;
  const hasAnyPlan = visibleGroups.some((g) => getPlanForGroup(g.id));

  const metricColWidths = useMemo(
    () =>
      computeMetricColumnWidths({
        groups: visibleGroups.map((g) => ({
          id: g.id,
          metrics: getConfig(g.id).metrics
        })),
        employees,
        kpiTargets,
        plans,
        localValues
      }),
    [visibleGroups, columnConfigs, employees, kpiTargets, plans, localValues, getConfig]
  );

  if (visibleGroups.length === 0 || !hasAnyPlan) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
        KPI guruhlari topilmadi. Sozlamalar → Группа KPI bo‘limida guruh qo‘shing.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
      <table className="w-max min-w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-slate-100 bg-slate-50/80">
            <th rowSpan={2} className="min-w-[180px] px-2 py-2 text-left text-xs font-medium text-slate-500">
              Ф.И.О
            </th>
            <th rowSpan={2} className="min-w-[120px] px-2 py-2 text-left text-xs font-medium text-slate-500">
              Роль
            </th>

            {visibleGroups.map((group) => {
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
                    <span className="whitespace-nowrap text-xs font-semibold text-slate-700">{group.name}</span>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setOpenFilter(isOpen ? null : group.id)}
                        className="flex h-5 w-5 shrink-0 items-center justify-center rounded transition-colors hover:bg-slate-200"
                        title="Метрики"
                      >
                        <SlidersHorizontal className="h-3 w-3 text-slate-500" />
                      </button>
                      {isOpen && (
                        <>
                          <div className="fixed inset-0 z-40" onClick={() => setOpenFilter(null)} aria-hidden />
                          <div className="absolute right-0 top-7 z-50 w-44 rounded-lg border border-slate-200 bg-white py-2 shadow-xl">
                            <div className="border-b border-slate-100 px-3 py-1.5">
                              <span className="text-xs font-medium text-slate-700">Метрики</span>
                            </div>
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
                            <div className="flex gap-1 border-t border-slate-100 px-2 py-1.5">
                              <button
                                type="button"
                                onClick={() => selectAllMetrics(group.id)}
                                className="flex-1 rounded px-2 py-1 text-[10px] text-teal-600 hover:bg-teal-50"
                              >
                                Все
                              </button>
                              <button
                                type="button"
                                onClick={() => clearMetrics(group.id)}
                                className="flex-1 rounded px-2 py-1 text-[10px] text-slate-500 hover:bg-slate-50"
                              >
                                Сброс
                              </button>
                            </div>
                          </div>
                        </>
                      )}
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
            <th rowSpan={2} className="min-w-[118px] px-2 py-2 text-left text-xs font-medium text-slate-500">
              Статус
            </th>
          </tr>
          <tr className="border-b border-slate-200 bg-slate-50/50">
            {visibleGroups.flatMap((group) => {
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
          {primaryPlan &&
            allEmployeesFlat.map(({ emp, depth }, index) =>
              renderEmployee(emp, primaryPlan.id, depth, index, allEmployeesFlat.length, metricColWidths)
            )}
        </tbody>
      </table>
    </div>
  );
}
