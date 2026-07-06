import type { ApproverConfig } from "./plans.approvers.service";
import { autoChainRoleRank } from "./plans.setup.roles";

export type HierarchyUser = {
  id: number;
  name: string;
  login: string;
  role: string;
  code: string | null;
  supervisor_user_id: number | null;
};

export type PlanningEmployeeNode = {
  id: number;
  name: string;
  code: string | null;
  role: string;
  parent_id: number | null;
  /** «Настройка утверждающих» qator tartibi (supervayzerlar uchun). */
  supervisor_config_index: number | null;
  /** Umumiy «Степень» zanjiridagi tartib (1..N), maydon agenti emas. */
  chain_level: number | null;
};

type BuildHierarchyInput = {
  agents: HierarchyUser[];
  approverCfg: ApproverConfig;
  autoManagers: HierarchyUser[];
  userById: Map<number, HierarchyUser>;
  personName: (u: { name: string; login: string }) => string;
};

/**
 * Ko‘rsatish daraxti (yuqoridan pastga):
 * Rahbarlar → Степень 1..N → Supervayzerlar (config tartibi) → Agentlar.
 */
export function buildPlanningEmployeeNodes(input: BuildHierarchyInput): PlanningEmployeeNode[] {
  const { agents, approverCfg, autoManagers, userById, personName } = input;
  const parentByUser = new Map<number, number | null>();
  const userIds = new Set<number>();
  const supervisorConfigIndex = new Map<number, number>();
  const fieldAgentIds = new Set(agents.map((a) => a.id));

  const leaders = approverCfg.leaders.filter((id) => id > 0);
  const leaderSet = new Set(leaders);
  for (let i = 0; i < leaders.length; i++) {
    userIds.add(leaders[i]!);
    parentByUser.set(leaders[i]!, i === 0 ? null : leaders[i - 1]!);
  }
  const bottomLeader = leaders.length > 0 ? leaders[leaders.length - 1]! : null;

  const configSupervisorIds = approverCfg.rows.map((r) => r.supervisor_user_id);
  configSupervisorIds.forEach((id, idx) => supervisorConfigIndex.set(id, idx));

  for (const row of approverCfg.rows) {
    userIds.add(row.supervisor_user_id);
    for (const lvl of row.levels) if (lvl != null && lvl > 0) userIds.add(lvl);
  }

  const levelChain = resolveCommonLevelChain(approverCfg, leaderSet);
  const levelChainUserIds = new Set(levelChain);
  const chainLevelByUser = new Map<number, number>();
  levelChain.forEach((id, idx) => chainLevelByUser.set(id, idx + 1));
  let attachParent = bottomLeader;
  for (const lvlUser of levelChain) {
    parentByUser.set(lvlUser, attachParent);
    userIds.add(lvlUser);
    attachParent = lvlUser;
  }

  const sortedAutoManagers = [...autoManagers].sort(
    (a, b) => autoChainRoleRank(a.role) - autoChainRoleRank(b.role)
  );
  if (levelChain.length === 0 && sortedAutoManagers.length > 0) {
    for (const m of sortedAutoManagers) {
      parentByUser.set(m.id, attachParent);
      userIds.add(m.id);
      attachParent = m.id;
    }
  }

  const supervisorAttachParent = attachParent ?? bottomLeader;

  for (const supId of configSupervisorIds) {
    parentByUser.set(supId, supervisorAttachParent);
    userIds.add(supId);
  }

  // «Степень» zanjiridagi agent maydon agenti sifatida qayta biriktirilmasin (SVR↔agent tsikl).
  for (const a of agents) {
    if (a.supervisor_user_id == null) continue;
    if (levelChainUserIds.has(a.id)) continue;
    userIds.add(a.id);
    userIds.add(a.supervisor_user_id);
    parentByUser.set(a.id, a.supervisor_user_id);
    if (!parentByUser.has(a.supervisor_user_id)) {
      parentByUser.set(a.supervisor_user_id, supervisorAttachParent);
    }
  }

  repairMissingParents(parentByUser, userIds);

  const out: PlanningEmployeeNode[] = [];
  for (const id of userIds) {
    const u = userById.get(id);
    if (!u) continue;
    let parentId = parentByUser.get(id) ?? null;
    if (parentId != null && !userById.has(parentId)) parentId = null;
    out.push({
      id: u.id,
      name: personName(u),
      code: u.code,
      role: u.role,
      parent_id: parentId,
      supervisor_config_index:
        u.role === "supervisor" ? (supervisorConfigIndex.get(u.id) ?? null) : null,
      chain_level: chainLevelByUser.get(u.id) ?? null
    });
  }

  return out;
}

/** Umumiy «Степень» zanjir — birinchi qator bo‘yicha, rahbarlar dublikatini o‘tkazib yuboradi. */
function resolveCommonLevelChain(approverCfg: ApproverConfig, leaderSet: Set<number>): number[] {
  if (approverCfg.rows.length === 0) return [];
  const maxLen = Math.max(...approverCfg.rows.map((r) => r.levels.length));
  const chain: number[] = [];
  for (let i = 0; i < maxLen; i++) {
    const id = approverCfg.rows[0]!.levels[i];
    if (id == null || id <= 0) continue;
    if (leaderSet.has(id)) continue;
    if (chain.includes(id)) continue;
    chain.push(id);
  }
  return chain;
}

function repairMissingParents(parentByUser: Map<number, number | null>, userIds: Set<number>): void {
  for (const id of userIds) {
    const pid = parentByUser.get(id);
    if (pid != null) userIds.add(pid);
  }
}
