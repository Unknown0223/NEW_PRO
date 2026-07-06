import { describe, expect, it } from "vitest";
import {
  addColumnAfter,
  addLevelAfter,
  applyColumn,
  buildRows,
  maxLevels,
  removeColumn,
  removeLevel,
  updateLevel
} from "../components/plans/approver-state";
import type { ApproverConfig, ApproverOptions } from "../components/plans/approvers-api";

const options: ApproverOptions = {
  directions: [{ id: 1, name: "Dir", code: "D1" }],
  supervisors: [
    { id: 10, name: "Sup A", role: "supervisor" },
    { id: 11, name: "Sup B", role: "supervisor" }
  ],
  employees: [{ id: 20, name: "Agent", role: "agent" }],
  leaders: [{ id: 30, name: "Dir", role: "director" }]
};

describe("approver-state", () => {
  it("buildRows defaults to two empty levels per supervisor", () => {
    const rows = buildRows(options, undefined);
    expect(rows).toHaveLength(2);
    expect(rows[0].levels).toEqual([null, null]);
  });

  it("buildRows restores saved config", () => {
    const config: ApproverConfig = {
      rows: [{ supervisor_user_id: 10, supervisor_name: "Sup A", levels: [20] }],
      leaders: [30]
    };
    const rows = buildRows(options, config);
    expect(rows[0].levels).toEqual([20]);
    expect(rows[1].levels).toEqual([null, null]);
  });

  it("updateLevel and maxLevels", () => {
    let rows = buildRows(options, undefined);
    rows = updateLevel(rows, 0, 0, 20);
    expect(rows[0].levels[0]).toBe(20);
    expect(maxLevels(rows)).toBe(2);
  });

  it("addLevelAfter and removeLevel keep at least one level", () => {
    let rows = buildRows(options, undefined);
    rows = addLevelAfter(rows, 0, 0);
    expect(rows[0].levels).toHaveLength(3);
    rows = removeLevel(rows, 0, 0);
    rows = removeLevel(rows, 0, 0);
    expect(rows[0].levels).toEqual([null]);
  });

  it("addColumnAfter applies to all rows", () => {
    let rows = buildRows(options, undefined);
    rows = addColumnAfter(rows, 1);
    expect(rows.every((r) => r.levels.length === 3)).toBe(true);
  });

  it("applyColumn sets value across rows", () => {
    let rows = buildRows(options, undefined);
    rows = applyColumn(rows, 0, 20);
    expect(rows[0].levels[0]).toBe(20);
    expect(rows[1].levels[0]).toBe(20);
  });

  it("removeColumn shrinks all rows", () => {
    let rows = buildRows(options, undefined);
    rows = addColumnAfter(rows, 0);
    rows = removeColumn(rows, 1);
    expect(rows[0].levels).toHaveLength(2);
  });
});
