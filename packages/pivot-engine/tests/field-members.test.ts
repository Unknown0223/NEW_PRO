import { describe, expect, it } from "vitest";
import { collectExpandableRowKeys, getFieldMembers } from "../src/utils/fieldMembers.js";

describe("getFieldMembers", () => {
  const data = [
    { region: "Toshkent", amount: 100 },
    { region: "Samarqand", amount: 200 },
    { region: "Toshkent", amount: 300 },
    { region: "Buxoro", amount: 50 }
  ];

  it("noyob qiymatlar qaytaradi", () => {
    expect(getFieldMembers(data, "region")).toEqual(["Buxoro", "Samarqand", "Toshkent"]);
  });

  it("bo'sh maydon — bo'sh ro'yxat", () => {
    expect(getFieldMembers(data, "missing")).toEqual([]);
  });
});

describe("collectExpandableRowKeys", () => {
  it("faqat bolali qator kalitlari", () => {
    const rows = [
      { key: "a", children: [{ key: "a|1", children: [{ key: "a|1|x" }] }] },
      { key: "b" }
    ];
    expect(collectExpandableRowKeys(rows)).toEqual(["a", "a|1"]);
  });
});
