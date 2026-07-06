"use client";

import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { Search, FileSpreadsheet, SlidersHorizontal, ChevronDown } from "lucide-react";
import type { PlanningEmployee, PlanningKpiGroup, PlanningPlan, PlanningTarget } from "./planning-api";
import { formatNumber, getPlanningRoleLabel } from "./planning-utils";
import { flattenPlanningTree, getPlanningParentIds, defaultExpandedPlanningNodes } from "./planning-tree";

interface TotalsSectionProps {
  employees: PlanningEmployee[];
  kpiGroups: PlanningKpiGroup[];
  kpiTargets: PlanningTarget[];
  plans: PlanningPlan[];
}

export function TotalsSection({ employees, kpiGroups, kpiTargets, plans }: TotalsSectionProps) {
  const [activeTab, setActiveTab] = useState<"detailed" | "general">("detailed");
  const [activeMetric, setActiveMetric] = useState<string>("Сумма");
  const [search, setSearch] = useState("");
  const parentIds = useMemo(() => getPlanningParentIds(employees), [employees]);
  const [expanded, setExpanded] = useState<Set<number>>(() => new Set());

  useEffect(() => {
    setExpanded(defaultExpandedPlanningNodes(employees));
  }, [employees]);

  const flatRows = useMemo(
    () => flattenPlanningTree(employees, expanded, search),
    [employees, expanded, search]
  );

  const toggleExpanded = (id: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const getTarget = (planId: number, userId: number) =>
    kpiTargets.find((t) => t.plan_id === planId && t.user_id === userId);

  const getMetricValue = (target: PlanningTarget | undefined, metric: string): number => {
    if (!target) return 0;
    switch (metric) {
      case "Сумма":
        return Number.parseFloat(target.cost || "0");
      case "Количество":
        return Number.parseFloat(target.count || "0");
      case "Объем":
        return Number.parseFloat(target.volume || "0");
      case "АКБ":
        return Number.parseFloat(target.acb || "0");
      case "Кол-во-заказов":
        return target.order_count || 0;
      default:
        return Number.parseFloat(target.cost || "0");
    }
  };

  const groupTotal = (groupId: number, metric: string) => {
    const plan = plans.find((p) => p.kpi_group_id === groupId);
    if (!plan) return 0;
    return kpiTargets
      .filter((t) => t.plan_id === plan.id)
      .reduce((s, t) => s + getMetricValue(t, metric), 0);
  };

  const empTotal = (userId: number, metric: string) =>
    kpiTargets.filter((t) => t.user_id === userId).reduce((s, t) => s + getMetricValue(t, metric), 0);

  const grandTotal = (metric: string) =>
    kpiTargets.reduce((s, t) => s + getMetricValue(t, metric), 0);

  const metrics = ["Сумма", "Количество", "Объем", "АКБ", "Кол-во-заказов"];
  const metricLabel = activeMetric === "Сумма" ? "Сумма по группе KPI" : `${activeMetric} по группе KPI`;

  return (
    <div>
      <div className="mb-0 flex items-center border-b border-slate-200">
        <button
          type="button"
          onClick={() => setActiveTab("detailed")}
          className={cn(
            "border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
            activeTab === "detailed"
              ? "border-teal-600 text-teal-700"
              : "border-transparent text-slate-500 hover:text-slate-700"
          )}
        >
          Детальный итоги
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("general")}
          className={cn(
            "border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
            activeTab === "general"
              ? "border-teal-600 text-teal-700"
              : "border-transparent text-slate-500 hover:text-slate-700"
          )}
        >
          Общие итоги
        </button>
      </div>

      <div className="rounded-b-lg border border-t-0 border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Поиск"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 w-52 rounded-lg border border-slate-200 bg-white pl-8 pr-3 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-teal-500"
              />
            </div>
            <button
              type="button"
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"
            >
              <SlidersHorizontal className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-600 hover:bg-slate-50"
            >
              <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
              Excel
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-1">
            {metrics.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setActiveMetric(m)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                  activeMetric === m ? "bg-teal-600 text-white" : "text-slate-500 hover:bg-slate-100"
                )}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        {activeTab === "detailed" && (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="w-[200px] px-3 py-2.5 text-left text-xs font-medium text-slate-500">Ф.И.О</th>
                  <th className="w-[60px] px-3 py-2.5 text-left text-xs font-medium text-slate-500">Код</th>
                  <th className="w-[90px] px-3 py-2.5 text-left text-xs font-medium text-slate-500">Роль</th>
                  <th className="px-3 py-2.5 text-center text-xs font-medium text-slate-400" colSpan={kpiGroups.length}>
                    {metricLabel}
                  </th>
                  <th className="w-[80px] px-3 py-2.5 text-right text-xs font-medium text-slate-500">Итого</th>
                </tr>
                <tr className="border-b border-slate-200 bg-slate-50/50">
                  <th className="px-3 py-2" colSpan={3} />
                  {kpiGroups.map((g) => (
                    <th
                      key={g.id}
                      className="whitespace-nowrap px-3 py-2 text-center text-xs font-medium text-slate-500"
                    >
                      {g.name}
                    </th>
                  ))}
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {flatRows.map(({ emp, depth }) => {
                  const hasChildren = parentIds.has(emp.id);
                  const isExpanded = expanded.has(emp.id);
                  return (
                    <tr key={emp.id} className="border-b border-slate-50 hover:bg-slate-50/30">
                      <td className="px-3 py-2 text-xs text-slate-700">
                        <div
                          className="flex items-center gap-1.5"
                          style={{ paddingLeft: `${depth * 14}px` }}
                        >
                          {hasChildren ? (
                            <button
                              type="button"
                              onClick={() => toggleExpanded(emp.id)}
                              className="flex h-4 w-4 shrink-0 items-center justify-center rounded hover:bg-slate-200"
                            >
                              <ChevronDown
                                className={cn(
                                  "h-3 w-3 text-slate-500 transition-transform",
                                  !isExpanded && "-rotate-90"
                                )}
                              />
                            </button>
                          ) : (
                            <span className="w-4 shrink-0" />
                          )}
                          <span className={cn(depth === 0 && "font-semibold")}>{emp.name}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-400">{emp.code ?? "—"}</td>
                      <td className="px-3 py-2 text-xs text-slate-500 whitespace-nowrap">{getPlanningRoleLabel(emp)}</td>
                      {kpiGroups.map((g) => {
                        const plan = plans.find((p) => p.kpi_group_id === g.id);
                        const target = plan ? getTarget(plan.id, emp.id) : undefined;
                        const val = getMetricValue(target, activeMetric);
                        return (
                          <td key={g.id} className="px-3 py-2 text-center text-xs text-slate-600">
                            {formatNumber(val)}
                          </td>
                        );
                      })}
                      <td className="px-3 py-2 text-right text-xs font-semibold text-slate-700">
                        {formatNumber(empTotal(emp.id, activeMetric))}
                      </td>
                    </tr>
                  );
                })}
                <tr className="border-t border-slate-200 bg-slate-50/80">
                  <td className="px-3 py-2 text-xs font-semibold text-slate-700" colSpan={3}>
                    Итого:
                  </td>
                  {kpiGroups.map((g) => (
                    <td key={g.id} className="px-3 py-2 text-center text-xs font-semibold text-slate-700">
                      {formatNumber(groupTotal(g.id, activeMetric))}
                    </td>
                  ))}
                  <td className="px-3 py-2 text-right text-xs font-semibold text-slate-800">
                    {formatNumber(grandTotal(activeMetric))}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {activeTab === "general" && (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/50">
                  <th className="px-3 py-2.5 text-left text-xs font-medium text-slate-500">Роль</th>
                  <th className="px-3 py-2.5 text-right text-xs font-medium text-slate-500">Сумма</th>
                  <th className="px-3 py-2.5 text-right text-xs font-medium text-slate-500">Количество</th>
                  <th className="px-3 py-2.5 text-right text-xs font-medium text-slate-500">Объем</th>
                  <th className="px-3 py-2.5 text-right text-xs font-medium text-slate-500">АКБ</th>
                  <th className="px-3 py-2.5 text-right text-xs font-medium text-slate-500">Заказы</th>
                </tr>
              </thead>
              <tbody>
                {["director", "sales_director", "commercial_director", "manager", "supervisor", "agent"].map(
                  (role) => {
                    const roleEmpIds = employees.filter((e) => e.role === role).map((e) => e.id);
                    const roleTargets = kpiTargets.filter((t) => roleEmpIds.includes(t.user_id));
                    const totals = {
                      cost: roleTargets.reduce((s, t) => s + Number.parseFloat(t.cost || "0"), 0),
                      count: roleTargets.reduce((s, t) => s + Number.parseFloat(t.count || "0"), 0),
                      volume: roleTargets.reduce((s, t) => s + Number.parseFloat(t.volume || "0"), 0),
                      acb: roleTargets.reduce((s, t) => s + Number.parseFloat(t.acb || "0"), 0),
                      orders: roleTargets.reduce((s, t) => s + (t.order_count || 0), 0)
                    };
                    if (roleEmpIds.length === 0) return null;
                    return (
                      <tr key={role} className="border-b border-slate-50 hover:bg-slate-50/30">
                        <td className="px-3 py-2.5 text-xs font-medium text-slate-700">{getRoleLabel(role)}</td>
                        <td className="px-3 py-2.5 text-right text-xs text-slate-600">{formatNumber(totals.cost)}</td>
                        <td className="px-3 py-2.5 text-right text-xs text-slate-600">{formatNumber(totals.count)}</td>
                        <td className="px-3 py-2.5 text-right text-xs text-slate-600">{formatNumber(totals.volume)}</td>
                        <td className="px-3 py-2.5 text-right text-xs text-slate-600">{formatNumber(totals.acb)}</td>
                        <td className="px-3 py-2.5 text-right text-xs text-slate-600">{formatNumber(totals.orders)}</td>
                      </tr>
                    );
                  }
                )}
                <tr className="border-t border-slate-200 bg-slate-50/80">
                  <td className="px-3 py-2.5 text-xs font-semibold text-slate-800">Всего</td>
                  <td className="px-3 py-2.5 text-right text-xs font-semibold text-slate-800">
                    {formatNumber(kpiTargets.reduce((s, t) => s + Number.parseFloat(t.cost || "0"), 0))}
                  </td>
                  <td className="px-3 py-2.5 text-right text-xs font-semibold text-slate-800">
                    {formatNumber(kpiTargets.reduce((s, t) => s + Number.parseFloat(t.count || "0"), 0))}
                  </td>
                  <td className="px-3 py-2.5 text-right text-xs font-semibold text-slate-800">
                    {formatNumber(kpiTargets.reduce((s, t) => s + Number.parseFloat(t.volume || "0"), 0))}
                  </td>
                  <td className="px-3 py-2.5 text-right text-xs font-semibold text-slate-800">
                    {formatNumber(kpiTargets.reduce((s, t) => s + Number.parseFloat(t.acb || "0"), 0))}
                  </td>
                  <td className="px-3 py-2.5 text-right text-xs font-semibold text-slate-800">
                    {formatNumber(kpiTargets.reduce((s, t) => s + (t.order_count || 0), 0))}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
