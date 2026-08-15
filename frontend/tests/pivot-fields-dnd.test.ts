import { describe, expect, it } from "vitest";
import {
  buildPivotPaletteCatalog,
  buildZoneChipOrder,
  isValuesAxisDragId,
  parseDateHierarchyField,
  parsePaletteId,
  parseSortableZoneId,
  parseValueSortableId,
  parseValuesAxisSortableId,
  resolveDropZone,
  resolveValuesAxisDragEnd,
  sortableZoneId,
  splitZoneChipOrder,
  valueSortableId,
  VALUES_AXIS_DRAG_ID,
  valuesAxisInsertSlotId,
  valuesAxisSortableId,
  zoneChipSortableIds,
  zoneDroppableId
} from "@/lib/pivot-fields-dnd";

describe("pivot-fields-dnd", () => {
  it("builds and parses palette / zone / chip ids", () => {
    expect(parsePaletteId("palette:agent_name")).toBe("agent_name");
    expect(parsePaletteId("sort:rows:agent")).toBeNull();
    expect(zoneDroppableId("reportFilters")).toBe("reportFilters-zone");
    expect(parseSortableZoneId(sortableZoneId("rows", "agent"))).toEqual({
      zone: "rows",
      fieldId: "agent"
    });
    expect(parseValueSortableId(valueSortableId("amount"))).toBe("amount");
  });

  it("resolves drop zone from zone droppable and nested chips", () => {
    expect(resolveDropZone("reportFilters-zone")).toBe("reportFilters");
    expect(resolveDropZone("columns-zone")).toBe("columns");
    expect(resolveDropZone("rows-zone")).toBe("rows");
    expect(resolveDropZone("values-zone")).toBe("values");

    expect(resolveDropZone(sortableZoneId("rows", "agent"))).toBe("rows");
    expect(resolveDropZone(sortableZoneId("columns", "region"))).toBe("columns");
    expect(resolveDropZone(sortableZoneId("reportFilters", "status"))).toBe("reportFilters");
    expect(resolveDropZone(valueSortableId("amount"))).toBe("values");

    expect(resolveDropZone("palette:agent")).toBeNull();
    expect(resolveDropZone("unknown")).toBeNull();
    expect(resolveDropZone(null)).toBeNull();
    expect(resolveDropZone("rows")).toBe("rows");
  });

  it("resolves Σ Values axis chip — stable drag id", () => {
    expect(valuesAxisSortableId("columns")).toBe(VALUES_AXIS_DRAG_ID);
    expect(valuesAxisSortableId("rows")).toBe(VALUES_AXIS_DRAG_ID);
    expect(isValuesAxisDragId(VALUES_AXIS_DRAG_ID)).toBe(true);
    expect(isValuesAxisDragId("valaxis:columns")).toBe(true);
    expect(isValuesAxisDragId("valaxis:rows")).toBe(true);
    expect(parseValuesAxisSortableId("valaxis:columns")).toBe("columns");
    expect(parseValuesAxisSortableId("valaxis:rows")).toBe("rows");
    expect(parseValuesAxisSortableId(VALUES_AXIS_DRAG_ID)).toBeNull();

    expect(resolveDropZone(valueSortableId("amount"))).toBe("values");
    expect(resolveDropZone(sortableZoneId("reportFilters", "status"))).toBe("reportFilters");
  });

  it("parses date hierarchy fields and pins date groups at catalog top", () => {
    expect(parseDateHierarchyField({ id: "order_date_year", label: "Дата заказа.Год" })).toEqual({
      groupKey: "order_date",
      groupLabel: "Дата заказа",
      part: "year",
      partLabel: "Год"
    });
    expect(parseDateHierarchyField({ id: "client_city", label: "Город" })).toBeNull();

    const catalog = buildPivotPaletteCatalog([
      { id: "client_city", label: "Город" },
      { id: "order_date_day", label: "Дата заказа.День" },
      { id: "order_date_year", label: "Дата заказа.Год" },
      { id: "order_date_month", label: "Дата заказа.Месяц" },
      { id: "agent_name", label: "Агент" }
    ]);

    expect(catalog[0]).toMatchObject({ kind: "date-group", key: "order_date", label: "Дата заказа" });
    if (catalog[0]?.kind === "date-group") {
      expect(catalog[0].children.map((c) => c.part)).toEqual(["year", "month", "day"]);
    }
    expect(catalog.slice(1).map((e) => (e.kind === "field" ? e.field.id : e.key))).toEqual([
      "client_city",
      "agent_name"
    ]);
  });

  it("buildZoneChipOrder places Σ Values at index and round-trips", () => {
    expect(buildZoneChipOrder(["a", "b"], false)).toEqual([
      { kind: "field", fieldId: "a" },
      { kind: "field", fieldId: "b" }
    ]);
    expect(buildZoneChipOrder(["a", "b"], true, 0)).toEqual([
      { kind: "valuesAxis" },
      { kind: "field", fieldId: "a" },
      { kind: "field", fieldId: "b" }
    ]);
    expect(buildZoneChipOrder(["a", "b"], true, 1)).toEqual([
      { kind: "field", fieldId: "a" },
      { kind: "valuesAxis" },
      { kind: "field", fieldId: "b" }
    ]);
    expect(splitZoneChipOrder(buildZoneChipOrder(["a", "b"], true, 1))).toEqual({
      fieldIds: ["a", "b"],
      valuesAxisIndex: 1
    });
    expect(zoneChipSortableIds("columns", buildZoneChipOrder(["a"], true, 1))).toEqual([
      sortableZoneId("columns", "a")
    ]);
  });

  it("resolveValuesAxisDragEnd — columns → empty rows zone", () => {
    const layout = resolveValuesAxisDragEnd({
      fromZone: "columns",
      overId: zoneDroppableId("rows"),
      rows: [],
      columns: ["client", "client_category"],
      valuesAxisIndex: 2
    });
    expect(layout).toEqual({
      kind: "layout",
      position: "rows",
      valuesAxisIndex: 0
    });
  });

  it("resolveValuesAxisDragEnd — columns → rows shows chip in rows zone", () => {
    const layout = resolveValuesAxisDragEnd({
      fromZone: "columns",
      overId: sortableZoneId("rows", "agent"),
      rows: ["agent"],
      columns: ["client_category"],
      valuesAxisIndex: 1
    });
    expect(layout).toEqual({
      kind: "layout",
      position: "rows",
      valuesAxisIndex: 0
    });
  });

  it("resolveValuesAxisDragEnd — reorder Σ Values within columns at drop index", () => {
    const layout = resolveValuesAxisDragEnd({
      fromZone: "columns",
      overId: sortableZoneId("columns", "client_category"),
      rows: ["agent"],
      columns: ["client", "client_category"],
      valuesAxisIndex: 2
    });
    expect(layout).toEqual({
      kind: "layout",
      position: "columns",
      valuesAxisIndex: 1
    });
  });

  it("resolveValuesAxisDragEnd — drag down past a field places after it", () => {
    const layout = resolveValuesAxisDragEnd({
      fromZone: "columns",
      overId: sortableZoneId("columns", "client"),
      rows: [],
      columns: ["client", "client_category"],
      valuesAxisIndex: 0
    });
    expect(layout).toEqual({
      kind: "layout",
      position: "columns",
      valuesAxisIndex: 1
    });
  });

  it("resolveValuesAxisDragEnd — drop on first column field from end places chip at start", () => {
    const layout = resolveValuesAxisDragEnd({
      fromZone: "columns",
      overId: sortableZoneId("columns", "client"),
      rows: [],
      columns: ["client", "client_category"],
      valuesAxisIndex: 2
    });
    expect(layout).toEqual({
      kind: "layout",
      position: "columns",
      valuesAxisIndex: 0
    });
  });

  it("resolveValuesAxisDragEnd — insert slot places at exact index", () => {
    const layout = resolveValuesAxisDragEnd({
      fromZone: "columns",
      overId: valuesAxisInsertSlotId("columns", 2),
      rows: [],
      columns: ["a", "b", "c", "d"],
      valuesAxisIndex: 0
    });
    expect(layout).toEqual({
      kind: "layout",
      position: "columns",
      valuesAxisIndex: 2
    });
  });

  it("resolveValuesAxisDragEnd — insert slot moves to empty rows", () => {
    const layout = resolveValuesAxisDragEnd({
      fromZone: "columns",
      overId: valuesAxisInsertSlotId("rows", 0),
      rows: [],
      columns: ["client", "client_category"],
      valuesAxisIndex: 0
    });
    expect(layout).toEqual({
      kind: "layout",
      position: "rows",
      valuesAxisIndex: 0
    });
  });

  it("resolveValuesAxisDragEnd — second move rows → columns still works", () => {
    const layout = resolveValuesAxisDragEnd({
      fromZone: "rows",
      overId: zoneDroppableId("columns"),
      rows: ["client"],
      columns: ["agent"],
      valuesAxisIndex: 0
    });
    expect(layout).toEqual({
      kind: "layout",
      position: "columns",
      valuesAxisIndex: 1
    });
  });
});
