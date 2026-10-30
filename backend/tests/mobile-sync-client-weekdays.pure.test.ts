import { describe, expect, it } from "vitest";
import { parseVisitWeekdaysJson } from "../src/modules/clients/clients.types";
import { resolveSyncClientVisitPlan } from "../src/modules/mobile/mobile-agent-sync.client-weekdays";

describe("parseVisitWeekdaysJson", () => {
  it("parses arrays and JSON strings", () => {
    expect(parseVisitWeekdaysJson([2, 5])).toEqual([2, 5]);
    expect(parseVisitWeekdaysJson("[1,3]")).toEqual([1, 3]);
    expect(parseVisitWeekdaysJson([])).toEqual([]);
    expect(parseVisitWeekdaysJson(null)).toEqual([]);
  });
});

describe("resolveSyncClientVisitPlan", () => {
  it("does not treat empty assignment weekdays as a value (falls back to client)", () => {
    const plan = resolveSyncClientVisitPlan(
      [{ visit_weekdays: [], agent_id: 9 }],
      [2, 4],
      { agentId: 9 }
    );
    expect(plan.weekdays).toEqual([2, 4]);
  });

  it("prefers this agent's assignment over another slot", () => {
    const plan = resolveSyncClientVisitPlan(
      [
        { visit_weekdays: [1], agent_id: 1, work_slot_id: 10 },
        { visit_weekdays: [2, 3], agent_id: 9, work_slot_id: 20 }
      ],
      [7],
      { agentId: 9, workSlotId: 20 }
    );
    expect(plan.weekdays).toEqual([2, 3]);
  });

  it("matches vacant slot via work_slot_id when agent_id is null", () => {
    const plan = resolveSyncClientVisitPlan(
      [{ visit_weekdays: [5], agent_id: null, work_slot_id: 44 }],
      [],
      { agentId: 9, workSlotId: 44 }
    );
    expect(plan.weekdays).toEqual([5]);
  });
});
