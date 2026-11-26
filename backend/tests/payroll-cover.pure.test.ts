import { describe, expect, it } from "vitest";
import {
  excludeCoveredAgentDays,
  shouldExcludeAgentDay,
  svrCoverTag
} from "../src/modules/payroll/payroll-cover.pure";

describe("payroll cover", () => {
  it("excludes agent day when cover active", () => {
    expect(shouldExcludeAgentDay(true)).toBe(true);
    expect(shouldExcludeAgentDay(false)).toBe(false);
  });

  it("tags SVR_COVER", () => {
    expect(svrCoverTag()).toBe("SVR_COVER");
  });

  it("filters covered dates from agent days", () => {
    const out = excludeCoveredAgentDays(
      ["2026-11-26", "2026-11-27"],
      new Set(["2026-11-26"])
    );
    expect(out).toEqual(["2026-11-27"]);
  });
});
