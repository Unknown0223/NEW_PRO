import {
  DEFAULT_CONFIG,
  employeeKey,
  type Formula,
  type Money,
  type ProposalRow
} from "@salec/plans-proposal";
import type { ProposalController } from "@taklifiy/hooks/use-proposal";
import { kpiLabel } from "./catalog";
import { cellAudit } from "./audit";
import { acceptedPreviousPlan, hasUsableFact } from "./source";

export type DraftRow = {
  kpiGroupId: number;
  key: string;
  employeeId: number;
  employeeName: string;
  code: string;
  branchId: number;
  branch: string;
  supervisorId: number | null;
  supervisor: string;
  kpiName: string;
  fact: Money | null;
  factUsable: boolean;
  previousPlan: Money | null;
  formula: Formula;
  row: ProposalRow | undefined;
  lastChange: { at: string; actor: string; action: string } | null;
  changes: number;
};

export type CellRefState = { kpiGroupId: number; key: string; employeeName: string } | null;

/** Bitta xodim × KPI katagi; o‘chirilgan qatorlar jadvaldan chiqariladi. */
export function buildDraftRows(c: ProposalController): DraftRow[] {
  const removed = new Set(c.sharedDraft.removed.map((r) => `${r.kpiGroupId}:${r.key}`));
  const rows: DraftRow[] = [];
  for (const dataset of c.input.datasets) {
    const kpiResult = c.result.kpis.find((k) => k.kpiGroupId === dataset.kpiGroupId);
    const config = c.configs[String(dataset.kpiGroupId)] ?? DEFAULT_CONFIG;
    const sourceStatus = config.settings.sourceStatus;
    for (const employee of dataset.employees) {
      const key = employeeKey(employee.employeeId, employee.workSlotId);
      if (removed.has(`${dataset.kpiGroupId}:${key}`)) continue;
      const row = kpiResult?.result.rows.find((r) => r.key === key);
      const history = cellAudit(c.audit, dataset.kpiGroupId, key);
      rows.push({
        kpiGroupId: dataset.kpiGroupId,
        key,
        employeeId: employee.employeeId,
        employeeName: employee.name,
        code: employee.code ?? "—",
        branchId: employee.branchId,
        branch: employee.branch,
        supervisorId: employee.supervisorId,
        supervisor: employee.supervisor || "Supervayzersiz",
        kpiName: kpiLabel(c, dataset.kpiGroupId),
        fact: employee.fact?.net ?? null,
        factUsable: hasUsableFact(employee),
        previousPlan: acceptedPreviousPlan(employee, sourceStatus)?.value ?? null,
        formula: row?.formula ?? config.defaultFormula ?? DEFAULT_CONFIG.defaultFormula,
        row,
        lastChange: history[0]
          ? { at: history[0].at, actor: history[0].actor, action: history[0].summary }
          : null,
        changes: history.length
      });
    }
  }
  return rows;
}

export function proposalTotal(row: DraftRow | undefined): bigint {
  const value = row?.row?.value;
  if (!value || !row?.row?.ready) return 0n;
  try {
    const n = BigInt(value);
    return n > 0n ? n : 0n;
  } catch {
    return 0n;
  }
}

export type AgentGroup = {
  key: string;
  employeeId: number;
  name: string;
  code: string;
  byKpi: Map<number, DraftRow>;
  total: bigint;
};

export type SupervisorGroup = {
  key: string;
  id: number | null;
  name: string;
  agents: AgentGroup[];
  byKpi: Map<number, bigint>;
  total: bigint;
};

export type BranchGroup = {
  key: string;
  id: number;
  name: string;
  supervisors: SupervisorGroup[];
  byKpi: Map<number, bigint>;
  total: bigint;
  agentCount: number;
};

/** Ierarxiya: filial → supervayzer → xodim. Har blok uchun KPI kesimidagi total. */
export function buildDraftGroups(rows: DraftRow[], kpiIds: number[]): BranchGroup[] {
  const kpiTotals = (list: DraftRow[]): Map<number, bigint> => {
    const map = new Map<number, bigint>(kpiIds.map((id) => [id, 0n]));
    for (const row of list) {
      if (!map.has(row.kpiGroupId)) continue;
      map.set(row.kpiGroupId, (map.get(row.kpiGroupId) ?? 0n) + proposalTotal(row));
    }
    return map;
  };
  const sum = (map: Map<number, bigint>) => [...map.values()].reduce((a, b) => a + b, 0n);
  const branches = new Map<number, DraftRow[]>();
  for (const row of rows) {
    const list = branches.get(row.branchId) ?? [];
    list.push(row);
    branches.set(row.branchId, list);
  }
  return [...branches.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([branchId, branchRows]): BranchGroup => {
      const supervisors = new Map<number | null, DraftRow[]>();
      for (const row of branchRows) {
        const list = supervisors.get(row.supervisorId) ?? [];
        list.push(row);
        supervisors.set(row.supervisorId, list);
      }
      const groups: SupervisorGroup[] = [...supervisors.entries()]
        .sort((a, b) => (a[0] ?? 0) - (b[0] ?? 0))
        .map(([supervisorId, supervisorRows]): SupervisorGroup => {
          const agents = new Map<string, DraftRow[]>();
          for (const row of supervisorRows) {
            const list = agents.get(row.key) ?? [];
            list.push(row);
            agents.set(row.key, list);
          }
          const agentGroups: AgentGroup[] = [...agents.entries()]
            .sort((a, b) => a[1][0]!.employeeId - b[1][0]!.employeeId)
            .map(([key, agentRows]): AgentGroup => {
              const byKpi = new Map(agentRows.map((r) => [r.kpiGroupId, r]));
              return {
                key,
                employeeId: agentRows[0]!.employeeId,
                name: agentRows[0]!.employeeName,
                code: agentRows[0]!.code,
                byKpi,
                total: sum(kpiTotals(agentRows.filter((r) => kpiIds.includes(r.kpiGroupId))))
              };
            });
          const svrKpi = kpiTotals(supervisorRows);
          return {
            key: `${branchId}:${supervisorId ?? 0}`,
            id: supervisorId,
            name: supervisorRows[0]!.supervisor,
            agents: agentGroups,
            byKpi: svrKpi,
            total: sum(svrKpi)
          };
        });
      const branchKpi = kpiTotals(branchRows);
      return {
        key: String(branchId),
        id: branchId,
        name: branchRows[0]!.branch,
        supervisors: groups,
        byKpi: branchKpi,
        total: sum(branchKpi),
        agentCount: groups.reduce((n, g) => n + g.agents.length, 0)
      };
    });
}
