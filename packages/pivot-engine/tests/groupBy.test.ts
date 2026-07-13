import { describe, expect, it } from "vitest";
import { ALL_GROUP_KEY, groupBy, lastGroupKeyPart, splitGroupKey } from "../src/utils/groupBy.js";

describe("groupBy", () => {
  const data = [
    { region: "Toshkent", product: "A", amount: 100 },
    { region: "Toshkent", product: "B", amount: 200 },
    { region: "Samarqand", product: "A", amount: 150 }
  ];

  it("guruhlaydi — bitta maydon", () => {
    const groups = groupBy(data, ["region"]);
    expect(groups.size).toBe(2);
    expect(groups.get("Toshkent")).toHaveLength(2);
    expect(groups.get("Samarqand")).toHaveLength(1);
  });

  it("guruhlaydi — bir nechta maydon", () => {
    const groups = groupBy(data, ["region", "product"]);
    expect(groups.get("Toshkent | A")).toHaveLength(1);
    expect(groups.get("Toshkent | B")).toHaveLength(1);
  });

  it("bo'sh maydonlar ro'yxati — barcha ma'lumot", () => {
    const groups = groupBy(data, []);
    expect(groups.size).toBe(1);
    expect(groups.get(ALL_GROUP_KEY)).toHaveLength(3);
  });

  it("null qiymatlar uchun nullLabel", () => {
    const rows = [{ region: null, amount: 1 }];
    const groups = groupBy(rows, ["region"], { nullLabel: "Noma'lum" });
    expect(groups.has("Noma'lum")).toBe(true);
  });

  it("splitGroupKey va lastGroupKeyPart", () => {
    expect(splitGroupKey("A | B | C")).toEqual(["A", "B", "C"]);
    expect(lastGroupKeyPart("Toshkent | A")).toBe("A");
  });
});
