import { describe, expect, it, vi } from "vitest";
import type { AgentAssignmentPatch } from "../src/modules/clients/clients.types";

vi.mock("../src/modules/work-slots/work-slots.agent-gate", () => ({
  assertAgentCanTakeNewWork: vi.fn(async (_tenantId: number, agentId: number) => {
    if (agentId === 99) throw new Error("AGENT_NOT_ON_SLOT");
  })
}));

vi.mock("../src/modules/work-slots/work-slots.expeditor-gate", () => ({
  assertExpeditorCanTakeNewWork: vi.fn(async (_tenantId: number, expeditorId: number) => {
    if (expeditorId === 88) throw new Error("EXPEDITOR_NOT_ON_SLOT");
  })
}));

describe("filterImportAgentPatchesByWorkSlot", () => {
  it("keeps client row path: drops agent without work slot, keeps expeditor/days", async () => {
    const { filterImportAgentPatchesByWorkSlot } = await import(
      "../src/modules/clients/clients.import.agent-slot-gate"
    );
    const warnings: string[] = [];
    const patches: AgentAssignmentPatch[] = [
      { slot: 1, agent_id: 99, visit_weekdays: [1, 3] },
      { slot: 2, agent_id: 5, visit_weekdays: [2] }
    ];
    const out = await filterImportAgentPatchesByWorkSlot(1, patches, {
      excelRow: 4,
      warn: (m) => warnings.push(m)
    });
    expect(out).toEqual([
      { slot: 1, agent_id: null, visit_weekdays: [1, 3] },
      { slot: 2, agent_id: 5, visit_weekdays: [2] }
    ]);
    expect(warnings.some((w) => w.includes("рабочее место"))).toBe(true);
  });

  it("drops empty patch when only agent was present and not on slot", async () => {
    const { filterImportAgentPatchesByWorkSlot } = await import(
      "../src/modules/clients/clients.import.agent-slot-gate"
    );
    const out = await filterImportAgentPatchesByWorkSlot(
      1,
      [{ slot: 1, agent_id: 99 }],
      { excelRow: 1, warn: () => {} }
    );
    expect(out).toEqual([]);
  });

  it("drops expeditor without work slot, keeps agent/days", async () => {
    const { filterImportAgentPatchesByWorkSlot } = await import(
      "../src/modules/clients/clients.import.agent-slot-gate"
    );
    const warnings: string[] = [];
    const out = await filterImportAgentPatchesByWorkSlot(
      1,
      [{ slot: 1, agent_id: 5, expeditor_user_id: 88, visit_weekdays: [1] }],
      { excelRow: 2, warn: (m) => warnings.push(m) }
    );
    expect(out).toEqual([{ slot: 1, agent_id: 5, expeditor_user_id: null, visit_weekdays: [1] }]);
    expect(warnings.some((w) => w.includes("экспедитор"))).toBe(true);
  });
});
