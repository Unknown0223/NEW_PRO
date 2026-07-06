import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const rootPkg = JSON.parse(readFileSync(join(__dirname, "../../package.json"), "utf8")) as {
  scripts: Record<string, string>;
};
const backendPkg = JSON.parse(readFileSync(join(__dirname, "../package.json"), "utf8")) as {
  scripts: Record<string, string>;
};

describe("prod deploy pack scripts", () => {
  it("root prod:verify chains module verify scripts", () => {
    const cmd = rootPkg.scripts["prod:verify"] ?? "";
    expect(cmd).toContain("foundation:verify:fast");
    expect(cmd).toContain("dostup:verify");
    expect(cmd).toContain("polki:verify");
    expect(cmd).toContain("work-slots:verify");
    expect(cmd).toContain("refaktoring:verify");
    expect(cmd).toContain("bitta-ilova:verify");
    expect(cmd).toContain("plans:verify");
  });

  it("backend prod:ops documents deploy checklist commands", () => {
    expect(backendPkg.scripts["backfill:work-slots"]).toBeDefined();
    expect(backendPkg.scripts["rbac:migrate-crud"]).toBeDefined();
    expect(backendPkg.scripts["prod:ops-check"]).toBeDefined();
  });
});
