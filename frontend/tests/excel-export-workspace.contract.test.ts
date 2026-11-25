import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const frontendRoot = join(__dirname, "..");

describe("excel-export workspace contract (SalesDoc Version1)", () => {
  it("page uses dedicated workspace, not FlatReportPage alone", () => {
    const page = readFileSync(
      join(frontendRoot, "app/(dashboard)/reports/excel-export/page.tsx"),
      "utf8"
    );
    expect(page).toMatch(/ExcelExportWorkspace/);
    expect(page).not.toMatch(/FlatReportPage/);
  });

  it("has status cards and v1 export button", () => {
    const ws = join(frontendRoot, "components/reports/excel-export/excel-export-workspace.tsx");
    const cards = join(frontendRoot, "components/reports/excel-export/excel-export-cards.tsx");
    expect(existsSync(ws)).toBe(true);
    expect(existsSync(cards)).toBe(true);
    const src = readFileSync(ws, "utf8");
    expect(src).toMatch(/ExcelExportStatusCards/);
    expect(src).toMatch(/Экспорт в Excel \(v1\)/);
    expect(src).toMatch(/status_summaries/);
  });
});
