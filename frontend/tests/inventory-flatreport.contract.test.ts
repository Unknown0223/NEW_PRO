import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const frontendRoot = join(__dirname, "..");

describe("inventory FlatReport chrome contract", () => {
  it("inventory page has prefs, date radios, address, FlatReportPage", () => {
    const src = readFileSync(
      join(frontendRoot, "app/(dashboard)/reports/inventory/page.tsx"),
      "utf8"
    );
    expect(src).toMatch(/FlatReportPage/);
    expect(src).toMatch(/tablePrefsId:\s*"report\.inventory\.v2"/);
    expect(src).toMatch(/dateTypeAsRadio:\s*true/);
    expect(src).toMatch(/filterGridCols:\s*6/);
    expect(src).toMatch(/key:\s*"address"/);
    expect(src).toMatch(/header:\s*"Адрес"/);
    expect(src).toMatch(/clientTableSearch/);
    expect(src).not.toMatch(/kind:\s*"search"/);
    expect(src).not.toMatch(/InventoryWorkspace|dedicated workspace/i);
  });
});
