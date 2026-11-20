import { describe, expect, it } from "vitest";
import { dashboardClientsNav } from "@/components/dashboard/nav-config";
import { NAV_PERM } from "@/components/dashboard/nav-permission-keys";

describe("clients nav — Отчёт по таре", () => {
  it("points at the deferred tare soon page (not a dead placeholder)", () => {
    const item = dashboardClientsNav.items.find((i) => i.label === "Отчёт по таре");
    expect(item).toBeDefined();
    expect(item!.href).toBe("/reports/soon/tare");
    expect(item!.placeholder).toBeUndefined();
    expect(item!.showIfAnyPermission).toEqual([...NAV_PERM.reports]);
  });
});
