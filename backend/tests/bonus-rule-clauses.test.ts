import { describe, expect, it } from "vitest";
import {
  isGiftBonusType,
  synthesizePrimaryClauseFromFlat,
  validateClausesForGiftBonus
} from "../src/modules/bonus-rules/bonus-rules.clauses";

describe("bonus rule clauses", () => {
  it("isGiftBonusType: qty and sum gift", () => {
    expect(isGiftBonusType("qty")).toBe(true);
    expect(isGiftBonusType("sum", null)).toBe(true);
    expect(isGiftBonusType("sum", 5)).toBe(false);
    expect(isGiftBonusType("discount", 10)).toBe(false);
  });

  it("validateClausesForGiftBonus: requires reward + products", () => {
    expect(() => validateClausesForGiftBonus("qty", [])).toThrow("CLAUSES_REQUIRED");
    expect(() =>
      validateClausesForGiftBonus("qty", [
        {
          grants_reward: false,
          product_ids: [1],
          scope_restrict_assortment: true,
          buy_qty: 6,
          free_qty: 1
        }
      ])
    ).toThrow("CLAUSE_REWARD_REQUIRED");

    expect(() =>
      validateClausesForGiftBonus("qty", [
        {
          grants_reward: true,
          product_ids: [1],
          scope_restrict_assortment: true,
          bonus_product_ids: [],
          buy_qty: 6,
          free_qty: 1
        }
      ])
    ).not.toThrow();

    expect(() =>
      validateClausesForGiftBonus("qty", [
        {
          grants_reward: true,
          product_ids: [],
          bonus_product_ids: [],
          scope_restrict_assortment: false,
          conditions: [{ step_qty: 6, bonus_qty: 1 }]
        }
      ])
    ).toThrow("PRODUCT_SCOPE_REQUIRED");
  });

  it("AND setup: gate + reward", () => {
    const clauses = validateClausesForGiftBonus("qty", [
      {
        grants_reward: false,
        product_ids: [10],
        scope_restrict_assortment: true,
        buy_qty: 6,
        free_qty: 1
      },
      {
        grants_reward: true,
        product_ids: [20],
        bonus_product_ids: [20],
        scope_restrict_assortment: true,
        buy_qty: 6,
        free_qty: 1
      }
    ]);
    expect(clauses).toHaveLength(2);
    expect(clauses.filter((c) => c.grants_reward !== false)).toHaveLength(1);
  });

  it("synthesizePrimaryClauseFromFlat", () => {
    const c = synthesizePrimaryClauseFromFlat({
      type: "qty",
      priority: 10,
      product_ids: [1],
      bonus_product_ids: [1],
      scope_restrict_assortment: true,
      buy_qty: 6,
      free_qty: 1
    });
    expect(c.grants_reward).toBe(true);
    expect(c.product_ids).toEqual([1]);
  });
});
