"use client";

import { useMemo } from "react";
import type { PlanningEmployee, PlanningKpiGroup, PlanningPlan, PlanningTarget } from "./planning-api";
import {
  buildPlanningFilialSections,
  resolveBlockKpiGroups,
  type PlanningColumnConfig
} from "./planning-blocks";
import { PlanningBlockTable } from "./planning-block-table";
import { getPlanningRoleLabel } from "./planning-utils";
import type { MetricField } from "./planning-cells";

export type { PlanningColumnConfig };

interface PlanningTableProps {
  employees: PlanningEmployee[];
  kpiGroups: PlanningKpiGroup[];
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
}

export function PlanningTable({
  employees,
  kpiGroups,
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
}: PlanningTableProps) {
  const sections = useMemo(() => buildPlanningFilialSections(employees), [employees]);

  const hasAnyPlan = kpiGroups.some((g) => plans.some((p) => p.kpi_group_id === g.id));

  if (kpiGroups.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
        Группы KPI не найдены. Добавьте группу в Настройки → Группа KPI.
      </div>
    );
  }

  if (!hasAnyPlan) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
        Не удалось создать планы для выбранного периода. Нажмите «Обновить» или проверьте настройки
        KPI-групп.
      </div>
    );
  }

  if (sections.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
        Сотрудники для выбранного направления не найдены. Проверьте привязку агентов к KPI-группе и
        настройку утверждающих.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {sections.map((section) => (
        <section key={section.key} className="space-y-3">
          <header className="flex flex-wrap items-baseline gap-2 border-b border-slate-200 pb-2">
            <h2 className="text-base font-semibold tracking-tight text-slate-900">{section.title}</h2>
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
              const isFilialAgentsBlock = block.key.startsWith("filial-agents-");
              const blockTitle = isFilialAgentsBlock
                ? `${section.title} · агенты`
                : block.head.name;
              const blockSubtitle = isFilialAgentsBlock
                ? null
                : getPlanningRoleLabel(block.head);

              return (
                <PlanningBlockTable
                  key={block.key}
                  block={block}
                  blockTitle={blockTitle}
                  blockSubtitle={blockSubtitle}
                  kpiGroups={blockGroups}
                  allEmployees={employees}
                  kpiTargets={kpiTargets}
                  plans={plans}
                  canWrite={canWrite}
                  columnConfigs={columnConfigs}
                  onColumnConfigsChange={onColumnConfigsChange}
                  onUpdateTarget={onUpdateTarget}
                  onUpdateStatus={onUpdateStatus}
                  onUpdateComment={onUpdateComment}
                  agentKpiIds={agentKpiIds}
                  kpiGroupIdsWithAgents={kpiGroupIdsWithAgents}
                />
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
