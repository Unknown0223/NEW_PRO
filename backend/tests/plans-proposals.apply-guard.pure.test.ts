import { describe, expect, it } from "vitest";

/** Apply qoidasi: approved / pending_approval reja yoki target overwrite qilinmaydi. */
function shouldSkipPlan(status: string): boolean {
  return status === "approved" || status === "pending_approval";
}

function shouldSkipTarget(status: string): boolean {
  return status === "approved" || status === "pending_approval";
}

function versionConflict(current: number, requested: number): boolean {
  return current !== requested;
}

describe("proposals apply guards", () => {
  it("blocks overwrite of approved/pending plans", () => {
    expect(shouldSkipPlan("draft")).toBe(false);
    expect(shouldSkipPlan("approved")).toBe(true);
    expect(shouldSkipPlan("pending_approval")).toBe(true);
  });

  it("blocks overwrite of approved/pending targets", () => {
    expect(shouldSkipTarget("draft")).toBe(false);
    expect(shouldSkipTarget("approved")).toBe(true);
    expect(shouldSkipTarget("pending_approval")).toBe(true);
  });

  it("optimistic version conflict", () => {
    expect(versionConflict(3, 3)).toBe(false);
    expect(versionConflict(3, 2)).toBe(true);
  });
});
