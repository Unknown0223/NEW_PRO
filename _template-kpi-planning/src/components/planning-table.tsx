"use client";

import { Fragment, useCallback, useMemo, useState, useEffect, useRef } from "react";
import { cn, formatNumber, getStatusLabel } from "@/lib/utils";
import {
  Check,
  ChevronDown,
  ChevronUp,
  Link2,
  Pencil,
  Sigma,
  SlidersHorizontal,
  X,
  AlertCircle,
} from "lucide-react";

interface Employee {
  id: number;
  name: string;
  code: string;
  role: string;
  parentId: number | null;
}

interface KpiTarget {
  id: number;
  planId: number;
  employeeId: number;
  cost: string | null;
  count: string | null;
  volume: string | null;
  acb: string | null;
  orderCount: number | null;
  comment: string | null;
  status: string | null;
  lastUpdated: Date | string | null;
  updatedBy: number | null;
}

interface KpiGroup {
  id: number;
  name: string;
  tradeDirectionId: number;
  status: string | null;
}

interface Plan {
  id: number;
  kpiGroupId: number;
}

interface PlanningTableProps {
  employees: Employee[];
  kpiGroups: KpiGroup[];
  kpiTargets: KpiTarget[];
  plans: Plan[];
  onUpdateTarget: (target: KpiTarget, field: string, value: string) => void;
  onUpdateStatus: (target: KpiTarget, status: string) => void;
  onUpdateComment: (target: KpiTarget, comment: string) => void;
}

type MetricField = "cost" | "count" | "volume" | "acb" | "orderCount";

const metricOptions = ["Сумма", "Количество", "Объем", "АКБ", "Кол-во-заказов"] as const;

const roleLabels: Record<string, string> = {
  director: "Директор",
  sales_director: "Директор",
  commercial_director: "Менеджер",
  manager: "Менеджер",
  supervisor: "Супервайзеры",
  agent: "Агент",
};

