import { describe, expect, it } from "vitest";
import { isApproverLeaderRole, isApproverLevelRole } from "../src/modules/plans/plans.approvers.roles";

describe("approver role filters", () => {
  it("leaders — director/admin/managers", () => {
    expect(isApproverLeaderRole("director")).toBe(true);
    expect(isApproverLeaderRole("sales_director")).toBe(true);
    expect(isApproverLeaderRole("admin")).toBe(true);
    expect(isApproverLeaderRole("manager")).toBe(true);
    expect(isApproverLeaderRole("regional_manager")).toBe(true);
    expect(isApproverLeaderRole("agent")).toBe(false);
    expect(isApproverLeaderRole("operator")).toBe(false);
  });

  it("levels — web sales managers, not agents", () => {
    expect(isApproverLevelRole("manager")).toBe(true);
    expect(isApproverLevelRole("sales_director")).toBe(true);
    expect(isApproverLevelRole("operator")).toBe(true);
    expect(isApproverLevelRole("agent")).toBe(false);
    expect(isApproverLevelRole("supervisor")).toBe(false);
    expect(isApproverLevelRole("expeditor")).toBe(false);
  });
});
