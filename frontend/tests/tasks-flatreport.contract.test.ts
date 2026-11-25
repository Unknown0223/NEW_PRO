import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const frontendRoot = join(__dirname, "..");

describe("tasks FlatReport chrome contract", () => {
  it("tasks page has prefs, grid, completed_at, FlatReportPage", () => {
    const src = readFileSync(join(frontendRoot, "app/(dashboard)/reports/tasks/page.tsx"), "utf8");
    expect(src).toMatch(/FlatReportPage/);
    expect(src).toMatch(/tablePrefsId:\s*"report\.tasks\.v1"/);
    expect(src).toMatch(/filterGridCols:\s*6/);
    expect(src).toMatch(/key:\s*"completed_at"/);
    expect(src).toMatch(/header:\s*"Завершена"/);
    expect(src).toMatch(/clientTableSearch/);
    expect(src).not.toMatch(/TasksWorkspace|dedicated workspace/i);
  });
});
