import type { PlanningEmployee } from "./planning-api";
import { filterEmployeesWithAncestors, sortEmployeesByRole } from "./planning-utils";

/** Filial va SVR config tartibida, qolganlari rol bo‘yicha. */
export function sortTreeSiblings(a: PlanningEmployee, b: PlanningEmployee): number {
  if (a.role === "branch" && b.role === "branch") {
    return a.name.localeCompare(b.name, "ru");
  }
  if (a.role === "supervisor" && b.role === "supervisor") {
    const ai = a.supervisor_config_index ?? 9999;
    const bi = b.supervisor_config_index ?? 9999;
    if (ai !== bi) return ai - bi;
  }
  return sortEmployeesByRole(a, b);
}

export function getPlanningParentIds(employees: PlanningEmployee[]): Set<number> {
  const set = new Set<number>();
  for (const employee of employees) {
    if (employees.some((child) => child.parent_id === employee.id)) set.add(employee.id);
  }
  return set;
}

/** Filial va SVR ochiq — agentlar yopiq. */
export function defaultExpandedPlanningNodes(employees: PlanningEmployee[]): Set<number> {
  const parentIds = getPlanningParentIds(employees);
  const expanded = new Set<number>();
  for (const e of employees) {
    if (!parentIds.has(e.id)) continue;
    if (e.role === "agent") continue;
    expanded.add(e.id);
  }
  return expanded;
}

export function buildPlanningTreeHelpers(employees: PlanningEmployee[]) {
  const getChildren = (parentId: number) =>
    employees.filter((employee) => employee.parent_id === parentId).sort(sortTreeSiblings);

  const rootEmployees = employees
    .filter((employee) => employee.parent_id === null)
    .sort(sortTreeSiblings);

  return { getChildren, rootEmployees, parentIds: getPlanningParentIds(employees) };
}

export function flattenPlanningTree(
  employees: PlanningEmployee[],
  expanded: Set<number>,
  searchQuery = ""
): Array<{ emp: PlanningEmployee; depth: number }> {
  const scoped = filterEmployeesWithAncestors(employees, searchQuery);
  const { getChildren, rootEmployees } = buildPlanningTreeHelpers(scoped);
  const list: Array<{ emp: PlanningEmployee; depth: number }> = [];

  const traverse = (emps: PlanningEmployee[], depth: number) => {
    for (const emp of emps) {
      list.push({ emp, depth });
      if (expanded.has(emp.id)) traverse(getChildren(emp.id), depth + 1);
    }
  };

  traverse(rootEmployees, 0);
  return list;
}
