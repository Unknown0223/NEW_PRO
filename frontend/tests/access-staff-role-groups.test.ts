import { describe, expect, it } from "vitest";
import {
  sortStaffRoleKeys,
  staffRoleFilterOptions,
  staffRoleGroupLabel
} from "@/components/access/access-user-detail/access-user-detail.types";

describe("access staff role groups", () => {
  it("separates new roles into their own groups", () => {
    expect(staffRoleGroupLabel("collector")).toBe("Инкассаторы");
    expect(staffRoleGroupLabel("auditor")).toBe("Аудиторы");
    expect(staffRoleGroupLabel("skladchik")).toBe("Складчики");
    expect(staffRoleGroupLabel("operator")).toBe("Операторы");
    expect(staffRoleGroupLabel("warehouse_manager")).toBe("Заведующие складом");
  });

  it("orders field roles after supervisors and operators", () => {
    expect(sortStaffRoleKeys(["skladchik", "agent", "collector", "operator", "auditor"])).toEqual([
      "operator",
      "agent",
      "collector",
      "auditor",
      "skladchik"
    ]);
  });

  it("filter list includes the extra roles and starts with all", () => {
    const opts = staffRoleFilterOptions();
    expect(opts[0]).toEqual({ id: "", title: "Все роли" });
    const ids = opts.map((o) => o.id);
    for (const id of ["collector", "auditor", "skladchik", "cashier", "director"]) {
      expect(ids).toContain(id);
    }
    expect(new Set(ids).size).toBe(ids.length);
  });
});
