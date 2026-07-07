import { describe, expect, it } from "vitest";
import {
  buildPlanningEmployeeNodes,
  buildActiveBranchLookup,
  resolveSupervisorBranch
} from "../src/modules/plans/plans.setup.hierarchy";

describe("buildPlanningEmployeeNodes", () => {
  const personName = (u: { name: string; login: string }) => u.name || u.login;
  const toshkentLookup = buildActiveBranchLookup([{ name: "Toshkent" }]);
  const samarqandLookup = buildActiveBranchLookup([{ name: "Samarqand" }]);
  const filialALookup = buildActiveBranchLookup([{ name: "Filial A" }]);
  const emptyLookup = buildActiveBranchLookup([]);

  it("filial → supervisor → field agent", () => {
    const nodes = buildPlanningEmployeeNodes({
      agents: [
        {
          id: 10,
          name: "Agent A",
          login: "a",
          role: "agent",
          code: null,
          branch: "Toshkent",
          supervisor_user_id: 5
        }
      ],
      approverCfg: {
        rows: [{ supervisor_user_id: 5, supervisor_name: "SVR", levels: [20, 1] }],
        leaders: [1]
      },
      autoManagers: [],
      userById: new Map([
        [
          1,
          {
            id: 1,
            name: "Admin",
            login: "admin",
            role: "admin",
            code: null,
            branch: null,
            supervisor_user_id: null
          }
        ],
        [
          5,
          {
            id: 5,
            name: "SVR",
            login: "svr",
            role: "supervisor",
            code: null,
            branch: "Toshkent",
            supervisor_user_id: null
          }
        ],
        [
          10,
          {
            id: 10,
            name: "Agent A",
            login: "a",
            role: "agent",
            code: null,
            branch: "Toshkent",
            supervisor_user_id: 5
          }
        ],
        [
          20,
          {
            id: 20,
            name: "Mid",
            login: "m",
            role: "manager",
            code: null,
            branch: null,
            supervisor_user_id: null
          }
        ]
      ]),
      personName,
      branchLookup: toshkentLookup
    });

    const filial = nodes.find((n) => n.role === "branch");
    expect(filial?.name).toBe("Toshkent");
    expect(filial?.parent_id).toBeNull();
    expect(nodes.find((n) => n.id === 1)).toBeUndefined();
    expect(nodes.find((n) => n.id === 20)).toBeUndefined();
    expect(nodes.find((n) => n.id === 5)?.parent_id).toBe(filial?.id);
    expect(nodes.find((n) => n.id === 10)?.parent_id).toBe(5);
  });

  it("bir filial ostida bir nechta SVR", () => {
    const nodes = buildPlanningEmployeeNodes({
      agents: [
        {
          id: 11,
          name: "Agent 1",
          login: "a1",
          role: "agent",
          code: null,
          branch: "Samarqand",
          supervisor_user_id: 5
        },
        {
          id: 12,
          name: "Agent 2",
          login: "a2",
          role: "agent",
          code: null,
          branch: "Samarqand",
          supervisor_user_id: 6
        }
      ],
      approverCfg: {
        rows: [
          { supervisor_user_id: 5, supervisor_name: "SVR 1", levels: [] },
          { supervisor_user_id: 6, supervisor_name: "SVR 2", levels: [] }
        ],
        leaders: []
      },
      autoManagers: [],
      userById: new Map([
        [
          5,
          {
            id: 5,
            name: "SVR 1",
            login: "svr1",
            role: "supervisor",
            code: null,
            branch: "Samarqand",
            supervisor_user_id: null
          }
        ],
        [
          6,
          {
            id: 6,
            name: "SVR 2",
            login: "svr2",
            role: "supervisor",
            code: null,
            branch: "Samarqand",
            supervisor_user_id: null
          }
        ],
        [
          11,
          {
            id: 11,
            name: "Agent 1",
            login: "a1",
            role: "agent",
            code: null,
            branch: "Samarqand",
            supervisor_user_id: 5
          }
        ],
        [
          12,
          {
            id: 12,
            name: "Agent 2",
            login: "a2",
            role: "agent",
            code: null,
            branch: "Samarqand",
            supervisor_user_id: 6
          }
        ]
      ]),
      personName,
      branchLookup: samarqandLookup
    });

    const filials = nodes.filter((n) => n.role === "branch");
    expect(filials).toHaveLength(1);
    const filialId = filials[0]!.id;
    const supervisors = nodes.filter((n) => n.role === "supervisor");
    expect(supervisors.map((n) => n.id).sort()).toEqual([5, 6]);
    expect(supervisors.every((n) => n.parent_id === filialId)).toBe(true);
  });

  it("level-chain agent is not shown as field agent", () => {
    const nodes = buildPlanningEmployeeNodes({
      agents: [
        {
          id: 2075,
          name: "Agent 05",
          login: "a05",
          role: "agent",
          code: null,
          branch: "Filial A",
          supervisor_user_id: 2085
        }
      ],
      approverCfg: {
        rows: [{ supervisor_user_id: 2085, supervisor_name: "SVR 05", levels: [2075, 1] }],
        leaders: [1]
      },
      autoManagers: [],
      userById: new Map([
        [
          1,
          {
            id: 1,
            name: "Admin",
            login: "admin",
            role: "admin",
            code: null,
            branch: null,
            supervisor_user_id: null
          }
        ],
        [
          2075,
          {
            id: 2075,
            name: "Agent 05",
            login: "a05",
            role: "agent",
            code: null,
            branch: "Filial A",
            supervisor_user_id: 2085
          }
        ],
        [
          2085,
          {
            id: 2085,
            name: "SVR 05",
            login: "svr05",
            role: "supervisor",
            code: null,
            branch: "Filial A",
            supervisor_user_id: null
          }
        ]
      ]),
      personName,
      branchLookup: filialALookup
    });

    expect(nodes.find((n) => n.id === 2075)).toBeUndefined();
    expect(nodes.find((n) => n.id === 2085)?.parent_id).toBeLessThan(0);
  });

  it("skips agents without supervisor", () => {
    const nodes = buildPlanningEmployeeNodes({
      agents: [
        {
          id: 10,
          name: "Orphan",
          login: "o",
          role: "agent",
          code: null,
          branch: null,
          supervisor_user_id: null
        }
      ],
      approverCfg: { rows: [], leaders: [] },
      autoManagers: [],
      userById: new Map([
        [
          10,
          {
            id: 10,
            name: "Orphan",
            login: "o",
            role: "agent",
            code: null,
            branch: null,
            supervisor_user_id: null
          }
        ]
      ]),
      personName,
      branchLookup: emptyLookup
    });
    expect(nodes.find((n) => n.id === 10)).toBeUndefined();
  });

  it("katalog bo‘sh bo‘lsa eski hodim matni filial sifatida chiqmaydi", () => {
    const nodes = buildPlanningEmployeeNodes({
      agents: [
        {
          id: 10,
          name: "Agent",
          login: "a",
          role: "agent",
          code: null,
          branch: "Namangan",
          supervisor_user_id: 5
        }
      ],
      approverCfg: {
        rows: [{ supervisor_user_id: 5, supervisor_name: "SVR", levels: [] }],
        leaders: []
      },
      autoManagers: [],
      userById: new Map([
        [
          5,
          {
            id: 5,
            name: "SVR",
            login: "svr",
            role: "supervisor",
            code: null,
            branch: "TEST filial",
            supervisor_user_id: null
          }
        ],
        [
          10,
          {
            id: 10,
            name: "Agent",
            login: "a",
            role: "agent",
            code: null,
            branch: "Namangan",
            supervisor_user_id: 5
          }
        ]
      ]),
      personName,
      branchLookup: emptyLookup
    });

    const filials = nodes.filter((n) => n.role === "branch");
    expect(filials).toHaveLength(1);
    expect(filials[0]?.name).toBe("Без филиала");
    expect(nodes.some((n) => n.name === "Namangan" || n.name === "TEST filial")).toBe(false);
  });
});

describe("resolveSupervisorBranch", () => {
  const filialALookup = buildActiveBranchLookup([{ name: "Filial A" }, { name: "Filial B" }]);

  it("prefers supervisor branch over agent branches", () => {
    const branch = resolveSupervisorBranch(
      5,
      [{ id: 10, supervisor_user_id: 5 } as never],
      new Map([
        [5, { branch: "Filial A" } as never],
        [10, { branch: "Filial B" } as never]
      ]),
      filialALookup
    );
    expect(branch).toBe("Filial A");
  });

  it("ignores branch text that is not in catalog", () => {
    const branch = resolveSupervisorBranch(
      5,
      [{ id: 10, supervisor_user_id: 5 } as never],
      new Map([
        [5, { branch: "Namangan" } as never],
        [10, { branch: "Namangan" } as never]
      ]),
      buildActiveBranchLookup([])
    );
    expect(branch).toBe("—");
  });
});
