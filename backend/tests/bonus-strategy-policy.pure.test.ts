import { describe, expect, it } from "vitest";
import {
  applyBonusStrategyConstraints,
  normalizeMaxSelect,
  strategyMatchesAgentScope,
  validateBonusStrategyMembers
} from "../src/modules/bonus-strategies/bonus-strategy-policy";

describe("validateBonusStrategyMembers", () => {
  it("kamida 2 a'zo", () => {
    expect(validateBonusStrategyMembers(1, 1)).toBe("STRATEGY_MIN_MEMBERS");
    expect(validateBonusStrategyMembers(2, 1)).toBeNull();
  });

  it("max_select 1…n-1", () => {
    expect(validateBonusStrategyMembers(5, 1)).toBeNull();
    expect(validateBonusStrategyMembers(5, 4)).toBeNull();
    expect(validateBonusStrategyMembers(5, 5)).toBe("STRATEGY_MAX_SELECT_TOO_HIGH");
    expect(validateBonusStrategyMembers(5, 0)).toBe("STRATEGY_MAX_SELECT_MIN");
  });
});

describe("normalizeMaxSelect", () => {
  it("default 1, yuqori chegara n-1", () => {
    expect(normalizeMaxSelect(undefined, 5)).toBe(1);
    expect(normalizeMaxSelect(10, 5)).toBe(4);
    expect(normalizeMaxSelect(2, 5)).toBe(2);
  });
});

describe("applyBonusStrategyConstraints", () => {
  const slots = [
    { ruleId: 1, priority: 50 },
    { ruleId: 2, priority: 40 },
    { ruleId: 3, priority: 30 },
    { ruleId: 4, priority: 20 },
    { ruleId: 5, priority: 10 },
    { ruleId: 99, priority: 100 }
  ];
  const strategy = {
    id: 7,
    name: "S",
    max_select: 2,
    rule_ids: [1, 2, 3, 4, 5]
  };

  it("tanlovsiz — prioritet bo‘yicha 2 ta + tashqi qoida", () => {
    const r = applyBonusStrategyConstraints(slots, [strategy], undefined);
    expect(r.error).toBeUndefined();
    expect(r.slots.map((s) => s.ruleId).sort((a, b) => a - b)).toEqual([1, 2, 99]);
    expect(r.applied_selections[0]?.rule_ids).toEqual([1, 2]);
  });

  it("agent 2 ta tanlaydi", () => {
    const r = applyBonusStrategyConstraints(slots, [strategy], [
      { strategy_id: 7, rule_ids: [4, 5] }
    ]);
    expect(r.error).toBeUndefined();
    expect(r.slots.map((s) => s.ruleId).sort((a, b) => a - b)).toEqual([4, 5, 99]);
  });

  it("3 ta tanlash — xato", () => {
    const r = applyBonusStrategyConstraints(slots, [strategy], [
      { strategy_id: 7, rule_ids: [1, 2, 3] }
    ]);
    expect(r.error).toBe("STRATEGY_SELECTION_TOO_MANY");
  });

  it("bo‘sh tanlov — xato", () => {
    const r = applyBonusStrategyConstraints(slots, [strategy], [
      { strategy_id: 7, rule_ids: [] }
    ]);
    expect(r.error).toBe("STRATEGY_SELECTION_REQUIRED");
  });
});

describe("strategyMatchesAgentScope", () => {
  it("bo‘sh scope — hammaga", () => {
    expect(
      strategyMatchesAgentScope(
        { scope_branch_codes: [], scope_agent_user_ids: [], scope_trade_direction_ids: [] },
        null
      )
    ).toBe(true);
  });

  it("filial", () => {
    expect(
      strategyMatchesAgentScope(
        {
          scope_branch_codes: ["North"],
          scope_agent_user_ids: [],
          scope_trade_direction_ids: []
        },
        { userId: 1, branch: "north", trade_direction_id: null }
      )
    ).toBe(true);
    expect(
      strategyMatchesAgentScope(
        {
          scope_branch_codes: ["North"],
          scope_agent_user_ids: [],
          scope_trade_direction_ids: []
        },
        { userId: 1, branch: "south", trade_direction_id: null }
      )
    ).toBe(false);
  });
});
