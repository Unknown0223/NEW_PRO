import { describe, expect, it } from "vitest";
import {
  expeditorEligibleForAutoAssign,
  expeditorRulesMatch,
  hasExpeditorAssignmentConstraints,
  pickExpeditorAssignmentRules
} from "../src/modules/orders/expeditor-auto-assign";

const emptyCtx = {
  orderPriceTypes: ["retail"],
  orderAgentId: 5 as number | null,
  warehouseId: 8 as number | null,
  agentTradeDirection: "опт" as string | null,
  territoryBlob: "tashkent chilonzor",
  weekday: 1
};

describe("expeditor auto-assign helpers", () => {
  it("skips off-slot expeditors when tenant uses expeditor work slots", () => {
    expect(
      expeditorEligibleForAutoAssign({ usesExpeditorWorkSlots: true, hasActiveSlot: false })
    ).toBe(false);
    expect(
      expeditorEligibleForAutoAssign({ usesExpeditorWorkSlots: true, hasActiveSlot: true })
    ).toBe(true);
    expect(
      expeditorEligibleForAutoAssign({ usesExpeditorWorkSlots: false, hasActiveSlot: false })
    ).toBe(true);
  });

  it("prefers slot assignment rules over user copy", () => {
    const picked = pickExpeditorAssignmentRules(
      { warehouse_ids: [9], agent_ids: [] },
      { warehouse_ids: [1], agent_ids: [5] }
    );
    expect(picked.warehouse_ids).toEqual([9]);
    expect(picked.agent_ids).toBeUndefined();
  });

  it("falls back to user rules when slot has no constraints", () => {
    const picked = pickExpeditorAssignmentRules({}, { agent_ids: [5] });
    expect(picked.agent_ids).toEqual([5]);
  });

  it("hasExpeditorAssignmentConstraints is false for empty rules", () => {
    expect(hasExpeditorAssignmentConstraints({})).toBe(false);
    expect(hasExpeditorAssignmentConstraints({ warehouse_ids: [1] })).toBe(true);
  });

  it("expeditorRulesMatch requires all non-empty axes", () => {
    expect(
      expeditorRulesMatch({ warehouse_ids: [8], agent_ids: [5] }, emptyCtx)
    ).toBe(true);
    expect(
      expeditorRulesMatch({ warehouse_ids: [99] }, emptyCtx)
    ).toBe(false);
  });
});
