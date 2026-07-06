import { describe, expect, it } from "vitest";

describe("access-workspace split", () => {
  it("exports main workspace component", async () => {
    const mod = await import("../components/access/access-workspace");
    expect(typeof mod.AccessWorkspace).toBe("function");
  });

  it("exports hook and panels", async () => {
    const hook = await import("../components/access/use-access-workspace");
    expect(typeof hook.useAccessWorkspace).toBe("function");

    const left = await import("../components/access/access-workspace-left-panel");
    expect(typeof left.AccessWorkspaceLeftPanel).toBe("function");

    const ops = await import("../components/access/access-workspace-operations-panel");
    expect(typeof ops.AccessWorkspaceOperationsPanel).toBe("function");

    const scope = await import("../components/access/access-workspace-scope-panel");
    expect(typeof scope.AccessWorkspaceScopePanel).toBe("function");

    const modal = await import("../components/access/access-workspace-user-picker-modal");
    expect(typeof modal.AccessWorkspaceUserPickerModal).toBe("function");
  });

  it("exports shared helpers", async () => {
    const shared = await import("../components/access/access-workspace.shared");
    expect(typeof shared.formatAccessFilterTriggerSummary).toBe("function");
    expect(shared.ACCESS_MANAGE_KEY).toBeTruthy();
  });

  it("filterAccessWebPanelUsers excludes mobile-only KOMANDA", async () => {
    const { filterAccessWebPanelUsers } = await import("../lib/access-web-users");
    const rows = [
      { id: 1, role: "admin" },
      { id: 2, role: "agent" },
      { id: 3, role: "supervisor" },
      { id: 4, role: "auditor" }
    ];
    const filtered = filterAccessWebPanelUsers(rows);
    expect(filtered.map((r) => r.role)).toEqual(["admin", "supervisor"]);
  });

  it("granted matrix shows only effective permissions", async () => {
    const { isGrantedMatrixRow, permissionSourceLabel, matchesPermissionSourceFilter } = await import(
      "../lib/access-user-permission-matrix"
    );
    const roleRow = { effective: true, from_role: true, user_effect: "none" as const };
    const extraRow = { effective: true, from_role: false, user_effect: "allow" as const };
    const deniedRow = { effective: false, from_role: true, user_effect: "none" as const };
    expect(isGrantedMatrixRow(roleRow)).toBe(true);
    expect(isGrantedMatrixRow(deniedRow)).toBe(false);
    expect(permissionSourceLabel(roleRow)).toBe("Роль");
    expect(permissionSourceLabel(extraRow)).toBe("Дополнительно");
    expect(matchesPermissionSourceFilter(roleRow, "role")).toBe(true);
    expect(matchesPermissionSourceFilter(extraRow, "role")).toBe(false);
    expect(matchesPermissionSourceFilter(extraRow, "extra")).toBe(true);
  });
});
