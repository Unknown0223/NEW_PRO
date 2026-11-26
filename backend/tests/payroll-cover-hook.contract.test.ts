import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(__dirname, "..");

describe("payroll cover hook", () => {
  it("wires excludeCoveredAgentDays into payroll.inputs attendance", () => {
    const src = readFileSync(
      join(root, "src/modules/payroll/payroll.inputs.ts"),
      "utf8"
    );
    expect(src).toMatch(/excludeCoveredAgentDays/);
    expect(src).toMatch(/listActiveCoverDatesForAgent/);
    expect(src).toMatch(/shouldExcludeAgentDay/);
  });
});
