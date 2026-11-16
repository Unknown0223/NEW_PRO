import {
  OUTCOME_METHODS,
  type Money,
  type OutcomeCell,
  type OutcomeMethodId
} from "@salec/plans-proposal";
export type OutcomeEmployeeMeta = {
  employeeId: number;
  code: string;
  branchId: number;
  branch: string;
  supervisorId: number | null;
  supervisor: string;
};

export type OutcomeRow = OutcomeCell &
  OutcomeEmployeeMeta & {
    kpiName: string;
  };

/** Backtest kataklariga ierarxiya va KPI nomini biriktiradi. */
export function buildOutcomeRows(
  cells: OutcomeCell[],
  metaByKey: Map<string, OutcomeEmployeeMeta>,
  kpiNames: Array<{ id: number; name: string }> = []
): OutcomeRow[] {
  return cells.map((cell): OutcomeRow => {
    const meta = metaByKey.get(`${cell.kpiGroupId}:${cell.key}`) ?? metaByKey.get(cell.key);
    const fallbackId = Number(cell.key.split(":")[0]);
    return {
      ...cell,
      employeeId: meta?.employeeId ?? (Number.isFinite(fallbackId) ? fallbackId : 0),
      code: meta?.code ?? "—",
      branchId: meta?.branchId ?? 0,
      branch: meta?.branch ?? "Noma’lum filial",
      supervisorId: meta?.supervisorId ?? null,
      supervisor: meta?.supervisor || "Supervayzersiz",
      kpiName: kpiNames.find((g) => g.id === cell.kpiGroupId)?.name ?? `KPI ${cell.kpiGroupId}`
    };
  });
}

/** Faqat musbat, mavjud haqiqiy fakt jami summaga kiradi. */
export function usableActual(value: Money | null): bigint {
  if (value == null) return 0n;
  try {
    const n = BigInt(value);
    return n > 0n ? n : 0n;
  } catch {
    return 0n;
  }
}

export function actualTotal(row: OutcomeRow | undefined): bigint {
  return usableActual(row?.actual ?? null);
}

/** Yopiq KPI katagidagi «oqladi» soni joriy draft usuli bo‘yicha. */
export function draftJustified(row: OutcomeRow | undefined): boolean {
  return row?.verdicts.draft === "justified";
}

/** Shu xodim × KPI uchun haqiqiy faktga eng yaqin chiqqan usul. */
export function closestMethod(
  row: OutcomeRow | undefined
): { id: OutcomeMethodId; name: string; deviation: number } | null {
  if (!row || usableActual(row.actual) === 0n) return null;
  let best: { id: OutcomeMethodId; name: string; deviation: number } | null = null;
  for (const method of OUTCOME_METHODS) {
    const deviation = row.deviations[method.id];
    if (deviation == null) continue;
    if (!best || Math.abs(deviation) < Math.abs(best.deviation)) {
      best = { id: method.id, name: method.name, deviation };
    }
  }
  return best;
}

export const METHOD_SHORT: Record<OutcomeMethodId, string> = {
  fact_10: "Fakt +10%",
  fact_5: "Fakt +5%",
  previous_plan: "Eski reja",
  history_median: "3 oy med.",
  draft: "Joriy draft"
};

export type OutcomeAgentGroup = {
  key: string;
  employeeId: number;
  name: string;
  code: string;
  byKpi: Map<number, OutcomeRow>;
  total: bigint;
  justified: number;
  count: number;
};

export type OutcomeSupervisorGroup = {
  key: string;
  id: number | null;
  name: string;
  agents: OutcomeAgentGroup[];
  byKpi: Map<number, bigint>;
  total: bigint;
  justified: number;
  count: number;
};

export type OutcomeBranchGroup = {
  key: string;
  id: number;
  name: string;
  supervisors: OutcomeSupervisorGroup[];
  byKpi: Map<number, bigint>;
  total: bigint;
  justified: number;
  count: number;
  agentCount: number;
};

/** Ierarxiya: filial → supervayzer → xodim. Yopiq blokda KPI kesimidagi fakt jami. */
export function buildOutcomeGroups(rows: OutcomeRow[], kpiIds: number[]): OutcomeBranchGroup[] {
  const kpiTotals = (list: OutcomeRow[]): Map<number, bigint> => {
    const map = new Map<number, bigint>(kpiIds.map((id) => [id, 0n]));
    for (const row of list) {
      if (!map.has(row.kpiGroupId)) continue;
      map.set(row.kpiGroupId, (map.get(row.kpiGroupId) ?? 0n) + actualTotal(row));
    }
    return map;
  };
  const sum = (map: Map<number, bigint>) => [...map.values()].reduce((a, b) => a + b, 0n);
  const stats = (list: OutcomeRow[]) => ({
    justified: list.filter(draftJustified).length,
    count: list.length
  });
  const branches = new Map<number, OutcomeRow[]>();
  for (const row of rows) {
    const list = branches.get(row.branchId) ?? [];
    list.push(row);
    branches.set(row.branchId, list);
  }
  return [...branches.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([branchId, branchRows]): OutcomeBranchGroup => {
      const supervisors = new Map<number | null, OutcomeRow[]>();
      for (const row of branchRows) {
        const list = supervisors.get(row.supervisorId) ?? [];
        list.push(row);
        supervisors.set(row.supervisorId, list);
      }
      const groups: OutcomeSupervisorGroup[] = [...supervisors.entries()]
        .sort((a, b) => (a[0] ?? 0) - (b[0] ?? 0))
        .map(([supervisorId, supervisorRows]): OutcomeSupervisorGroup => {
          const agents = new Map<string, OutcomeRow[]>();
          for (const row of supervisorRows) {
            const list = agents.get(row.key) ?? [];
            list.push(row);
            agents.set(row.key, list);
          }
          const agentGroups: OutcomeAgentGroup[] = [...agents.entries()]
            .sort((a, b) => a[1][0]!.employeeId - b[1][0]!.employeeId)
            .map(([key, agentRows]): OutcomeAgentGroup => {
              const scoped = agentRows.filter((r) => kpiIds.includes(r.kpiGroupId));
              const byKpi = new Map(scoped.map((r) => [r.kpiGroupId, r]));
              return {
                key,
                employeeId: agentRows[0]!.employeeId,
                name: agentRows[0]!.employeeName,
                code: agentRows[0]!.code,
                byKpi,
                total: sum(kpiTotals(scoped)),
                ...stats(scoped)
              };
            });
          const svrKpi = kpiTotals(supervisorRows);
          return {
            key: `${branchId}:${supervisorId ?? 0}`,
            id: supervisorId,
            name: supervisorRows[0]!.supervisor,
            agents: agentGroups,
            byKpi: svrKpi,
            total: sum(svrKpi),
            ...stats(supervisorRows.filter((r) => kpiIds.includes(r.kpiGroupId)))
          };
        });
      const branchKpi = kpiTotals(branchRows);
      const scopedBranch = branchRows.filter((r) => kpiIds.includes(r.kpiGroupId));
      return {
        key: String(branchId),
        id: branchId,
        name: branchRows[0]!.branch,
        supervisors: groups,
        byKpi: branchKpi,
        total: sum(branchKpi),
        ...stats(scopedBranch),
        agentCount: groups.reduce((n, g) => n + g.agents.length, 0)
      };
    });
}
