import { describe, expect, it } from "vitest";
import type { StaffCrudSection } from "@/lib/use-staff-crud-permissions";

/** Pure mapping used by hook — keep in sync with use-staff-crud-permissions. */
function staffKeys(section: StaffCrudSection) {
  const base = `staff.${section}`;
  return {
    create: `${base}.create`,
    update: `${base}.update`,
    activate: `${base}.activate`,
    deactivate: `${base}.deactivate`,
    exportAny: [`${base}.history`, `${base}.copy`]
  };
}

describe("staff CRUD permission keys", () => {
  it("agent keys match Access structured model", () => {
    expect(staffKeys("agent")).toEqual({
      create: "staff.agent.create",
      update: "staff.agent.update",
      activate: "staff.agent.activate",
      deactivate: "staff.agent.deactivate",
      exportAny: ["staff.agent.history", "staff.agent.copy"]
    });
  });

  it("covers all KOMANDA sections", () => {
    const sections: StaffCrudSection[] = [
      "agent",
      "supervayzer",
      "ekspeditor",
      "inkassator",
      "auditor",
      "skladchik",
      "sotrudniki"
    ];
    for (const s of sections) {
      expect(staffKeys(s).create).toBe(`staff.${s}.create`);
    }
  });
});
