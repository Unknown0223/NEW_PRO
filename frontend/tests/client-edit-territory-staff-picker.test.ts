import { describe, expect, it } from "vitest";
import { filterStaffByTerritoryPickerContext } from "@/lib/client-edit-territory-staff-picker";

describe("filterStaffByTerritoryPickerContext", () => {
  const all = [{ id: 1 }, { id: 2 }, { id: 3 }];

  it("returns all when no context or territory not matched", () => {
    expect(filterStaffByTerritoryPickerContext(all, null, [])).toEqual(all);
    expect(
      filterStaffByTerritoryPickerContext(all, { territory_matched: false, staff_ids: [1] }, [])
    ).toEqual(all);
  });

  it("returns empty when territory matched but no linked staff", () => {
    expect(
      filterStaffByTerritoryPickerContext(all, { territory_matched: true, staff_ids: [] }, [])
    ).toEqual([]);
  });

  it("filters to territory staff and keeps current slot ids", () => {
    expect(
      filterStaffByTerritoryPickerContext(all, { territory_matched: true, staff_ids: [2] }, [3])
    ).toEqual([{ id: 2 }, { id: 3 }]);
  });

  it("does not fall back to all when intersection empty", () => {
    expect(
      filterStaffByTerritoryPickerContext(all, { territory_matched: true, staff_ids: [99] }, [])
    ).toEqual([]);
  });

  it("keeps current selection even if not in territory staff", () => {
    expect(
      filterStaffByTerritoryPickerContext(all, { territory_matched: true, staff_ids: [99] }, [1])
    ).toEqual([{ id: 1 }]);
  });
});
