"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { Search, FileSpreadsheet } from "lucide-react";
import type { PlanningEmployee, PlanningKpiGroup, PlanningPlan, PlanningTarget } from "./planning-api";
import {
  buildPlanningFilialSections,
  resolveBlockKpiGroups
} from "./planning-blocks";
import {
  formatNumber,
  getPlanningRoleLabel,
  getRoleLabel,
  isPlanningKpiCellEditable,
  sumDescendantAgentMetric
} from "./planning-utils";

interface TotalsSectionProps {
  employees: PlanningEmployee[];
  kpiGroups: PlanningKpiGroup[];
  kpiTargets: PlanningTarget[];
  plans: PlanningPlan[];
  agentKpiIds?: Record<string, number[]>;
  kpiGroupIdsWithAgents?: number[];
}

export function TotalsSection({
  employees,
  kpiGroups,
  kpiTargets,
  plans,
  agentKpiIds,
  kpiGroupIdsWithAgents
}: TotalsSectionProps) {
  const [activeTab, setActiveTab] = useState<"detailed" | "general">("detailed");
  const [activeMetric, setActiveMetric] = useState<string>("Сумма");
  const [search, setSearch] = useState("");

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

  const rowMetricValue = (emp: PlanningEmployee, groupId: number, metric: string): number => {
    const plan = plans.find((p) => p.kpi_group_id === groupId);
    if (!plan) return 0;
    const own = getMetricValue(getTarget(plan.id, emp.id), metric);
    if (emp.role === "agent") return own;
    if (own !== 0) return own;
    return sumDescendantAgentMetric(emp.id, employees, (agentId) =>
      getMetricValue(getTarget(plan.id, agentId), metric)
    );
  };

  const sections = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return buildPlanningFilialSections(employees);
    const matched = employees.filter(
      (e) => e.name.toLowerCase().includes(q) || (e.code ?? "").toLowerCase().includes(q)
    );
    if (matched.length === 0) return [];
    return buildPlanningFilialSections(mergeWithAncestors(employees, matched));
  }, [employees, search]);

  const metrics = ["Сумма", "Количество", "Объем", "АКБ", "Кол-во-заказов"];

  const groupTotal = (groupId: number, metric: string, agentIds: number[]) =>
    agentIds.reduce((s, agentId) => {
      const plan = plans.find((p) => p.kpi_group_id === groupId);
      if (!plan) return s;
      return s + getMetricValue(getTarget(plan.id, agentId), metric);
    }, 0);

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
          <div className="space-y-6">
            {sections.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-500">Нет данных для отображения.</p>
            ) : (
              sections.map((section) => (
                <section key={section.key} className="space-y-3">
                  <header className="flex flex-wrap items-baseline gap-2 border-b border-slate-200 pb-2">
                    <h2 className="text-base font-semibold text-slate-900">{section.title}</h2>
                    {section.subtitle ? (
                      <span className="text-xs text-slate-500">{section.subtitle}</span>
                    ) : null}
                  </header>
                  <div className="space-y-4">
                    {section.blocks.map((block) => {
                      const blockGroups = resolveBlockKpiGroups(
                        block.agentIds,
                        kpiGroups,
                        agentKpiIds,
                        kpiGroupIdsWithAgents
                      );
                      if (blockGroups.length === 0) {
                        return (
                          <div
                            key={block.key}
                            className="rounded-lg border border-dashed border-slate-200 bg-slate-50/50 px-3 py-3 text-xs text-slate-500"
                          >
                            <span className="font-medium text-slate-700">{block.head.name}</span>
                            {" — нет привязанных KPI"}
                          </div>
                        );
                      }
                      const title =
                        block.key.startsWith("filial-agents-")
                          ? `${section.title} · агенты`
                          : block.head.name;
                      return (
                        <div
                          key={block.key}
                          className="overflow-hidden rounded-lg border border-slate-200 shadow-sm"
                        >
                          <div className="border-b border-slate-100 bg-slate-50/90 px-3 py-2">
                            <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
                            <p className="text-[10px] text-slate-400">
                              KPI: {blockGroups.map((g) => g.name).join(" · ")}
                            </p>
                          </div>
                          <div className="overflow-x-auto">
                            <table className="w-max min-w-full border-collapse text-sm">
                              <thead>
                                <tr className="border-b border-slate-200 bg-slate-50/50">
                                  <th className="min-w-[180px] px-3 py-2 text-left text-xs font-medium text-slate-500">
                                    Ф.И.О
                                  </th>
                                  <th className="min-w-[70px] px-3 py-2 text-left text-xs font-medium text-slate-500">
                                    Код
                                  </th>
                                  <th className="min-w-[100px] px-3 py-2 text-left text-xs font-medium text-slate-500">
                                    Роль
                                  </th>
                                  {blockGroups.map((g) => (
                                    <th
                                      key={g.id}
                                      className="whitespace-nowrap border-l border-slate-100 px-3 py-2 text-center text-xs font-medium text-slate-500"
                                    >
                                      {g.name}
                                    </th>
                                  ))}
                                  <th className="min-w-[80px] border-l border-slate-200 px-3 py-2 text-right text-xs font-medium text-slate-500">
                                    Итого
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {block.rows.map(({ emp, depth }) => {
                                  const rowTotal = blockGroups.reduce(
                                    (s, g) => s + rowMetricValue(emp, g.id, activeMetric),
                                    0
                                  );
                                  return (
                                    <tr
                                      key={emp.id}
                                      className="border-b border-slate-50 hover:bg-slate-50/30"
                                    >
                                      <td className="px-3 py-2 text-xs text-slate-700">
                                        <span
                                          className={cn(depth === 0 && "font-semibold")}
                                          style={{ paddingLeft: depth * 12 }}
                                        >
                                          {emp.name}
                                        </span>
                                      </td>
                                      <td className="px-3 py-2 text-xs text-slate-400">
                                        {emp.code ?? "—"}
                                      </td>
                                      <td className="whitespace-nowrap px-3 py-2 text-xs text-slate-500">
                                        {getPlanningRoleLabel(emp)}
                                      </td>
                                      {blockGroups.map((g) => {
                                        const linked = isPlanningKpiCellEditable(
                                          emp,
                                          g.id,
                                          agentKpiIds,
                                          kpiGroupIdsWithAgents
                                        );
                                        if (!linked) {
                                          return (
                                            <td
                                              key={g.id}
                                              className="border-l border-slate-50 px-3 py-2 text-center text-xs text-slate-300"
                                            >
                                              —
                                            </td>
                                          );
                                        }
                                        const val = rowMetricValue(emp, g.id, activeMetric);
                                        return (
                                          <td
                                            key={g.id}
                                            className="border-l border-slate-50 px-3 py-2 text-center text-xs text-slate-600"
                                          >
                                            {formatNumber(val)}
                                          </td>
                                        );
                                      })}
                                      <td className="border-l border-slate-100 px-3 py-2 text-right text-xs font-semibold text-slate-700">
                                        {formatNumber(rowTotal)}
                                      </td>
                                    </tr>
                                  );
                                })}
                                <tr className="border-t border-slate-200 bg-slate-50/80">
                                  <td className="px-3 py-2 text-xs font-semibold text-slate-700" colSpan={3}>
                                    Итого блока:
                                  </td>
                                  {blockGroups.map((g) => (
                                    <td
                                      key={g.id}
                                      className="border-l border-slate-100 px-3 py-2 text-center text-xs font-semibold text-slate-700"
                                    >
                                      {formatNumber(
                                        groupTotal(g.id, activeMetric, block.agentIds)
                                      )}
                                    </td>
                                  ))}
                                  <td className="border-l border-slate-200 px-3 py-2 text-right text-xs font-semibold text-slate-800">
                                    {formatNumber(
                                      blockGroups.reduce(
                                        (s, g) =>
                                          s + groupTotal(g.id, activeMetric, block.agentIds),
                                        0
                                      )
                                    )}
                                  </td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              ))
            )}
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
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

/** Qidiruvda topilganlar + ularning otalari (bloklar buzilmasin). */
function mergeWithAncestors(
  all: PlanningEmployee[],
  matched: PlanningEmployee[]
): PlanningEmployee[] {
  const byId = new Map(all.map((e) => [e.id, e]));
  const keep = new Set(matched.map((e) => e.id));
  for (const e of matched) {
    let pid = e.parent_id;
    while (pid != null) {
      keep.add(pid);
      pid = byId.get(pid)?.parent_id ?? null;
    }
  }
  return all.filter((e) => keep.has(e.id));
}
