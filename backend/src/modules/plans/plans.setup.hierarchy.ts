import type { ApproverConfig } from "./plans.approvers.service";

export type HierarchyUser = {
  id: number;
  name: string;
  login: string;
  role: string;
  code: string | null;
  branch: string | null;
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
  branchLookup: ActiveBranchLookup;
};

const UNASSIGNED_BRANCH_KEY = "—";

export type ActiveBranchLookup = {
  /** Katalog kaliti (nom/kod, kichik harf) → ko‘rsatish nomi. */
  canonicalByKey: Map<string, string>;
};

/** «Настройки → Филиалы» dagi faol filiallar — hodim qatoridagi erkin matn emas. */
export function buildActiveBranchLookup(
  branches: ReadonlyArray<{ name: string; code?: string | null; active?: boolean }>
): ActiveBranchLookup {
  const canonicalByKey = new Map<string, string>();
  for (const branch of branches) {
    if (branch.active === false) continue;
    const name = branch.name.trim();
    if (!name) continue;
    const keys = [name.toLocaleLowerCase("ru")];
    const code = branch.code?.trim();
    if (code) keys.push(code.toLocaleLowerCase("en"));
    for (const key of keys) {
      if (!canonicalByKey.has(key)) canonicalByKey.set(key, name);
    }
  }
  return { canonicalByKey };
}

function normalizeUserBranchToCatalog(
  raw: string | null | undefined,
  branchLookup: ActiveBranchLookup
): string {
  const trimmed = raw?.trim();
  if (!trimmed) return UNASSIGNED_BRANCH_KEY;
  if (branchLookup.canonicalByKey.size === 0) return UNASSIGNED_BRANCH_KEY;
  return (
    branchLookup.canonicalByKey.get(trimmed.toLocaleLowerCase("ru")) ??
    branchLookup.canonicalByKey.get(trimmed.toLocaleLowerCase("en")) ??
    UNASSIGNED_BRANCH_KEY
  );
}

/** Supervayzer filiali: o‘zi → agentlari (eng ko‘p uchragan), faqat katalogdagi filiallar. */
export function resolveSupervisorBranch(
  supervisorId: number,
  agents: ReadonlyArray<HierarchyUser>,
  userById: Map<number, HierarchyUser>,
  branchLookup: ActiveBranchLookup
): string {
  const own = normalizeUserBranchToCatalog(userById.get(supervisorId)?.branch, branchLookup);
  if (own !== UNASSIGNED_BRANCH_KEY) return own;

  const counts = new Map<string, number>();
  for (const agent of agents) {
    if (agent.supervisor_user_id !== supervisorId) continue;
    const branch = normalizeUserBranchToCatalog(userById.get(agent.id)?.branch, branchLookup);
    if (branch === UNASSIGNED_BRANCH_KEY) continue;
    counts.set(branch, (counts.get(branch) ?? 0) + 1);
  }
  if (counts.size === 0) return UNASSIGNED_BRANCH_KEY;

  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ru"))[0]![0];
}

function branchDisplayName(branchKey: string): string {
  return branchKey === UNASSIGNED_BRANCH_KEY ? "Без филиала" : branchKey;
}

/**
 * Ko‘rsatish daraxti (yuqoridan pastga):
 * Filial → Supervayzerlar (config tartibi) → Agentlar.
 * Rahbarlar va «Степень» zanjirlari faqat tasdiqlash uchun; reja jadvalida ko‘rsatilmaydi.
 */
export function buildPlanningEmployeeNodes(input: BuildHierarchyInput): PlanningEmployeeNode[] {
  const { agents, approverCfg, userById, personName, branchLookup } = input;
  const out: PlanningEmployeeNode[] = [];
  const filialIdByBranch = new Map<string, number>();
  let filialSeq = 0;

  const ensureFilialNode = (branchKey: string): number => {
    const existing = filialIdByBranch.get(branchKey);
    if (existing != null) return existing;
    filialSeq += 1;
    const id = -filialSeq;
    filialIdByBranch.set(branchKey, id);
    out.push({
      id,
      name: branchDisplayName(branchKey),
      code: null,
      role: "branch",
      parent_id: null,
      supervisor_config_index: null,
      chain_level: null
    });
    return id;
  };

  const configSupervisorIds = approverCfg.rows.map((r) => r.supervisor_user_id);
  const supervisorConfigIndex = new Map<number, number>();
  configSupervisorIds.forEach((id, idx) => supervisorConfigIndex.set(id, idx));

  const levelChainUserIds = new Set<number>();
  for (const row of approverCfg.rows) {
    for (const lvl of row.levels) if (lvl != null && lvl > 0) levelChainUserIds.add(lvl);
  }

  const supervisorIdsFromAgents = new Set(
    agents.map((a) => a.supervisor_user_id).filter((id): id is number => id != null && id > 0)
  );
  const supervisorIds = [...new Set([...configSupervisorIds, ...supervisorIdsFromAgents])];

  const branchKeys = [
    ...new Set(supervisorIds.map((supId) => resolveSupervisorBranch(supId, agents, userById, branchLookup)))
  ].sort((a, b) => a.localeCompare(b, "ru"));
  for (const branchKey of branchKeys) ensureFilialNode(branchKey);

  for (const supId of supervisorIds) {
    const u = userById.get(supId);
    if (!u || u.role !== "supervisor") continue;
    const branchKey = resolveSupervisorBranch(supId, agents, userById, branchLookup);
    out.push({
      id: u.id,
      name: personName(u),
      code: u.code,
      role: u.role,
      parent_id: ensureFilialNode(branchKey),
      supervisor_config_index: supervisorConfigIndex.get(u.id) ?? null,
      chain_level: null
    });
  }

  for (const a of agents) {
    if (a.supervisor_user_id == null) continue;
    if (levelChainUserIds.has(a.id)) continue;
    const u = userById.get(a.id);
    if (!u) continue;
    out.push({
      id: u.id,
      name: personName(u),
      code: u.code,
      role: u.role,
      parent_id: a.supervisor_user_id,
      supervisor_config_index: null,
      chain_level: null
    });
  }

  return out;
}
