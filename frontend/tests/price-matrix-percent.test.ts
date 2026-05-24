import { describe, expect, it } from "vitest";
import { applyPercentToDraft } from "@/lib/price-matrix-percent";

describe("applyPercentToDraft", () => {
  it("applies +10% to draft values", () => {
    const rows = [{ product_id: 1, name: "A", sku: "S1", price: "100", currency: "UZS" }];
    const next = applyPercentToDraft(rows, { 1: "100" }, 1.1);
    expect(next[1]).toBe("110");
  });

  it("falls back to row price when draft empty", () => {
    const rows = [{ product_id: 2, name: "B", sku: "S2", price: "200", currency: "UZS" }];
    const next = applyPercentToDraft(rows, {}, 0.9);
    expect(next[2]).toBe("180");
  });
});
