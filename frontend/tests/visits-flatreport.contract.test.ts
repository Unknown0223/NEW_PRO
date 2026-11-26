import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const frontendRoot = join(__dirname, "..");

describe("visits FlatReport chrome contract", () => {
  it("visits page has prefs, grid, territory names, no filter search, no dateTypeAsRadio", () => {
    const src = readFileSync(join(frontendRoot, "app/(dashboard)/reports/visits/page.tsx"), "utf8");
    expect(src).toMatch(/FlatReportPage/);
    expect(src).toMatch(/tablePrefsId:\s*"report\.visits\.v1"/);
    expect(src).toMatch(/filterGridCols:\s*9/);
    expect(src).toMatch(/placeholder:\s*"Зона"/);
    expect(src).toMatch(/placeholder:\s*"Область"/);
    expect(src).toMatch(/placeholder:\s*"Город"/);
    expect(src).not.toMatch(/Территория [123]/);
    expect(src).toMatch(/clientTableSearch/);
    expect(src).not.toMatch(/kind:\s*"search"/);
    expect(src).not.toMatch(/dateTypeAsRadio/);
  });
});
