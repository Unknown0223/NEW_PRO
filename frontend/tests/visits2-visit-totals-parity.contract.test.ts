import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(__dirname, "..");

describe("visits-2 / visit-totals parity gaps", () => {
  it("visits-2 enables territoryCascade", () => {
    const src = readFileSync(join(root, "app/(dashboard)/reports/visits-2/page.tsx"), "utf8");
    expect(src).toMatch(/territoryCascade:\s*true/);
    expect(src).toMatch(/placeholder:\s*"Зона"/);
  });

  it("FlatReport supports cascade + report error banner", () => {
    const types = readFileSync(join(root, "components/reports/flat-report/types.ts"), "utf8");
    const page = readFileSync(join(root, "components/reports/flat-report/flat-report-page.tsx"), "utf8");
    const helpers = readFileSync(
      join(root, "components/reports/flat-report/flat-report-helpers.ts"),
      "utf8"
    );
    expect(types).toMatch(/territoryCascade\?:/);
    expect(helpers).toMatch(/applyTerritoryCascadeToMultiItems/);
    expect(page).toMatch(/reportQ\.isError/);
    expect(page).toMatch(/getUserFacingError/);
  });
});
