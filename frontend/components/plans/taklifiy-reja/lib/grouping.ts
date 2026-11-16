import {
  combineTotals,
  totalsForRows,
  type EmployeeSource,
  type MultiProposalResult,
  type ProposalConfig,
  type ProposalRow,
  type ProposalTotals
} from "@salec/plans-proposal";

export type MatrixRow = {
  key: string;
  employee: EmployeeSource;
  cells: Record<number, ProposalRow | undefined>;
};

export type SupervisorBlock = {
  key: string;
  supervisorId: number | null;
  supervisor: string;
  rows: MatrixRow[];
  totals: ProposalTotals;
  byKpi: Record<number, ProposalTotals>;
};

export type BranchBlock = {
  key: string;
  branchId: number;
  branch: string;
  rows: MatrixRow[];
  blocks: SupervisorBlock[];
  totals: ProposalTotals;
  byKpi: Record<number, ProposalTotals>;
};

export type StatusFilter = "all" | "ready" | "warning" | "blocked" | "manual" | "excluded";

export function buildMatrix(result: MultiProposalResult, visibleKpiIds: number[]): MatrixRow[] {
  const map = new Map<string, MatrixRow>();
  for (const k of result.kpis) {
    if (!visibleKpiIds.includes(k.kpiGroupId)) continue;
    for (const row of k.result.rows) {
      const matrixKey = String(row.employee.employeeId);
      let entry = map.get(matrixKey);
      if (!entry) {
        entry = { key: matrixKey, employee: row.employee, cells: {} };
        map.set(matrixKey, entry);
      }
      entry.cells[k.kpiGroupId] = row;
    }
  }
  return [...map.values()].sort((a, b) => a.employee.name.localeCompare(b.employee.name, "uz"));
}

export function rowMatches(row: MatrixRow, search: string, status: StatusFilter): boolean {
  const e = row.employee;
  const q = search.trim().toLowerCase();
  if (q && !`${e.name} ${e.code} ${e.branch} ${e.supervisor}`.toLowerCase().includes(q))
    return false;
  if (status === "all") return true;
  const cells = Object.values(row.cells).filter((c): c is ProposalRow => Boolean(c));
  if (status === "ready") return cells.some((c) => c.ready);
  if (status === "warning")
    return cells.some((c) => c.issues.some((i) => i.severity === "warning"));
  if (status === "blocked")
    return cells.some((c) => c.issues.some((i) => i.severity === "blocking"));
  if (status === "manual") return cells.some((c) => c.origin === "manual");
  return cells.some((c) => c.origin === "excluded");
}

function rollup(
  rows: MatrixRow[],
  visibleKpiIds: number[],
  configs: Record<string, ProposalConfig>
): { totals: ProposalTotals; byKpi: Record<number, ProposalTotals> } {
  const byKpi: Record<number, ProposalTotals> = {};
  for (const id of visibleKpiIds) {
    const kpiRows = rows.map((r) => r.cells[id]).filter((r): r is ProposalRow => Boolean(r));
    byKpi[id] = totalsForRows(
      kpiRows,
      configs[String(id)]?.settings.sourceStatus ?? "approved_only"
    );
  }
  return { totals: combineTotals(Object.values(byKpi)), byKpi };
}

export function groupByBranch(
  rows: MatrixRow[],
  visibleKpiIds: number[],
  configs: Record<string, ProposalConfig>
): BranchBlock[] {
  const branches = new Map<number, MatrixRow[]>();
  for (const row of rows) {
    const list = branches.get(row.employee.branchId) ?? [];
    list.push(row);
    branches.set(row.employee.branchId, list);
  }
  return [...branches.entries()]
    .sort((a, b) => a[1][0]!.employee.branch.localeCompare(b[1][0]!.employee.branch, "uz"))
    .map(([branchId, branchRows]) => {
      const supervisors = new Map<number | null, MatrixRow[]>();
      for (const row of branchRows) {
        const list = supervisors.get(row.employee.supervisorId) ?? [];
        list.push(row);
        supervisors.set(row.employee.supervisorId, list);
      }
      const blocks = [...supervisors.entries()]
        .sort((a, b) =>
          (a[1][0]!.employee.supervisor || "").localeCompare(
            b[1][0]!.employee.supervisor || "",
            "uz"
          )
        )
        .map(([supervisorId, blockRows]) => ({
          key: `branch-${branchId}-svr-${supervisorId ?? 0}`,
          supervisorId,
          supervisor: blockRows[0]!.employee.supervisor || "Supervayzersiz",
          rows: blockRows,
          ...rollup(blockRows, visibleKpiIds, configs)
        }));
      return {
        key: `branch-${branchId}`,
        branchId,
        branch: branchRows[0]!.employee.branch,
        rows: branchRows,
        blocks,
        ...rollup(branchRows, visibleKpiIds, configs)
      };
    });
}
