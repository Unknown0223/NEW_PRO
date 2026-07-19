import { describe, expect, it } from "vitest";
import {
  flatColumnIdsFromConfig,
  headerDragActivated,
  moveFieldId
} from "../lib/pivot-header-reorder";

describe("moveFieldId", () => {
  it("ustunlarni almashtiradi", () => {
    expect(moveFieldId(["a", "b", "c"], "a", "c")).toEqual(["b", "c", "a"]);
    expect(moveFieldId(["a", "b", "c"], "c", "a")).toEqual(["c", "a", "b"]);
  });

  it("bir xil yoki noma’lum → null", () => {
    expect(moveFieldId(["a", "b"], "a", "a")).toBeNull();
    expect(moveFieldId(["a", "b"], "x", "b")).toBeNull();
  });
});

describe("flatColumnIdsFromConfig", () => {
  it("rows + columns + values ni birlashtiradi", () => {
    expect(
      flatColumnIdsFromConfig({
        rows: ["brand", "dealer"],
        columns: [],
        values: [{ fieldId: "amount" }, { fieldId: "volume" }]
      })
    ).toEqual(["brand", "dealer", "amount", "volume"]);
  });

  it("takrorlarni olib tashlaydi", () => {
    expect(
      flatColumnIdsFromConfig({
        rows: ["brand", "amount"],
        columns: ["dealer"],
        values: [{ fieldId: "amount" }, { fieldId: "volume" }]
      })
    ).toEqual(["brand", "amount", "dealer", "volume"]);
  });

  it("qiymat ustunini o‘lchovlar orasiga ko‘chiradi", () => {
    const ids = flatColumnIdsFromConfig({
      rows: ["brand", "dealer"],
      columns: [],
      values: [{ fieldId: "amount" }, { fieldId: "volume" }]
    });
    expect(moveFieldId(ids, "brand", "dealer")).toEqual([
      "dealer",
      "brand",
      "amount",
      "volume"
    ]);
    expect(moveFieldId(ids, "amount", "brand")).toEqual([
      "amount",
      "brand",
      "dealer",
      "volume"
    ]);
  });
});

describe("headerDragActivated", () => {
  it("kichik siljishda false", () => {
    expect(headerDragActivated(2, 2)).toBe(false);
  });

  it("yetarli siljishda true", () => {
    expect(headerDragActivated(6, 0)).toBe(true);
  });
});
