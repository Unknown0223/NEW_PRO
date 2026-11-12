/** Pure logic tests — table formatting / redaction (no DB). */
import { describe, it, expect } from "vitest";
import { genericTable, pickRows, isSecretKey, rawTable, mergeTables, table } from "../src/modules/ai/ai.format";

describe("pickRows", () => {
  it("array → identity", () => {
    expect(pickRows([{ a: 1 }])).toEqual([{ a: 1 }]);
  });
  it("{data: [...]} → data", () => {
    expect(pickRows({ data: [{ id: 1 }], meta: {} })).toEqual([{ id: 1 }]);
  });
  it("scalar → []", () => {
    expect(pickRows("salom")).toEqual([]);
    expect(pickRows(null)).toEqual([]);
  });
});

describe("isSecretKey", () => {
  it("parol/token/secretlarni yashiradi", () => {
    expect(isSecretKey("password")).toBe(true);
    expect(isSecretKey("refresh_token")).toBe(true);
    expect(isSecretKey("pinfl")).toBe(true);
    expect(isSecretKey("name")).toBe(false);
    expect(isSecretKey("price")).toBe(false);
  });
});

describe("genericTable", () => {
  it("{data: [...]} dan jadval", () => {
    const out = genericTable(
      { data: [{ name: "Olma", price: 1000, password: "secret" }] },
      { title: "Mahsulotlar", summary: "1 ta", preferred: ["name", "price"] }
    );
    expect(out.title).toBe("Mahsulotlar");
    expect(out.columns).toContain("name");
    expect(out.columns).toContain("price");
    expect(isSecretKey("password") && out.columns).toBe(true);
    expect(out.rows[0]?.[0]).toBe("Olma");
  });
  it("yo‘q ma’lumot → Xulosa?", () => {
    const out = genericTable({ data: [] }, { title: "Bo‘sh" });
    expect(out.columns).toEqual([]);
    expect(out.rows).toEqual([]);
  });
});

describe("rawTable / table", () => {
  it("rawTable berilgan ustunlar bilan", () => {
    const out = rawTable({ title: "T", columns: ["A", "B"], rows: [["1", "2"]] });
    expect(out.rows).toEqual([["1", "2"]]);
  });
  it("table({keys, rows})", () => {
    const out = table({ keys: ["sku", "name"], rows: [["S1", "Olma"]] });
    expect(out.columns).toEqual(["sku", "name"]);
  });
});

describe("mergeTables", () => {
  it("bir necha jadvalni birlashtiradi", () => {
    const out = mergeTables([
      { title: "A", summary: "", columns: ["x"], rows: [["1"]] },
      { title: "B", summary: "", columns: ["x"], rows: [["2"]] }
    ]);
    expect(out.rows.length).toBe(2);
  });
});
