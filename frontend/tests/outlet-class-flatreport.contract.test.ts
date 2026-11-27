import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const src = readFileSync(
  join(__dirname, "../app/(dashboard)/reports/outlet-class/page.tsx"),
  "utf8"
);

describe("outlet-class FlatReport chrome contract", () => {
  it("prefs, grid, SalesDoc columns, no filter search", () => {
    expect(src).toMatch(/FlatReportPage/);
    expect(src).toMatch(/tablePrefsId:\s*"report\.outlet-class\.v2"/);
    expect(src).toMatch(/filterGridCols:\s*9/);
    expect(src).toMatch(/placeholder:\s*"Группировка"/);
    expect(src).toMatch(/placeholder:\s*"Пороги"/);
    expect(src).toMatch(/formatOutletClassRowLabel/);
    expect(src).toMatch(/defaultValue:\s*"class"/);
    expect(src).toMatch(/Идентификация клиента/);
    expect(src).toMatch(/Территория/);
    expect(src).toMatch(/Кол-во клиентов/);
    expect(src).toMatch(/category_columns/);
    expect(src).toMatch(/category_shares/);
    expect(src).not.toMatch(/A:1000000,B:500000,…/);
    expect(src).toMatch(/placeholder:\s*"Зона"/);
    expect(src).toMatch(/placeholder:\s*"Область"/);
    expect(src).toMatch(/placeholder:\s*"Город"/);
    expect(src).not.toMatch(/Территория [123]/);
    expect(src).toMatch(/clientTableSearch/);
    expect(src).not.toMatch(/kind:\s*"search"/);
  });
});
