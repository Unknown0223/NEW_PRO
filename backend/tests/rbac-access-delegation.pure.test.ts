import { describe, expect, it } from "vitest";
import {
  ACCESS_MANAGE_PERMISSION_KEY,
  ACCESS_MODULE_VIEW_KEY,
  effectiveCanGrantAccessToOthers,
  effectiveHasAccessModuleView
} from "../src/modules/access/rbac.access-manage";

describe("access delegation flags", () => {
  it("module view alone — cannot grant to others", () => {
    const keys = new Set([ACCESS_MODULE_VIEW_KEY]);
    expect(effectiveHasAccessModuleView(keys)).toBe(true);
    expect(effectiveCanGrantAccessToOthers(keys)).toBe(false);
  });

  it("access.manage without module view — cannot grant to others", () => {
    const keys = new Set([ACCESS_MANAGE_PERMISSION_KEY]);
    expect(effectiveHasAccessModuleView(keys)).toBe(false);
    expect(effectiveCanGrantAccessToOthers(keys)).toBe(false);
  });

  it("both keys — can grant to others", () => {
    const keys = new Set([ACCESS_MANAGE_PERMISSION_KEY, ACCESS_MODULE_VIEW_KEY]);
    expect(effectiveCanGrantAccessToOthers(keys)).toBe(true);
  });

  it("withAutoAccessModuleViewForManage adds view when manage present", async () => {
    const { withAutoAccessModuleViewForManage } = await import("../src/modules/access/rbac.access-manage");
    const out = withAutoAccessModuleViewForManage(["access.manage", "orders.view"]);
    expect(out).toContain(ACCESS_MODULE_VIEW_KEY);
    expect(out).toContain("access.manage");
    expect(out.filter((k) => k === ACCESS_MODULE_VIEW_KEY)).toHaveLength(1);
  });
});
