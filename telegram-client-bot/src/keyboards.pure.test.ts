import { describe, expect, it } from "vitest";
import { inlineMarkup, selectKb } from "./keyboards.js";
import type { RefOption } from "./types.js";

const cities: RefOption[] = [
  { value: "AD_ANDIJON", label: "Andijon" },
  { value: "AD_ASAKA", label: "Asaka" },
  { value: "AD_XONOBOD", label: "Xonobod" },
  { value: "AD_SHAXRIXON", label: "Shaxrixon" },
  { value: "AD_ASAKA2", label: "Baliqchi" }
];

describe("select inline 2 columns", () => {
  it("puts city options in two columns and has no empty rows", () => {
    const kb = selectKb(cities, 0, "city");
    const rows = kb.inline_keyboard.filter((r) => r.length > 0);
    expect(rows[0]?.length).toBe(2);
    expect(rows[1]?.length).toBe(2);
    expect(rows[2]?.length).toBe(1);
    expect(inlineMarkup(kb).inline_keyboard.every((r) => r.length > 0)).toBe(true);
    expect(String(rows[0]?.[0]?.text)).toMatch(/Andijon/);
    expect(String(rows[0]?.[1]?.text)).toMatch(/Asaka/);
    const last = rows[rows.length - 1];
    expect(last?.some((b) => "callback_data" in b && b.callback_data === "k:cancel")).toBe(true);
  });

  it("callback data is s:index", () => {
    const kb = selectKb(cities, 0, "city");
    const first = kb.inline_keyboard[0]?.[0] as { callback_data?: string };
    expect(first.callback_data).toBe("s:0");
  });

  it("works for category and region the same way", () => {
    const cats: RefOption[] = [
      { value: "A", label: "A" },
      { value: "B", label: "B" },
      { value: "C", label: "C" }
    ];
    const kb = selectKb(cats, 0, "category");
    expect(kb.inline_keyboard[0]?.length).toBe(2);
    expect(kb.inline_keyboard[1]?.length).toBe(1);
  });
});
