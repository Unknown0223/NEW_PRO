import type { ApproverConfigRow } from "./plans.approvers.service";

/** Yo‘nalish agentlari biriktirilgan SVR id lari. */
export function collectSupervisorIdsWithFieldAgents(
  agents: ReadonlyArray<{ supervisor_user_id: number | null }>
): Set<number> {
  return new Set(
    agents.map((a) => a.supervisor_user_id).filter((id): id is number => id != null && id > 0)
  );
}

/** Yo‘nalish agentlari biriktirilgan SVR qatorlari (approver config dan). */
export function scopeApproverRowsByFieldAgents(
  rows: ApproverConfigRow[],
  agents: ReadonlyArray<{ supervisor_user_id: number | null }>
): ApproverConfigRow[] {
  const supervisorIdsWithAgents = collectSupervisorIdsWithFieldAgents(agents);
  return rows.filter((r) => supervisorIdsWithAgents.has(r.supervisor_user_id));
}

export function collectLevelUserIds(rows: ApproverConfigRow[]): Set<number> {
  const set = new Set<number>();
  for (const row of rows) {
    for (const lvl of row.levels) if (lvl != null && lvl > 0) set.add(lvl);
  }
  return set;
}

export type PlanningNodeLike = {
  id: number;
  role: string;
  chain_level?: number | null;
};

/** Reja daraxti — faqat yo‘nalishga tegishli SVR/agent + rahbarlar/stepenlar. */
export function filterPlanningHierarchyNodes<T extends PlanningNodeLike>(input: {
  nodes: T[];
  leaderIds: readonly number[];
  scopedRows: ApproverConfigRow[];
  fieldAgentIds: ReadonlySet<number>;
  supervisorIdsWithAgents: ReadonlySet<number>;
  userMatchesDirection: (userId: number) => boolean;
}): T[] {
  const leaderSet = new Set(input.leaderIds);
  const configLevelUserIds = collectLevelUserIds(input.scopedRows);

  return input.nodes.filter((n) => {
    if (leaderSet.has(n.id)) return true;
    if (configLevelUserIds.has(n.id)) return true;
    if (n.role === "agent") return input.fieldAgentIds.has(n.id);
    if (n.role === "supervisor") return input.supervisorIdsWithAgents.has(n.id);
    return input.userMatchesDirection(n.id);
  });
}
