import { describe, expect, it } from "vitest";
import {
  filterPlanningHierarchyNodes,
  scopeApproverRowsByFieldAgents
} from "../src/modules/plans/plans.setup.scope";

describe("plans.setup.scope", () => {
  it("scopes approver rows to SVRs with field agents in direction", () => {
    const rows = [
      { supervisor_user_id: 2081, supervisor_name: "SVR 01", levels: [2106, 1] },
      { supervisor_user_id: 2085, supervisor_name: "SVR 05", levels: [2106, 1] }
    ];
    const agents = [{ supervisor_user_id: 2085 as number | null }];
    const scoped = scopeApproverRowsByFieldAgents(rows, agents);
    expect(scoped.map((r) => r.supervisor_user_id)).toEqual([2085]);
  });

  it("filters hierarchy nodes — only matching SVR, not all config SVRs", () => {
    const nodes = [
      { id: 1, role: "admin" },
      { id: 2106, role: "regional_manager", chain_level: 1 },
      { id: 2081, role: "supervisor" },
      { id: 2085, role: "supervisor" },
      { id: 2075, role: "agent" }
    ];
    const scopedRows = [{ supervisor_user_id: 2085, supervisor_name: "SVR 05", levels: [2106, 1] }];
    const filtered = filterPlanningHierarchyNodes({
      nodes,
      leaderIds: [1],
      scopedRows,
      fieldAgentIds: new Set([2075]),
      supervisorIdsWithAgents: new Set([2085]),
      userMatchesDirection: () => false
    });
    expect(filtered.map((n) => n.id).sort((a, b) => a - b)).toEqual([1, 2075, 2085, 2106]);
  });
});
