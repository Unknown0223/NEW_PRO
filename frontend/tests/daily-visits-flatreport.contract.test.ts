import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const page = readFileSync(
  join(__dirname, "../app/(dashboard)/reports/daily-visits/page.tsx"),
  "utf8"
);
const filters = readFileSync(
  join(__dirname, "../components/reports/flat-report/flat-report-filters.tsx"),
  "utf8"
);
const types = readFileSync(
  join(__dirname, "../components/reports/flat-report/types.ts"),
  "utf8"
);

describe("daily-visits FlatReport chrome contract", () => {
  it("prefs, grid, Год/Месяц, no filter search, no dateTypeAsRadio", () => {
    expect(page).toMatch(/FlatReportPage/);
    expect(page).toMatch(/tablePrefsId:\s*"report\.daily-visits\.v1"/);
    expect(page).toMatch(/filterGridCols:\s*9/);
    expect(page).toMatch(/paramKey:\s*"year"[\s\S]*?placeholder:\s*"Год"/);
    expect(page).toMatch(/paramKey:\s*"month"[\s\S]*?placeholder:\s*"Месяц"/);
    expect(page).toMatch(/clientTableSearch/);
    expect(page).not.toMatch(/kind:\s*"search"/);
    expect(page).not.toMatch(/dateTypeAsRadio/);
  });

  it("FlatReport select supports placeholder and renders field name", () => {
    expect(types).toMatch(/FlatReportSelectField[\s\S]*?placeholder\?:/);
    expect(filters).toMatch(/field\.placeholder/);
    expect(filters).toMatch(/aria-label=\{name\}/);
  });
});
