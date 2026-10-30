import { describe, expect, it } from "vitest";
import {
  bulkDestructiveActionsForSlotType,
  bulkFieldAllowsClear,
  bulkFieldsForSlotType,
  buildBulkRequestBody,
  countBulkFormChanges,
  EMPTY_BULK_FORM_MODES,
  slotLocationBindingFields
} from "@/components/work-slots/work-slots-bulk-actions";
import { EMPTY_LOCATION_BULK_MODES, emptyLocationValues } from "@/components/work-slots/work-slots-location-fields";
import { bulkFloatingConfigActions } from "@/components/work-slots/work-slots-utils";
import type { WorkSlotType } from "@/lib/work-slots-types";

const ALL: WorkSlotType[] = [
  "agent",
  "collector",
  "expeditor",
  "skladchik",
  "supervisor",
  "auditor",
  "operator",
  "director",
  "sales_director",
  "manager",
  "regional_manager",
  "accountant",
  "warehouse_manager"
];

describe("work-slots bulk role matrix", () => {
  it("every role gets base fields including session limit", () => {
    for (const t of ALL) {
      const f = bulkFieldsForSlotType(t);
      expect(f).toEqual(expect.arrayContaining(["is_active", "branch_code", "label", "max_sessions"]));
    }
  });

  it("supervisor and auditor get territory + direction", () => {
    expect(bulkFieldsForSlotType("supervisor")).toEqual(
      expect.arrayContaining(["direction_id", "territory", "warehouse_id"])
    );
    expect(bulkFieldsForSlotType("auditor")).toEqual(
      expect.arrayContaining(["direction_id", "territory", "warehouse_id", "cash_desk_id"])
    );
  });

  it("collector gets territory + cash, not warehouse", () => {
    const f = bulkFieldsForSlotType("collector");
    expect(f).toContain("territory");
    expect(f).toContain("cash_desk_id");
    expect(f).not.toContain("warehouse_id");
  });

  it("director and sales_director get full workplace bindings", () => {
    expect(bulkFieldsForSlotType("director")).toEqual(
      expect.arrayContaining([
        "direction_id",
        "territory",
        "warehouse_id",
        "return_warehouse_id",
        "cash_desk_id"
      ])
    );
    expect(bulkFieldsForSlotType("sales_director")).toEqual(
      expect.arrayContaining(["direction_id", "territory", "warehouse_id"])
    );
    expect(bulkFieldsForSlotType("sales_director")).not.toContain("cash_desk_id");
  });

  it("operator gets territory + warehouse + cash", () => {
    expect(bulkFieldsForSlotType("operator")).toEqual(
      expect.arrayContaining(["direction_id", "territory", "warehouse_id", "cash_desk_id"])
    );
  });

  it("accountant gets cash territory without warehouse", () => {
    const f = bulkFieldsForSlotType("accountant");
    expect(f).toContain("territory");
    expect(f).toContain("cash_desk_id");
    expect(f).not.toContain("warehouse_id");
  });

  it("warehouse_manager gets warehouses without cash", () => {
    const f = bulkFieldsForSlotType("warehouse_manager");
    expect(f).toEqual(
      expect.arrayContaining(["direction_id", "territory", "warehouse_id", "return_warehouse_id"])
    );
    expect(f).not.toContain("cash_desk_id");
  });

  it("slotLocationBindingFields mirrors bulk warehouse/cash keys", () => {
    expect(slotLocationBindingFields("director")).toEqual([
      "warehouse",
      "return_warehouse",
      "cash_desk"
    ]);
    expect(slotLocationBindingFields("accountant")).toEqual(["cash_desk"]);
    expect(slotLocationBindingFields("skladchik")).toEqual(["warehouse", "return_warehouse"]);
  });

  it("clear is disabled for status and slot_type", () => {
    expect(bulkFieldAllowsClear("is_active")).toBe(false);
    expect(bulkFieldAllowsClear("slot_type")).toBe(false);
    expect(bulkFieldAllowsClear("branch_code")).toBe(true);
    expect(bulkFieldAllowsClear("max_sessions")).toBe(false);
  });

  it("counts max_sessions when set", () => {
    const modes = EMPTY_BULK_FORM_MODES();
    modes.maxSessions = "set";
    expect(countBulkFormChanges(["max_sessions"], modes, EMPTY_LOCATION_BULK_MODES())).toBe(1);
  });

  it("buildBulkRequestBody sends max_sessions and revoke_sessions", () => {
    const modes = EMPTY_BULK_FORM_MODES();
    modes.maxSessions = "set";
    const values = {
      isActive: true,
      branchCodeList: [],
      directionId: "",
      label: "",
      slotType: "agent" as const,
      maxSessions: 3
    };
    expect(
      buildBulkRequestBody(
        [1, 2],
        ["max_sessions"],
        modes,
        values,
        emptyLocationValues(),
        EMPTY_LOCATION_BULK_MODES(),
        null
      )
    ).toEqual({ slot_ids: [1, 2], max_sessions: 3 });
    expect(
      buildBulkRequestBody(
        [1],
        ["max_sessions"],
        modes,
        { ...values, maxSessions: 0 },
        emptyLocationValues(),
        EMPTY_LOCATION_BULK_MODES(),
        null
      )
    ).toEqual({ slot_ids: [1], max_sessions: 0 });
    expect(
      buildBulkRequestBody(
        [5],
        [],
        EMPTY_BULK_FORM_MODES(),
        values,
        emptyLocationValues(),
        EMPTY_LOCATION_BULK_MODES(),
        "revoke_sessions"
      )
    ).toEqual({ slot_ids: [5], revoke_sessions: true });
    expect(bulkDestructiveActionsForSlotType("agent")).toContain("revoke_sessions");
  });

  it("count ignores clear on is_active", () => {
    const modes = EMPTY_BULK_FORM_MODES();
    modes.isActive = "clear";
    expect(
      countBulkFormChanges(["is_active"], modes, EMPTY_LOCATION_BULK_MODES())
    ).toBe(0);
  });

  it("floating config actions match role tabs", () => {
    expect(bulkFloatingConfigActions("agent")).toEqual(["main", "prices", "limits", "mobile"]);
    expect(bulkFloatingConfigActions("expeditor")).toEqual(["main", "expeditor", "mobile"]);
    expect(bulkFloatingConfigActions("skladchik")).toEqual(["main", "skladchik"]);
    expect(bulkFloatingConfigActions("supervisor")).toEqual(["main", "team", "mobile"]);
    expect(bulkFloatingConfigActions("auditor")).toEqual(["main", "mobile"]);
    expect(bulkFloatingConfigActions("collector")).toEqual(["main"]);
    expect(bulkFloatingConfigActions("director")).toEqual(["main"]);
    expect(bulkFloatingConfigActions("operator")).toEqual(["main"]);
    expect(bulkFloatingConfigActions("sales_director")).toEqual(["main"]);
  });
});
