import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const frontendRoot = join(__dirname, "..");

describe("bonuses FlatReport chrome contract", () => {
  it("bonuses page has prefs, date radios, grid, FlatReportPage, group_by cols", () => {
    const src = readFileSync(join(frontendRoot, "app/(dashboard)/reports/bonuses/page.tsx"), "utf8");
    expect(src).toMatch(/FlatReportPage/);
    expect(src).toMatch(/tablePrefsId:\s*"report\.bonuses\.v1"/);
    expect(src).toMatch(/dateTypeAsRadio:\s*true/);
    expect(src).toMatch(/filterGridCols:\s*9/);
    expect(src).toMatch(/placeholder:\s*"Зона"/);
    expect(src).toMatch(/placeholder:\s*"Область"/);
    expect(src).toMatch(/placeholder:\s*"Город"/);
    expect(src).not.toMatch(/Территория [123]/);
    expect(src).toMatch(/paramKey:\s*["']group_by["']/);
    expect(src).toMatch(/columns:\s*\(\{\s*applied\s*\}\)/);
    expect(src).toMatch(/clientTableSearch/);
    expect(src).not.toMatch(/kind:\s*"search"/);
    expect(src).not.toMatch(/BonusesWorkspace|dedicated workspace/i);
  });
});
