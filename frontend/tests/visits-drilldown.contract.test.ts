import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const frontendRoot = join(__dirname, "..");

describe("visits drill-down modal contract", () => {
  it("modal and metric link modules exist", () => {
    expect(existsSync(join(frontendRoot, "components/reports/visits/visits-detail-modal.tsx"))).toBe(
      true
    );
    expect(existsSync(join(frontendRoot, "components/reports/visits/visits-metric-link.tsx"))).toBe(
      true
    );
  });

  it("visits page wires detail modal and metric types", () => {
    const src = readFileSync(join(frontendRoot, "app/(dashboard)/reports/visits/page.tsx"), "utf8");
    expect(src).toMatch(/VisitsDetailModal/);
    expect(src).toMatch(/only_order|okb|visited|not_visited|rejected|only_photo/);
    expect(src).toMatch(/VisitsMetricLink|formatters/);
    const modal = readFileSync(
      join(frontendRoot, "components/reports/visits/visits-detail-modal.tsx"),
      "utf8"
    );
    expect(modal).toMatch(/visits\/detail/);
    expect(modal).toMatch(/appendParams/);
    expect(modal).toMatch(/isError/);
  });

  it("formatters allow ReactNode", () => {
    const src = readFileSync(
      join(frontendRoot, "components/reports/flat-report/types.ts"),
      "utf8"
    );
    expect(src).toMatch(/ReactNode/);
  });
});
