import { describe, expect, it } from "vitest";
import {
  DEFAULT_CONFIG,
  calculateMultiProposal,
  cloneConfig,
  type Formula
} from "@salec/plans-proposal";
import { buildMultiDemoInput, INITIAL_CONTEXT } from "../../src/data/demo-data";
import { buildMatrix } from "../../src/lib/grouping";
import {
  canSelectCell,
  cellId,
  mergeSelection,
  parseCellId,
  selectableCellIds,
  writeCellFormulas
} from "../../src/lib/selection";

const formula: Formula = { basis: "fact", mode: "percent", value: 12 };

function setup() {
  const configs = {
    "1": cloneConfig(DEFAULT_CONFIG),
    "2": cloneConfig(DEFAULT_CONFIG),
    "3": cloneConfig(DEFAULT_CONFIG)
  };
  const input = buildMultiDemoInput(INITIAL_CONTEXT, configs, [1, 2, 3]);
  const result = calculateMultiProposal(input);
  const rows = buildMatrix(result, [1, 2, 3]);
  return { configs, input, rows };
}

describe("cell selection", () => {
  it("round-trips KPI + employee/slot ids", () => {
    expect(parseCellId(cellId(2, "7:0"))).toEqual({ kpiId: 2, key: "7:0" });
  });

  it("selects only active, linked, non-manual and non-excluded cells", () => {
    const { rows, configs } = setup();
    const row = rows[0]!;
    const key = row.cells[1]!.key;
    expect(canSelectCell(row.cells[1])).toBe(true);
    configs["1"].overrides[key] = { value: "100000000", reason: "manual" };
    const manual = calculateMultiProposal({
      ...setup().input,
      configs
    });
    const manualRow = buildMatrix(manual, [1, 2, 3]).find((r) => r.key === row.key)!;
    expect(canSelectCell(manualRow.cells[1])).toBe(false);
    expect(canSelectCell(manualRow.cells[2])).toBe(true);
  });

  it("merges and removes ids without mutating the old set", () => {
    const old = new Set(["1:1:0"]);
    const next = mergeSelection(old, ["1:2:0", "2:1:0"], true);
    expect(next.size).toBe(3);
    expect(old.size).toBe(1);
    expect(mergeSelection(next, ["1:1:0"], false).has("1:1:0")).toBe(false);
  });

  it("writes only requested cells and skips protected ones", () => {
    const { configs, input, rows } = setup();
    const openRows = rows.filter((r) => canSelectCell(r.cells[1])).slice(0, 3);
    const a = openRows[0]!.cells[1]!.key;
    const b = openRows[1]!.cells[1]!.key;
    const ids = selectableCellIds(openRows, [1]);
    configs["1"].overrides[a] = { value: "100000000", reason: "manual" };
    configs["1"].excluded.push(b);
    const cells = ids.map(parseCellId).concat([{ kpiId: 1, key: "999:0" }]);
    const outcome = writeCellFormulas(configs, input.datasets, cells, formula);
    expect(outcome.skipped).toBe(3);
    expect(outcome.appliedCells.length).toBe(ids.length - 2);
    expect(outcome.configs["1"].cellFormulas?.[a]).toBeUndefined();
    expect(outcome.configs["1"].cellFormulas?.[b]).toBeUndefined();
    expect(configs["1"].cellFormulas).toBeUndefined();
    for (const cell of outcome.appliedCells) {
      expect(outcome.configs[String(cell.kpiId)].cellFormulas?.[cell.key]).toEqual(formula);
    }
  });
});
