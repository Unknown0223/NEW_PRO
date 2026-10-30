import { describe, expect, it } from "vitest";
import {
  isUnlinkedStaffRole,
  orderTimesheetRows,
  parseTimesheetRoleFilter,
  shouldGroupSupervisorAgents
} from "../src/modules/timesheet/timesheet.order";

describe("timesheet.order", () => {
  it("parses role filters", () => {
    expect(parseTimesheetRoleFilter("agent")).toEqual(["agent"]);
    expect(parseTimesheetRoleFilter(undefined, "agent,supervisor")).toEqual(["agent", "supervisor"]);
    expect(parseTimesheetRoleFilter(undefined, undefined)).toBeUndefined();
  });

  it("groups only when both SVR and agent selected (or all)", () => {
    expect(shouldGroupSupervisorAgents(undefined)).toBe(true);
    expect(shouldGroupSupervisorAgents([])).toBe(true);
    expect(shouldGroupSupervisorAgents(["agent", "supervisor"])).toBe(true);
    expect(shouldGroupSupervisorAgents(["agent"])).toBe(false);
    expect(shouldGroupSupervisorAgents(["cashier"])).toBe(false);
  });

  it("marks cashier/warehouse as unlinked staff", () => {
    expect(isUnlinkedStaffRole("cashier")).toBe(true);
    expect(isUnlinkedStaffRole("warehouse_manager")).toBe(true);
    expect(isUnlinkedStaffRole("agent")).toBe(false);
    expect(isUnlinkedStaffRole("supervisor")).toBe(false);
  });

  it("orders agents under SVR then SVR, unlinked at end", () => {
    const rows = [
      { user_id: 10, fio: "SVR B", role: "supervisor", supervisor_user_id: null },
      { user_id: 1, fio: "Agent Z", role: "agent", supervisor_user_id: 10 },
      { user_id: 2, fio: "Agent A", role: "agent", supervisor_user_id: 10 },
      { user_id: 20, fio: "SVR A", role: "supervisor", supervisor_user_id: null },
      { user_id: 3, fio: "Agent X", role: "agent", supervisor_user_id: 20 },
      { user_id: 99, fio: "Kassir", role: "cashier", supervisor_user_id: null },
      { user_id: 4, fio: "Orphan Agent", role: "agent", supervisor_user_id: null }
    ];
    const ordered = orderTimesheetRows(rows, ["agent", "supervisor", "cashier"]);
    expect(ordered.map((r) => r.user_id)).toEqual([
      3, // under SVR A
      20, // SVR A
      2,
      1, // under SVR B
      10, // SVR B
      4, // orphan agent
      99 // cashier last
    ]);
  });

  it("strict role scope hides auditor when only agent+SVR selected", () => {
    const rows = [
      { user_id: 10, fio: "SVR", role: "supervisor", supervisor_user_id: null },
      { user_id: 1, fio: "Agent", role: "agent", supervisor_user_id: 10 },
      { user_id: 50, fio: "Auditor", role: "auditor", supervisor_user_id: null }
    ];
    const ordered = orderTimesheetRows(rows, ["agent", "supervisor"]);
    expect(ordered.map((r) => r.user_id)).toEqual([1, 10]);
  });
});