const metricFields: Record<string, MetricField> = {
  Сумма: "cost",
  Количество: "count",
  Объем: "volume",
  АКБ: "acb",
  "Кол-во-заказов": "orderCount",
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
  computed = false,
  showZero = false,
  hasMismatch = false,
  isTarget = false,
}: {
  value: string;
  onChange?: (val: string) => void;
  disabled?: boolean;
  computed?: boolean;
  showZero?: boolean;
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

  const displayValue = numericValue(value) === 0 && !showZero ? "" : formatNumber(value);

  if (editing && !disabled) {
    return (
      <input
        type="text"
        value={local}
        onChange={(event) => setLocal(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => event.key === "Enter" && commit()}
        className={cn(
          "h-7 w-full rounded border bg-white px-1.5 text-xs text-slate-700 outline-none ring-1",
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
      onClick={() => !disabled && setEditing(true)}
      disabled={disabled}
      className={cn(
        "flex h-7 w-full items-center gap-1 rounded border px-1.5 text-xs transition-colors",
        borderColor,
        !disabled && "hover:bg-white cursor-pointer"
      )}
    >
      {!isTarget && !hasMismatch && <Link2 className="h-2.5 w-2.5 shrink-0 text-teal-500" />}
      {hasMismatch && <AlertCircle className="h-2.5 w-2.5 shrink-0 text-red-500" />}
      {isTarget && !hasMismatch && <Sigma className="h-2.5 w-2.5 shrink-0 text-teal-600" />}
      <span className="truncate font-medium text-[11px]">{displayValue}</span>
    </button>
  );
}

function CommentCell({
  value,
  onChange,
}: {
  value: string;
  onChange: (val: string) => void;
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

  if (editing) {
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
    <div className="flex items-center gap-1 group">
      <span
        className="text-[11px] text-slate-400 truncate cursor-pointer hover:text-slate-600"
        onClick={() => setEditing(true)}
      >
        {value || "Комментарий..."}
      </span>
      <button
        onClick={() => setEditing(true)}
        className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 hover:bg-slate-100 rounded shrink-0"
      >
        <Pencil className="h-2.5 w-2.5 text-slate-400" />
      </button>
    </div>
  );
}

function StatusButton({
  status,
  onChange,
  isLastRow = false,
}: {
  status: string;
  onChange: (status: string) => void;
  isLastRow?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const options = [
    { value: "in_progress", label: "В процессе", bg: "bg-orange-50 border-orange-200 text-orange-600" },
    { value: "rejected", label: "Возвращено для редактирования", bg: "bg-orange-50 border-orange-200 text-orange-600" },
    { value: "approved", label: "Одобрено", bg: "bg-emerald-50 border-emerald-200 text-emerald-700" },
    { value: "pending_approval", label: "На согласовании", bg: "bg-amber-50 border-amber-200 text-amber-700" },
    { value: "draft", label: "Черновик", bg: "bg-slate-50 border-slate-200 text-slate-600" },
  ];

  const current = options.find((option) => option.value === status) ?? options[0];
  const isUp = status === "in_progress";
  const shouldOpenUp = isLastRow;

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "inline-flex items-center gap-0.5 rounded border px-1.5 py-0.5 text-[10px] font-medium whitespace-nowrap transition-colors z-50",
          current.bg
        )}
      >
        {isUp ? <ChevronUp className="h-2.5 w-2.5" /> : <ChevronDown className="h-2.5 w-2.5" />}
        {current.label}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-[60]" onClick={() => setOpen(false)} />
          <div
            className={cn(
              "absolute z-[70] w-56 rounded-lg border border-slate-200 bg-white py-1 shadow-xl",
              shouldOpenUp ? "bottom-full mb-1" : "top-full mt-1"
            )}
          >
            {options.map((option) => (
              <button
                key={option.value}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-center gap-2 px-2.5 py-1.5 text-xs hover:bg-slate-50 transition-colors",
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

export function PlanningTable({
  employees,
  kpiGroups,
  kpiTargets,
  plans,
  onUpdateTarget,
  onUpdateStatus,
  onUpdateComment,
}: PlanningTableProps) {
  const visibleGroups = useMemo(() => kpiGroups.slice(0, 1), [kpiGroups]);
  const [openFilter, setOpenFilter] = useState<number | null>(null);
  const [localValues, setLocalValues] = useState<Record<string, string>>({});
  const [columnConfigs, setColumnConfigs] = useState<Record<number, ColumnConfig>>(() => {
    const configs: Record<number, ColumnConfig> = {};
    kpiGroups.forEach((group) => {
      configs[group.id] = { groupId: group.id, metrics: ["Сумма"] };
    });
    return configs;
  });

  const parentIds = useMemo(() => {
    const set = new Set<number>();
    employees.forEach((employee) => {
      if (employees.some((child) => child.parentId === employee.id)) set.add(employee.id);
    });
    return set;
  }, [employees]);

  const [expandedEmployees, setExpandedEmployees] = useState<Set<number>>(() => parentIds);

  const getConfig = useCallback(
    (groupId: number) => columnConfigs[groupId] ?? { groupId, metrics: ["Сумма"] },
    [columnConfigs]
  );

  const getPlanForGroup = useCallback(
    (groupId: number) => plans.find((plan) => plan.kpiGroupId === groupId),
    [plans]
  );

  const getTarget = useCallback(
    (planId: number, empId: number) =>
      kpiTargets.find((target) => target.planId === planId && target.employeeId === empId),
    [kpiTargets]
  );

  const getTargetValue = useCallback(
    (target: KpiTarget | undefined, field: MetricField) => {
      if (!target) return "0";
      const override = localValues[`${target.id}:${field}`];
      if (override !== undefined) return override;
      const value = target[field];
      return typeof value === "number" ? String(value) : String(value ?? "0");
    },
    [localValues]
  );

  const updateTargetValue = (target: KpiTarget, field: MetricField, value: string) => {
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
        [groupId]: { groupId, metrics: updated.length > 0 ? updated : ["Сумма"] },
      };
    });
  };

  const selectAllMetrics = (groupId: number) => {
    setColumnConfigs((previous) => ({
      ...previous,
      [groupId]: { groupId, metrics: [...metricOptions] },
    }));
  };

  const clearMetrics = (groupId: number) => {
    setColumnConfigs((previous) => ({
      ...previous,
      [groupId]: { groupId, metrics: ["Сумма"] },
    }));
  };

  const rootEmployees = useMemo(() => employees.filter((employee) => employee.parentId === null), [employees]);

  const getChildren = useCallback(
    (parentId: number) => employees.filter((employee) => employee.parentId === parentId),
    [employees]
  );

  // Calculate sum of children for a given employee
  const childrenSum = useCallback(
    (planId: number, empId: number, metric: string): number => {
      const children = employees.filter((employee) => employee.parentId === empId);
      if (children.length === 0) return 0;
      let sum = 0;
      for (const child of children) {
        const childTarget = getTarget(planId, child.id);
        const field = metricFields[metric];
        const val = childTarget?.[field];
        const childValue = typeof val === "number" ? val : numericValue(val);
        // Also include grandchildren
        sum += childValue + childrenSum(planId, child.id, metric);
      }
      return sum;
    },
    [employees, getTarget]
  );

  const employeeSubtotals = useCallback(
    (planId: number, empId: number, metric: string): number => {
      const children = employees.filter((employee) => employee.parentId === empId);
      if (children.length === 0) {
        const field = metricFields[metric];
        const target = getTarget(planId, empId);
        return numericValue(getTargetValue(target, field));
      }
      let sum = 0;
      for (const child of children) {
        sum += employeeSubtotals(planId, child.id, metric);
      }
      return sum;
    },
    [employees, getTarget, getTargetValue]
  );

  const groupTotals = useCallback(
    (groupId: number, metric: string) => {
      const plan = getPlanForGroup(groupId);
      if (!plan) return 0;
      const rootEmps = employees.filter((e) => e.parentId === null);
      let sum = 0;
      for (const root of rootEmps) {
        sum += employeeSubtotals(plan.id, root.id, metric);
      }
      return sum;
    },
    [getPlanForGroup, employees, employeeSubtotals]
  );

  const totalMetricColumns = useMemo(
    () => visibleGroups.reduce((sum, group) => sum + getConfig(group.id).metrics.length, 0),
    [getConfig, visibleGroups]
  );

  function renderMetricCells({
    group,
    children: renderChildren,
    className,
  }: {
    group: KpiGroup;
    children: (metric: string, field: MetricField, hasMismatch: boolean, isTarget: boolean) => React.ReactNode;
    className?: string;
  }) {
    const config = getConfig(group.id);
    return config.metrics.map((metric) => (
      <td
        key={`${group.id}-${metric}`}
        className={cn("px-1 py-1 w-[90px] border-l border-slate-100", className)}
      >
        {renderChildren(metric, metricFields[metric], false, false)}
      </td>
    ));
  }

  const allEmployeesFlat = useMemo(() => {
    const list: Employee[] = [];
    const traverse = (emps: Employee[], depth: number) => {
      for (const emp of emps) {
        list.push(emp);
        if (expandedEmployees.has(emp.id)) {
          traverse(getChildren(emp.id), depth + 1);
        }
      }
    };
    traverse(rootEmployees, 0);
    return list;
  }, [rootEmployees, expandedEmployees, getChildren]);

  function renderEmployee(emp: Employee, primaryPlanId: number, depth: number, index: number, total: number) {
    const primaryTarget = getTarget(primaryPlanId, emp.id);
    const children = getChildren(emp.id);
    const hasChildren = children.length > 0;
    const isExpanded = expandedEmployees.has(emp.id);
    const isLastRow = index === total - 1;

    const rowBg = depth === 0 ? "bg-white" : depth % 2 === 0 ? "bg-slate-50/30" : "bg-white";

    return (
      <Fragment key={emp.id}>
        <tr className={cn("border-b border-slate-100 hover:bg-slate-50/60 transition-colors", rowBg)}>
          <td className="px-2 py-1.5">
            <div className="flex items-center gap-1" style={{ paddingLeft: `${depth * 12 + 4}px` }}>
              {hasChildren ? (
                <button
                  onClick={() => toggleEmployee(emp.id)}
                  className="flex h-4 w-4 items-center justify-center rounded hover:bg-slate-200 shrink-0 transition-colors"
                >
                  <ChevronDown
                    className={cn("h-3 w-3 text-slate-500 transition-transform", !isExpanded && "-rotate-90")}
                  />
                </button>
              ) : (
                <span className="w-4 shrink-0" />
              )}
              <span className={cn("text-[12px] leading-tight", depth === 0 ? "font-semibold text-slate-800" : "text-slate-700")}>
                {emp.name}
              </span>
            </div>
          </td>
          <td className="px-2 py-1.5">
            <span className="text-[11px] text-slate-500">{roleLabels[emp.role] || emp.role}</span>
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

              return (
                <td key={`${group.id}-${metric}`} className="px-1 py-1 border-l border-slate-100">
                  <KpiCell
                    value={val}
                    onChange={(value) => target && updateTargetValue(target, field, value)}
                    hasMismatch={hasMismatch}
                    isTarget={isTarget}
                  />
                </td>
              );
            });
          })}

          <td className="px-1.5 py-1.5 border-l border-slate-200 bg-white">
            <CommentCell
              value={primaryTarget?.comment || ""}
              onChange={(val) => primaryTarget && onUpdateComment(primaryTarget, val)}
            />
          </td>
          <td className="px-1.5 py-1.5 bg-white">
            {primaryTarget && (
              <StatusButton
                status={primaryTarget.status || "draft"}
                onChange={(status) => onUpdateStatus(primaryTarget, status)}
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

  return (
    <div className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50/80">
            <th className="px-2 py-2 text-left text-xs font-medium text-slate-500 w-[200px]">Ф.И.О</th>
            <th className="px-2 py-2 text-left text-xs font-medium text-slate-500 w-[70px]">Роль</th>

            {visibleGroups.map((group) => {
              const config = getConfig(group.id);
              const isOpen = openFilter === group.id;
              return (
                <th
                  key={group.id}
                  className="px-1 py-2 border-l border-slate-200"
                  colSpan={config.metrics.length}
                >
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="text-xs font-semibold text-slate-700 whitespace-nowrap">{group.name}</span>
                    <div className="relative">
                      <button
                        onClick={() => setOpenFilter(isOpen ? null : group.id)}
                        className="flex h-5 w-5 items-center justify-center rounded hover:bg-slate-200 transition-colors"
                      >
                        <SlidersHorizontal className="h-3 w-3 text-slate-500" />
                      </button>
                      {isOpen && (
                        <>
                          <div className="fixed inset-0 z-40" onClick={() => setOpenFilter(null)} />
                          <div className="absolute right-0 top-7 z-50 w-44 rounded-lg border border-slate-200 bg-white py-2 shadow-xl">
                            <div className="px-3 py-1.5 border-b border-slate-100">
                              <span className="text-xs font-medium text-slate-700">Метрики</span>
                            </div>
                            <div className="p-2 space-y-1">
                              {metricOptions.map((metric) => (
                                <label
                                  key={metric}
                                  className="flex items-center gap-2 px-2 py-1 hover:bg-slate-50 rounded cursor-pointer"
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
                            <div className="px-2 py-1.5 border-t border-slate-100 flex gap-1">
                              <button
                                onClick={() => selectAllMetrics(group.id)}
                                className="flex-1 text-[10px] text-teal-600 hover:bg-teal-50 px-2 py-1 rounded"
                              >
                                Все
                              </button>
                              <button
                                onClick={() => clearMetrics(group.id)}
                                className="flex-1 text-[10px] text-slate-500 hover:bg-slate-50 px-2 py-1 rounded"
                              >
                                Сброс
                              </button>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                  {/* Metric badges aligned with columns */}
                  <div className="flex items-center gap-1">
                    {config.metrics.map((metric) => (
                      <div key={metric} className="flex-1 min-w-0">
                        <span className="inline-flex items-center justify-center w-full rounded bg-teal-50 border border-teal-200 px-1 py-0.5 text-[9px] font-medium text-teal-700 truncate">
                          {metric}
                        </span>
                      </div>
                    ))}
                  </div>
                </th>
              );
            })}

            <th className="px-2 py-2 text-left text-xs font-medium text-slate-500 w-[100px] border-l border-slate-200">
              Комментарий
            </th>
            <th className="px-2 py-2 text-left text-xs font-medium text-slate-500 w-[110px]">Статус</th>
          </tr>
        </thead>
        <tbody>
          {primaryPlan &&
            allEmployeesFlat.map((employee, index) =>
              renderEmployee(employee, primaryPlan.id, 0, index, allEmployeesFlat.length)
            )}
        </tbody>
      </table>
    </div>
  );
}
