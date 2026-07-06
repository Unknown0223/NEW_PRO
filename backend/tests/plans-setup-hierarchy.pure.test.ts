import { describe, expect, it } from "vitest";
import { buildPlanningEmployeeNodes } from "../src/modules/plans/plans.setup.hierarchy";

describe("buildPlanningEmployeeNodes", () => {
  const personName = (u: { name: string; login: string }) => u.name || u.login;

  it("top-down: leader → level → supervisor → field agent", () => {
    const nodes = buildPlanningEmployeeNodes({
      agents: [
        { id: 10, name: "Agent A", login: "a", role: "agent", code: null, supervisor_user_id: 5 }
      ],
      approverCfg: {
        rows: [{ supervisor_user_id: 5, supervisor_name: "SVR", levels: [20, 1] }],
        leaders: [1]
      },
      autoManagers: [],
      userById: new Map([
        [1, { id: 1, name: "Admin", login: "admin", role: "admin", code: null, supervisor_user_id: null }],
        [5, { id: 5, name: "SVR", login: "svr", role: "supervisor", code: null, supervisor_user_id: null }],
        [10, { id: 10, name: "Agent A", login: "a", role: "agent", code: null, supervisor_user_id: 5 }],
        [20, { id: 20, name: "Mid", login: "m", role: "manager", code: null, supervisor_user_id: null }]
      ]),
      personName
    });

    expect(nodes.find((n) => n.id === 1)?.parent_id).toBeNull();
    expect(nodes.find((n) => n.id === 20)?.parent_id).toBe(1);
    expect(nodes.find((n) => n.id === 20)?.chain_level).toBe(1);
    expect(nodes.find((n) => n.id === 5)?.parent_id).toBe(20);
    expect(nodes.find((n) => n.id === 10)?.parent_id).toBe(5);
  });

  it("level-chain agent is not re-parented under field SVR (no cycle)", () => {
    const nodes = buildPlanningEmployeeNodes({
      agents: [
        { id: 2075, name: "Agent 05", login: "a05", role: "agent", code: null, supervisor_user_id: 2085 }
      ],
      approverCfg: {
        rows: [{ supervisor_user_id: 2085, supervisor_name: "SVR 05", levels: [2075, 1] }],
        leaders: [1]
      },
      autoManagers: [],
      userById: new Map([
        [1, { id: 1, name: "Admin", login: "admin", role: "admin", code: null, supervisor_user_id: null }],
        [2075, { id: 2075, name: "Agent 05", login: "a05", role: "agent", code: null, supervisor_user_id: 2085 }],
        [2085, { id: 2085, name: "SVR 05", login: "svr05", role: "supervisor", code: null, supervisor_user_id: null }]
      ]),
      personName
    });

    expect(nodes.find((n) => n.id === 2075)?.parent_id).toBe(1);
    expect(nodes.find((n) => n.id === 2075)?.chain_level).toBe(1);
    expect(nodes.find((n) => n.id === 2085)?.parent_id).toBe(2075);
  });

  it("skips agents without supervisor", () => {
    const nodes = buildPlanningEmployeeNodes({
      agents: [{ id: 10, name: "Orphan", login: "o", role: "agent", code: null, supervisor_user_id: null }],
      approverCfg: { rows: [], leaders: [] },
      autoManagers: [],
      userById: new Map([
        [10, { id: 10, name: "Orphan", login: "o", role: "agent", code: null, supervisor_user_id: null }]
      ]),
      personName
    });
    expect(nodes.find((n) => n.id === 10)).toBeUndefined();
  });
});
