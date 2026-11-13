import type { PlanningEmployee } from "./planning-api";
import { filterEmployeesWithAncestors } from "./planning-utils";

/** Tugun + barcha pastki avlodlar. */
export function collectSelfAndDescendantIds(
  rootId: number,
  employees: PlanningEmployee[]
): Set<number> {
  const childrenOf = (parentId: number) =>
    employees.filter((e) => e.parent_id === parentId);
  const keep = new Set<number>([rootId]);
  const walk = (id: number) => {
    for (const child of childrenOf(id)) {
      keep.add(child.id);
      walk(child.id);
    }
  };
  walk(rootId);
  return keep;
}

/** Ota zanjir (root emas). */
export function collectAncestorIds(
  userId: number,
  employees: PlanningEmployee[]
): Set<number> {
  const byId = new Map(employees.map((e) => [e.id, e]));
  const keep = new Set<number>();
  let pid = byId.get(userId)?.parent_id ?? null;
  while (pid != null) {
    keep.add(pid);
    pid = byId.get(pid)?.parent_id ?? null;
  }
  return keep;
}

/**
 * Filial / SVR / qidiruv filtri (multi).
 * Bo‘sh massiv = cheklov yo‘q. Tanlanganlar — pastki daraxt + otalar.
 */
export function filterPlanningEmployeesByScope(
  employees: PlanningEmployee[],
  opts: {
    search?: string;
    filialIds?: number[];
    svrIds?: number[];
    filialId?: number | null;
    svrId?: number | null;
  }
): PlanningEmployee[] {
  let scoped = filterEmployeesWithAncestors(employees, opts.search ?? "");

  const filialIds =
    opts.filialIds?.length
      ? opts.filialIds
      : opts.filialId != null && opts.filialId > 0
        ? [opts.filialId]
        : [];
  const svrIds =
    opts.svrIds?.length
      ? opts.svrIds
      : opts.svrId != null && opts.svrId > 0
        ? [opts.svrId]
        : [];

  const unionSubtree = (rootIds: number[]) => {
    if (rootIds.length === 0) return;
    const keep = new Set<number>();
    for (const rootId of rootIds) {
      for (const id of collectSelfAndDescendantIds(rootId, employees)) keep.add(id);
      for (const id of collectAncestorIds(rootId, employees)) keep.add(id);
    }
    scoped = scoped.filter((e) => keep.has(e.id));
  };

  unionSubtree(filialIds);
  unionSubtree(svrIds);
  return scoped;
}

export type PlanningCompletionFilter = "all" | "closed" | "open";
export type PlanningIssueFilter = "all" | "problem" | "ok";

export function isPlanningTargetClosed(status: string | null | undefined): boolean {
  return (status ?? "").trim() === "approved";
}

export function isPlanningTargetProblematic(
  status: string | null | undefined,
  hasMismatch: boolean
): boolean {
  if (hasMismatch) return true;
  return (status ?? "").trim() === "rejected";
}

/** Agent qatorlari bo‘yicha completion/issue filtri + otalarni saqlash. */
export function filterPlanningEmployeesByPlanState(
  employees: PlanningEmployee[],
  opts: {
    completion: PlanningCompletionFilter;
    issue: PlanningIssueFilter;
    statusByUserId: Map<number, string>;
    mismatchByUserId: Map<number, boolean>;
  }
): PlanningEmployee[] {
  if (opts.completion === "all" && opts.issue === "all") return employees;

  const keepAgents = new Set<number>();
  for (const e of employees) {
    if (e.role !== "agent") continue;
    const status = opts.statusByUserId.get(e.id) ?? "draft";
    const closed = isPlanningTargetClosed(status);
    if (opts.completion === "closed" && !closed) continue;
    if (opts.completion === "open" && closed) continue;
    const problem = isPlanningTargetProblematic(
      status,
      opts.mismatchByUserId.get(e.id) === true
    );
    if (opts.issue === "problem" && !problem) continue;
    if (opts.issue === "ok" && problem) continue;
    keepAgents.add(e.id);
  }

  if (keepAgents.size === 0) return [];

  const byId = new Map(employees.map((e) => [e.id, e]));
  const keep = new Set<number>(keepAgents);
  for (const id of keepAgents) {
    let pid = byId.get(id)?.parent_id ?? null;
    while (pid != null) {
      keep.add(pid);
      pid = byId.get(pid)?.parent_id ?? null;
    }
  }
  return employees.filter((e) => keep.has(e.id));
}

export function planningFilialOptions(
  employees: PlanningEmployee[]
): Array<{ id: number; name: string }> {
  return employees
    .filter((e) => e.role === "branch")
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name, "ru"))
    .map((e) => ({ id: e.id, name: e.name }));
}

/** Filial(lar) tanlangan bo‘lsa — faqat shu filial(lar) ostidagi SVR. */
export function planningSvrOptions(
  employees: PlanningEmployee[],
  filialIds?: number[] | number | null
): Array<{ id: number; name: string }> {
  const ids = Array.isArray(filialIds)
    ? filialIds
    : filialIds != null && filialIds > 0
      ? [filialIds]
      : [];
  const underFilial =
    ids.length > 0
      ? ids.reduce((acc, fid) => {
          for (const id of collectSelfAndDescendantIds(fid, employees)) acc.add(id);
          return acc;
        }, new Set<number>())
      : null;
  return employees
    .filter((e) => {
      if (e.role !== "supervisor") return false;
      if (underFilial && !underFilial.has(e.id)) return false;
      return true;
    })
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name, "ru"))
    .map((e) => ({ id: e.id, name: e.name }));
}
