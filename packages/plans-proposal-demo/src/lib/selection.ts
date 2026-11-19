import {
  DEFAULT_CONFIG,
  cloneConfig,
  employeeKey,
  type EmployeeSource,
  type Formula,
  type KpiDataset,
  type ProposalConfig,
  type ProposalRow
} from "@salec/plans-proposal";
import type { MatrixRow } from "./grouping";

/** Barqaror katak identifikatori: KPI guruhi + xodim/slot kaliti. */
export type CellRef = { kpiId: number; key: string };
export type ConfigMap = Record<string, ProposalConfig>;

export const cellId = (kpiId: number, key: string) => `${kpiId}:${key}`;

export function parseCellId(id: string): CellRef {
  const index = id.indexOf(":");
  return { kpiId: Number(id.slice(0, index)), key: id.slice(index + 1) };
}

/** Qo‘lda/chiqarilgan/no faol kataklar ommaviy formuladan himoyalangan. */
export function canSelectCell(row: ProposalRow | undefined): row is ProposalRow {
  return Boolean(
    row &&
    row.employee.active &&
    row.employee.linked &&
    row.origin !== "manual" &&
    row.origin !== "excluded"
  );
}

export function selectableCells(rows: MatrixRow[], kpiIds: number[]): CellRef[] {
  const cells: CellRef[] = [];
  for (const row of rows) {
    for (const kpiId of kpiIds) {
      const cell = row.cells[kpiId];
      if (canSelectCell(cell)) cells.push({ kpiId, key: cell.key });
    }
  }
  return cells;
}

export function selectableCellIds(rows: MatrixRow[], kpiIds: number[]): string[] {
  return selectableCells(rows, kpiIds).map((c) => cellId(c.kpiId, c.key));
}

export function selectionState(selected: Set<string>, ids: string[]) {
  const count = ids.reduce((n, id) => n + (selected.has(id) ? 1 : 0), 0);
  return {
    count,
    checked: ids.length > 0 && count === ids.length,
    indeterminate: count > 0 && count < ids.length
  };
}

export function mergeSelection(old: Set<string>, ids: string[], on: boolean): Set<string> {
  const next = new Set(old);
  for (const id of ids) {
    if (on) next.add(id);
    else next.delete(id);
  }
  return next;
}

export type BulkWriteResult = {
  configs: ConfigMap;
  appliedCells: CellRef[];
  skipped: number;
};

/** Tanlangan kataklargina yoziladi; manual/excluded/no-faol kataklar o‘tkazib yuboriladi. */
export function writeCellFormulas(
  configs: ConfigMap,
  datasets: KpiDataset[],
  cells: CellRef[],
  formula: Formula
): BulkWriteResult {
  const byKpi = new Map<number, Map<string, EmployeeSource>>();
  for (const dataset of datasets) {
    byKpi.set(
      dataset.kpiGroupId,
      new Map(dataset.employees.map((e) => [employeeKey(e.employeeId, e.workSlotId), e]))
    );
  }
  const valid = new Map<number, Set<string>>();
  const seen = new Set<string>();
  let skipped = 0;
  for (const cell of cells) {
    const id = cellId(cell.kpiId, cell.key);
    if (seen.has(id)) continue;
    seen.add(id);
    const employee = byKpi.get(cell.kpiId)?.get(cell.key);
    const config = configs[String(cell.kpiId)];
    if (
      !employee ||
      !employee.active ||
      !employee.linked ||
      config?.overrides[cell.key] ||
      config?.excluded.includes(cell.key)
    ) {
      skipped++;
      continue;
    }
    const keys = valid.get(cell.kpiId) ?? new Set<string>();
    keys.add(cell.key);
    valid.set(cell.kpiId, keys);
  }
  const next: ConfigMap = { ...configs };
  const appliedCells: CellRef[] = [];
  for (const [kpiId, keys] of valid) {
    const draft = cloneConfig(next[String(kpiId)] ?? DEFAULT_CONFIG);
    draft.cellFormulas ??= {};
    for (const key of keys) {
      draft.cellFormulas[key] = { ...formula };
      appliedCells.push({ kpiId, key });
    }
    next[String(kpiId)] = draft;
  }
  return { configs: next, appliedCells, skipped };
}
