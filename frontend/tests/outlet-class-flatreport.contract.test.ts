import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const src = readFileSync(
  join(__dirname, "../app/(dashboard)/reports/outlet-class/page.tsx"),
  "utf8"
);

describe("outlet-class FlatReport chrome contract", () => {
  it("prefs, grid, territory names, no filter search", () => {
    expect(src).toMatch(/FlatReportPage/);
    expect(src).toMatch(/tablePrefsId:\s*"report\.outlet-class\.v1"/);
    expect(src).toMatch(/filterGridCols:\s*9/);
    expect(src).toMatch(/placeholder:\s*"Группировка"/);
    expect(src).toMatch(/placeholder:\s*"Пороги"/);
    expect(src).not.toMatch(/A:1000000,B:500000,…/);
    expect(src).toMatch(/placeholder:\s*"Зона"/);
    expect(src).toMatch(/placeholder:\s*"Область"/);
    expect(src).toMatch(/placeholder:\s*"Город"/);
    expect(src).not.toMatch(/Территория [123]/);
    expect(src).toMatch(/clientTableSearch/);
    expect(src).not.toMatch(/kind:\s*"search"/);
  });
});
