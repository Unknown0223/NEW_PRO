"use client";

import { useState } from "react";
import { cn, formatNumber, getRoleLabel } from "@/lib/utils";
import { Search, FileSpreadsheet, SlidersHorizontal, Sigma, ChevronDown } from "lucide-react";

interface Employee {
  id: number;
  name: string;
  code: string;
  role: string;
}

interface KpiGroup {
  id: number;
  name: string;
}

interface KpiTarget {
  planId: number;
  employeeId: number;
  cost: string | null;
  count: string | null;
  volume: string | null;
  acb: string | null;
  orderCount: number | null;
}

interface Plan {
  id: number;
  kpiGroupId: number;
}

interface TotalsSectionProps {
  employees: Employee[];
  kpiGroups: KpiGroup[];
  kpiTargets: KpiTarget[];
  plans: Plan[];
}

export function TotalsSection({ employees, kpiGroups, kpiTargets, plans }: TotalsSectionProps) {
  const [activeTab, setActiveTab] = useState<"detailed" | "general">("detailed");
  const [activeMetric, setActiveMetric] = useState<string>("Сумма");
  const [search, setSearch] = useState("");

  const filteredEmployees = employees.filter((e) =>
    e.name.toLowerCase().includes(search.toLowerCase())
  );

  const getTarget = (planId: number, empId: number) =>
    kpiTargets.find((t) => t.planId === planId && t.employeeId === empId);

  const getMetricValue = (target: KpiTarget | undefined, metric: string): number => {
    if (!target) return 0;
    switch (metric) {
      case "Сумма": return parseFloat(target.cost || "0");
      case "Количество": return parseFloat(target.count || "0");
      case "Объем": return parseFloat(target.volume || "0");
      case "АКБ": return parseFloat(target.acb || "0");
      case "Кол-во-заказов": return target.orderCount || 0;
      default: return parseFloat(target.cost || "0");
    }
  };

  const groupTotal = (groupId: number, metric: string) => {
    const plan = plans.find((p) => p.kpiGroupId === groupId);
    if (!plan) return 0;
    return kpiTargets
      .filter((t) => t.planId === plan.id)
      .reduce((s, t) => s + getMetricValue(t, metric), 0);
  };

  const empTotal = (empId: number, metric: string) =>
    kpiTargets
      .filter((t) => t.employeeId === empId)
      .reduce((s, t) => s + getMetricValue(t, metric), 0);

  const grandTotal = (metric: string) =>
    kpiTargets.reduce((s, t) => s + getMetricValue(t, metric), 0);

  const metrics = ["Сумма", "Количество", "Объем", "АКБ", "Кол-во-заказов"];

  const metricLabel = activeMetric === "Сумма" ? "Сумма по группе KPI" : `${activeMetric} по группе KPI`;

  return (
    <div>
      {/* Tabs */}
      <div className="flex items-center border-b border-slate-200 mb-0">
        <button
          onClick={() => setActiveTab("detailed")}
          className={cn(
            "px-4 py-2.5 text-sm font-medium border-b-2 transition-colors",
            activeTab === "detailed"
              ? "border-teal-600 text-teal-700"
              : "border-transparent text-slate-500 hover:text-slate-700"
          )}
        >
          Детальный итоги
        </button>
        <button
          onClick={() => setActiveTab("general")}
          className={cn(
            "px-4 py-2.5 text-sm font-medium border-b-2 transition-colors",
            activeTab === "general"
              ? "border-teal-600 text-teal-700"
              : "border-transparent text-slate-500 hover:text-slate-700"
          )}
        >
          Общие итоги
        </button>
      </div>

      <div className="rounded-b-lg border border-t-0 border-slate-200 bg-white p-4 shadow-sm">
        {/* Toolbar */}
        <div className="flex items-center justify-between mb-3">
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
            <button className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50">
              <SlidersHorizontal className="h-4 w-4" />
            </button>
            <button className="flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-600 hover:bg-slate-50">
              <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
              Excel
            </button>
          </div>

          {/* Metric tabs */}
          <div className="flex items-center gap-1">
            {metrics.map((m) => (
              <button
                key={m}
                onClick={() => setActiveMetric(m)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                  activeMetric === m
                    ? "bg-teal-600 text-white"
                    : "text-slate-500 hover:bg-slate-100"
                )}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        {activeTab === "detailed" && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="px-3 py-2.5 text-left text-xs font-medium text-slate-500 w-[200px]">Ф.И.О</th>
                  <th className="px-3 py-2.5 text-left text-xs font-medium text-slate-500 w-[60px]">Код</th>
                  <th className="px-3 py-2.5 text-left text-xs font-medium text-slate-500 w-[90px]">Роль</th>
                  <th className="px-3 py-2.5 text-center text-xs font-medium text-slate-400" colSpan={kpiGroups.length}>
                    {metricLabel}
                  </th>
                  <th className="px-3 py-2.5 text-right text-xs font-medium text-slate-500 w-[80px]">Итого</th>
                </tr>
                <tr className="border-b border-slate-200 bg-slate-50/50">
                  <th className="px-3 py-2" colSpan={3} />
                  {kpiGroups.map((g) => (
                    <th key={g.id} className="px-3 py-2 text-center text-xs font-medium text-slate-500 whitespace-nowrap">
                      {g.name}
                    </th>
                  ))}
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {filteredEmployees.map((emp) => (
                  <tr key={emp.id} className="border-b border-slate-50 hover:bg-slate-50/30">
                    <td className="px-3 py-2 text-xs text-slate-700">
                      <div className="flex items-center gap-1.5">
                        {emp.name}
                        <button className="text-slate-400 hover:text-slate-600">
                          <ChevronDown className="h-3 w-3" />
                        </button>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-400">{emp.code}</td>
                    <td className="px-3 py-2 text-xs text-slate-500">{getRoleLabel(emp.role)}</td>
                    {kpiGroups.map((g) => {
                      const plan = plans.find((p) => p.kpiGroupId === g.id);
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
                ))}
                <tr className="bg-slate-50/80 border-t border-slate-200">
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
            <table className="w-full text-sm border-collapse">
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
                    const roleTargets = kpiTargets.filter((t) => roleEmpIds.includes(t.employeeId));
                    const totals = {
                      cost: roleTargets.reduce((s, t) => s + parseFloat(t.cost || "0"), 0),
                      count: roleTargets.reduce((s, t) => s + parseFloat(t.count || "0"), 0),
                      volume: roleTargets.reduce((s, t) => s + parseFloat(t.volume || "0"), 0),
                      acb: roleTargets.reduce((s, t) => s + parseFloat(t.acb || "0"), 0),
                      orders: roleTargets.reduce((s, t) => s + (t.orderCount || 0), 0),
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
                <tr className="bg-slate-50/80 border-t border-slate-200">
                  <td className="px-3 py-2.5 text-xs font-semibold text-slate-800">Всего</td>
                  <td className="px-3 py-2.5 text-right text-xs font-semibold text-slate-800">
                    {formatNumber(kpiTargets.reduce((s, t) => s + parseFloat(t.cost || "0"), 0))}
                  </td>
                  <td className="px-3 py-2.5 text-right text-xs font-semibold text-slate-800">
                    {formatNumber(kpiTargets.reduce((s, t) => s + parseFloat(t.count || "0"), 0))}
                  </td>
                  <td className="px-3 py-2.5 text-right text-xs font-semibold text-slate-800">
                    {formatNumber(kpiTargets.reduce((s, t) => s + parseFloat(t.volume || "0"), 0))}
                  </td>
                  <td className="px-3 py-2.5 text-right text-xs font-semibold text-slate-800">
                    {formatNumber(kpiTargets.reduce((s, t) => s + parseFloat(t.acb || "0"), 0))}
                  </td>
                  <td className="px-3 py-2.5 text-right text-xs font-semibold text-slate-800">
                    {formatNumber(kpiTargets.reduce((s, t) => s + (t.orderCount || 0), 0))}
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
