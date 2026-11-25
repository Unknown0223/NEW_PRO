import { describe, expect, it } from "vitest";
import { parseTasksReportQuery } from "../src/modules/reports/tasks-report.parse";
import { TASKS_FILTER_CLIENTS_SELECT_SQL } from "../src/modules/reports/tasks-report.filters";

describe("tasks-report filter clients SQL", () => {
  it("selects client_code (not clients.code)", () => {
    expect(TASKS_FILTER_CLIENTS_SELECT_SQL).toMatch(/client_code/i);
    expect(TASKS_FILTER_CLIENTS_SELECT_SQL).not.toMatch(/\bc\.code\b/);
  });
});

describe("tasks-report parseTasksReportQuery", () => {
  it("defaults empty filters and page", () => {
    const f = parseTasksReportQuery({});
    expect(f.page).toBe(1);
    expect(f.limit).toBe(50);
    expect(f.statuses).toEqual([]);
    expect(f.assignee_ids).toEqual([]);
    expect(f.created_by_ids).toEqual([]);
    expect(f.client_ids).toEqual([]);
    expect(f.task_type_refs).toEqual([]);
  });

  it("parses date range and multi filters", () => {
    const f = parseTasksReportQuery({
      from: "2026-11-01",
      to: "2026-11-19",
      statuses: "open,done",
      assignee_ids: "2,9",
      created_by_ids: "1",
      client_ids: "10,11",
      task_type_refs: "visit,check",
      priorities: "high,normal",
      search: "  shelf  ",
      page: "3",
      limit: "100"
    });
    expect(f.from).toBe("2026-11-01");
    expect(f.to).toBe("2026-11-19");
    expect(f.statuses).toEqual(["open", "done"]);
    expect(f.assignee_ids).toEqual([2, 9]);
    expect(f.created_by_ids).toEqual([1]);
    expect(f.client_ids).toEqual([10, 11]);
    expect(f.task_type_refs).toEqual(["visit", "check"]);
    expect(f.priorities).toEqual(["high", "normal"]);
    expect(f.search).toBe("shelf");
    expect(f.page).toBe(3);
    expect(f.limit).toBe(100);
  });

  it("drops unknown statuses and priorities", () => {
    const f = parseTasksReportQuery({
      statuses: "open,bogus,cancelled",
      priorities: "low,urgent,high"
    });
    expect(f.statuses).toEqual(["open", "cancelled"]);
    expect(f.priorities).toEqual(["low", "high"]);
  });
});
