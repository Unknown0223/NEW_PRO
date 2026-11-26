import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const src = readFileSync(
  join(__dirname, "../app/(dashboard)/reports/prices/page.tsx"),
  "utf8"
);

describe("prices FlatReport chrome contract", () => {
  it("prefs, grid, no filter search, multiSelect names kept", () => {
    expect(src).toMatch(/FlatReportPage/);
    expect(src).toMatch(/tablePrefsId:\s*"report\.prices\.v1"/);
    expect(src).toMatch(/filterGridCols:\s*9/);
    expect(src).toMatch(/clientTableSearch/);
    expect(src).not.toMatch(/kind:\s*"search"/);
    expect(src).toMatch(/placeholder:\s*"Тип цены"/);
    expect(src).toMatch(/placeholder:\s*"Категория"/);
    expect(src).toMatch(/placeholder:\s*"Бренд"/);
    expect(src).toMatch(/placeholder:\s*"Товар"/);
  });
});
