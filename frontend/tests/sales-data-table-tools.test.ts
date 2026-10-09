import { describe, expect, it } from "vitest";
import {
  compareCellValues,
  matchesColumnFilter,
  rawColumnValue
} from "@/components/dashboard/sales/sales-data-table-tools";

type Row = { category: string; sales_sum: string; akb: number; territory: string };
const row: Row = { category: "JENSKIY", sales_sum: "69654300.00", akb: 165, territory: "t-1" };

describe("sales-data-table-tools", () => {
  it("rawColumnValue: raqamli satr son bo‘ladi, searchText ustun", () => {
    expect(rawColumnValue(row, { id: "sales_sum", header: "" })).toBe(69654300);
    expect(rawColumnValue(row, { id: "akb", header: "" })).toBe(165);
    expect(rawColumnValue(row, { id: "territory", header: "", searchText: () => "Toshkent" })).toBe("Toshkent");
  });

  it("compareCellValues: son, matn va null oxirida", () => {
    expect(compareCellValues(2, 10)).toBeLessThan(0);
    expect(compareCellValues("Б", "А")).toBeGreaterThan(0);
    expect(compareCellValues(null, 1)).toBeGreaterThan(0);
  });

  it("matchesColumnFilter: taqqoslash, oraliq va matn", () => {
    expect(matchesColumnFilter(165, ">100")).toBe(true);
    expect(matchesColumnFilter(165, "<= 100")).toBe(false);
    expect(matchesColumnFilter(0, "=0")).toBe(true);
    expect(matchesColumnFilter(165, "100-200")).toBe(true);
    expect(matchesColumnFilter(165, "200-100")).toBe(true);
    expect(matchesColumnFilter(250, "100-200")).toBe(false);
    expect(matchesColumnFilter(1655, "65")).toBe(true);
    expect(matchesColumnFilter("JENSKIY", "jen")).toBe(true);
    expect(matchesColumnFilter("JENSKIY", "trus")).toBe(false);
    expect(matchesColumnFilter("JENSKIY", "  ")).toBe(true);
  });
});
