import { describe, expect, it } from "vitest";
import { eligibleRecipients } from "../src/modules/mobile/share/share-partner-eligibility.pure";

describe("eligibleRecipients", () => {
  const candidates = [
    { userId: 1, warehouseIds: [10] },
    { userId: 2, warehouseIds: [10, 20] },
    { userId: 3, warehouseIds: [30] },
    { userId: 4, warehouseIds: [10] }
  ];

  it("empty partners → own warehouse only", () => {
    const out = eligibleRecipients([10], [], candidates);
    expect(out.map((c) => c.userId).sort()).toEqual([1, 2, 4]);
  });

  it("non-empty partners → only partners (even if same warehouse)", () => {
    const out = eligibleRecipients(
      [10],
      [{ userId: 3 }, { userId: 99 }],
      candidates
    );
    expect(out.map((c) => c.userId)).toEqual([3]);
  });

  it("partner not in candidates → omitted", () => {
    const out = eligibleRecipients([10], [{ userId: 99 }], candidates);
    expect(out).toEqual([]);
  });
});
