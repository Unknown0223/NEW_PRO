import { describe, expect, it } from "vitest";
import { buildListWhere } from "../src/modules/work-slots/work-slots.query.filters";
import { mapSlotRow } from "../src/modules/work-slots/work-slots.query.helpers";

describe("work-slots multi-bindings filters/map", () => {
  it("buildListWhere matches warehouse_ids hasSome", () => {
    const where = buildListWhere(1, { warehouse_ids: [10, 20] });
    expect(where.AND).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          OR: expect.arrayContaining([
            { warehouse_ids: { hasSome: [10, 20] } },
            { warehouse_id: { in: [10, 20] } }
          ])
        })
      ])
    );
  });

  it("buildListWhere matches branch_codes hasSome", () => {
    const where = buildListWhere(1, { branch_codes: ["Farg'ona", "Andijon"] });
    expect(where.AND).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          OR: expect.arrayContaining([
            { branch_code: { in: ["Farg'ona", "Andijon"] } },
            { branch_codes: { hasSome: ["Farg'ona", "Andijon"] } }
          ])
        })
      ])
    );
  });

  it("buildListWhere matches cash_desk_ids and territories has", () => {
    const where = buildListWhere(1, {
      cash_desk_ids: [5],
      territory_zones: ["FV"]
    });
    const and = where.AND as unknown[];
    expect(and).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          OR: expect.arrayContaining([{ cash_desk_ids: { hasSome: [5] } }])
        }),
        expect.objectContaining({
          OR: expect.arrayContaining([{ territories: { has: "FV" } }])
        })
      ])
    );
  });

  it("mapSlotRow exposes multi arrays from slot columns", () => {
    const row = mapSlotRow(
      {
        id: 1,
        slot_code: "A1",
        label: null,
        branch_code: "Farg'ona",
        branch_codes: ["Farg'ona", "Andijon"],
        direction_id: null,
        slot_type: "agent",
        is_active: true,
        sort_order: 0,
        created_at: new Date("2026-01-01"),
        updated_at: new Date("2026-01-01"),
        territory: "FV / ANDIJON / ASAKA",
        territories: ["FV / ANDIJON / ASAKA", "FV / ANDIJON / BALIQCHI"],
        warehouse_id: 1,
        warehouse_ids: [1, 2],
        return_warehouse_id: null,
        cash_desk_id: 7,
        cash_desk_ids: [7, 8],
        price_type: null,
        price_types: [],
        entitlements: {},
        consignment: false,
        consignment_limit_amount: null,
        consignment_ignore_previous_months_debt: false,
        consignment_close_day: 1,
        consignment_close_hour: 0,
        consignment_close_minute: 0,
        warehouse_staff_entitlements: {},
        expeditor_assignment_rules: {},
        supervisee_agent_slot_ids: [],
        warehouse: { id: 1, name: "W1" },
        return_warehouse: null,
        cash_desk: { id: 7, name: "C7" },
        direction: null,
        user_links: []
      },
      {
        warehouseNames: new Map([
          [1, "W1"],
          [2, "W2"]
        ]),
        cashDeskNames: new Map([
          [7, "C7"],
          [8, "C8"]
        ])
      }
    );
    expect(row.active_warehouse_ids).toEqual([1, 2]);
    expect(row.active_cash_desk_ids).toEqual([7, 8]);
    expect(row.active_territories).toEqual([
      "FV / ANDIJON / ASAKA",
      "FV / ANDIJON / BALIQCHI"
    ]);
    expect(row.active_warehouse_name).toContain("W2");
    expect(row.active_cash_desk_names).toContain("C8");
    expect(row.branch_codes).toEqual(["Farg'ona", "Andijon"]);
    expect(row.branch_code).toBe("Farg'ona");
  });
});
