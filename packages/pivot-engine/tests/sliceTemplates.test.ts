import { describe, expect, it } from "vitest";
import { applyPivotSliceTemplate, getPivotSliceTemplates } from "../src/utils/sliceTemplates.js";
import type { PivotField } from "../src/types/pivot.types.js";

const FIELDS: PivotField[] = [
  { id: "supervisor_code", label: "Supervisor", dataType: "string" },
  { id: "agent_name", label: "Agent", dataType: "string" },
  { id: "order_status", label: "Status", dataType: "string" },
  { id: "amount", label: "Summa", dataType: "currency" },
  { id: "client_id", label: "AKB", dataType: "number" },
  { id: "volume", label: "Hajm", dataType: "number" }
];

describe("sliceTemplates", () => {
  it("getPivotSliceTemplates — agent_kpi va retrobonus", () => {
    const templates = getPivotSliceTemplates();
    expect(templates.map((t) => t.id)).toEqual(["agent_kpi", "retrobonus_volume"]);
  });

  it("applyPivotSliceTemplate — agent KPI", () => {
    const config = applyPivotSliceTemplate("agent_kpi", FIELDS);
    expect(config?.rows).toEqual(["supervisor_code", "agent_name"]);
    expect(config?.values).toHaveLength(2);
    expect(config?.reportFilters).toEqual(["order_status"]);
  });

  it("applyPivotSliceTemplate — noma'lum id", () => {
    expect(applyPivotSliceTemplate("missing", FIELDS)).toBeNull();
  });

  it("applyPivotSliceTemplate — qiymat maydonlari yo'q bo'lsa null", () => {
    expect(
      applyPivotSliceTemplate("agent_kpi", [{ id: "warehouse_name", label: "Ombor", dataType: "string" }])
    ).toBeNull();
  });
});
