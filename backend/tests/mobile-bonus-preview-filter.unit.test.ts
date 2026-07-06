import { describe, expect, it } from "vitest";
import { type BonusStackPolicy, resolveBonusSlotTakeCount } from "../src/modules/orders/bonus-stack-policy";

type Row = { rule_id: number; bonus_qty: number };

function filterEligibleBonusesForPreview(
  rows: Row[],
  stackPolicy: BonusStackPolicy,
  appliedAutoBonusRuleIds: number[]
): Row[] {
  const eligible = rows.filter((r) => r.bonus_qty > 0);
  if (eligible.length === 0) return [];
  if (stackPolicy.mode === "all") return eligible;
  const take = resolveBonusSlotTakeCount(eligible.length, stackPolicy);
  if (take <= 0) return [];
  const ordered: Row[] = [];
  for (const id of appliedAutoBonusRuleIds) {
    const hit = eligible.find((r) => r.rule_id === id);
    if (hit && !ordered.some((x) => x.rule_id === hit.rule_id)) ordered.push(hit);
  }
  for (const r of eligible) {
    if (!ordered.some((x) => x.rule_id === r.rule_id)) ordered.push(r);
  }
  return ordered.slice(0, take);
}

describe("filterEligibleBonusesForPreview", () => {
  const rows: Row[] = [
    { rule_id: 5, bonus_qty: 17 },
    { rule_id: 2, bonus_qty: 4 }
  ];

  it("returns all eligible when stack mode is all", () => {
    const out = filterEligibleBonusesForPreview(
      rows,
      { mode: "all", maxUnits: null, forbidApplyAllEligible: false },
      [5, 2]
    );
    expect(out.map((r) => r.rule_id)).toEqual([5, 2]);
  });

  it("returns one when stack mode is first_only", () => {
    const out = filterEligibleBonusesForPreview(
      rows,
      { mode: "first_only", maxUnits: null, forbidApplyAllEligible: false },
      [5, 2]
    );
    expect(out).toHaveLength(1);
    expect(out[0]!.rule_id).toBe(5);
  });
});
