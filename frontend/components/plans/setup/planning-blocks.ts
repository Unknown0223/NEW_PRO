import type { PlanningEmployee, PlanningKpiGroup } from "./planning-api";
import { buildPlanningTreeHelpers } from "./planning-tree";
import { getPlanningRoleLabel } from "./planning-utils";

export type PlanningColumnConfig = {
  groupId: number;
  metrics: string[];
};

export type PlanningSvrBlock = {
  key: string;
  filial: PlanningEmployee | null;
  head: PlanningEmployee;
  /** Blokdagi barcha qatorlar: head + pastki daraxt (tekis, depth bilan) */
  rows: Array<{ emp: PlanningEmployee; depth: number }>;
  agentIds: number[];
};

export type PlanningFilialSection = {
  key: string;
  filial: PlanningEmployee | null;
  title: string;
  subtitle: string | null;
  blocks: PlanningSvrBlock[];
};

function collectSubtree(
  rootId: number,
  getChildren: (id: number) => PlanningEmployee[]
): PlanningEmployee[] {
  const out: PlanningEmployee[] = [];
  const walk = (id: number) => {
    for (const child of getChildren(id)) {
      out.push(child);
      walk(child.id);
    }
  };
  walk(rootId);
  return out;
}

function flattenUnderHead(
  head: PlanningEmployee,
  getChildren: (id: number) => PlanningEmployee[]
): Array<{ emp: PlanningEmployee; depth: number }> {
  const rows: Array<{ emp: PlanningEmployee; depth: number }> = [{ emp: head, depth: 0 }];
  const walk = (id: number, depth: number) => {
    for (const child of getChildren(id)) {
      rows.push({ emp: child, depth });
      walk(child.id, depth + 1);
    }
  };
  walk(head.id, 1);
  return rows;
}

function agentIdsIn(emps: PlanningEmployee[]): number[] {
  return emps.filter((e) => e.role === "agent").map((e) => e.id);
}

/**
 * Filial bo‘limlari, ichida SVR (yoki to‘g‘ridan agent) bloklari.
 * Har blok — alohida jadval uchun.
 */
export function buildPlanningFilialSections(
  employees: PlanningEmployee[]
): PlanningFilialSection[] {
  const { getChildren, rootEmployees } = buildPlanningTreeHelpers(employees);
  const sections: PlanningFilialSection[] = [];

  const makeSvrBlock = (
    filial: PlanningEmployee | null,
    head: PlanningEmployee
  ): PlanningSvrBlock => {
    const subtree = collectSubtree(head.id, getChildren);
    const rows = flattenUnderHead(head, getChildren);
    return {
      key: `svr-${head.id}`,
      filial,
      head,
      rows,
      agentIds: agentIdsIn([head, ...subtree])
    };
  };

  const branchRoots = rootEmployees.filter((e) => e.role === "branch");
  const otherRoots = rootEmployees.filter((e) => e.role !== "branch");

  for (const filial of branchRoots) {
    const children = getChildren(filial.id);
    const blocks: PlanningSvrBlock[] = [];
    const directAgents: PlanningEmployee[] = [];

    for (const child of children) {
      if (child.role === "agent") {
        directAgents.push(child);
        continue;
      }
      blocks.push(makeSvrBlock(filial, child));
    }

    if (directAgents.length > 0) {
      blocks.push({
        key: `filial-agents-${filial.id}`,
        filial,
        head: filial,
        rows: [
          { emp: filial, depth: 0 },
          ...directAgents.map((emp) => ({ emp, depth: 1 }))
        ],
        agentIds: directAgents.map((a) => a.id)
      });
    }

    if (blocks.length === 0) {
      blocks.push({
        key: `filial-empty-${filial.id}`,
        filial,
        head: filial,
        rows: [{ emp: filial, depth: 0 }],
        agentIds: []
      });
    }

    sections.push({
      key: `filial-${filial.id}`,
      filial,
      title: filial.name,
      subtitle: getPlanningRoleLabel(filial),
      blocks
    });
  }

  if (otherRoots.length > 0) {
    const blocks: PlanningSvrBlock[] = otherRoots.map((head) => makeSvrBlock(null, head));
    sections.push({
      key: "section-other",
      filial: null,
      title: branchRoots.length > 0 ? "Другие" : "Сотрудники",
      subtitle: null,
      blocks
    });
  }

  return sections;
}

/**
 * Blok ustunlari: faqat shu blok agentlariga bog‘langan KPI.
 * Guruhda agent ro‘yxati bo‘lmasa — ochiq (blokda agent bo‘lsa ko‘rinadi).
 */
export function resolveBlockKpiGroups(
  agentIds: number[],
  groups: PlanningKpiGroup[],
  agentKpiIds: Record<string, number[]> | undefined,
  kpiGroupIdsWithAgents: number[] | undefined
): PlanningKpiGroup[] {
  if (agentIds.length === 0 || groups.length === 0) return [];
  const restricted = new Set(kpiGroupIdsWithAgents ?? []);
  return groups.filter((g) => {
    if (!restricted.has(g.id)) return true;
    return agentIds.some((id) => (agentKpiIds?.[String(id)] ?? []).includes(g.id));
  });
}
