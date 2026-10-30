import { describe, expect, it } from "vitest";
import { effectiveGrid, type GridSnap } from "../src/modules/payroll/payroll.grid-month.pure";

const row = (p: Partial<GridSnap> & Pick<GridSnap, "ym" | "scope">): GridSnap => ({
  role: "agent",
  user_id: 0,
  base_amount: null,
  item_amounts: {},
  ...p
});

describe("effectiveGrid", () => {
  const rows = [
    row({ ym: 202609, scope: "role", base_amount: 100, item_amounts: { "1": 500 } }),
    row({ ym: 202610, scope: "role", base_amount: 200, item_amounts: { "1": 800 } }),
    row({ ym: 202610, scope: "user", user_id: 5, item_amounts: { "1": 900 } })
  ];

  it("oy nusxasi yo'q bo'lsa oldingi oydan oladi", () => {
    expect(effectiveGrid(rows, 202611, "agent", 0)?.item_amounts).toEqual({ "1": 800 });
  });

  it("xodim setkasi rol ustiga yoziladi", () => {
    expect(effectiveGrid(rows, 202610, "agent", 5)?.item_amounts).toEqual({ "1": 900 });
  });

  it("nusxadan oldingi oy o'sha paytdagi setkani ko'radi", () => {
    expect(effectiveGrid(rows, 202609, "agent", 5)?.base_amount).toBe(100);
  });
});
