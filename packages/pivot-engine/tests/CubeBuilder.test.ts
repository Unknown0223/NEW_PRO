import { describe, expect, it } from "vitest";
import { CubeBuilder, ROOT_COL_KEY } from "../src/core/CubeBuilder.js";
import { DEFAULT_PIVOT_CONFIG } from "../src/core/PivotEngine.js";
import type { PivotConfig } from "../src/types/pivot.types.js";
import { ALL_GROUP_KEY } from "../src/utils/groupBy.js";

const ROWS = [
  { region: "Toshkent", product: "A", month: "Yan", amount: 100, qty: 1 },
  { region: "Toshkent", product: "B", month: "Yan", amount: 200, qty: 2 },
  { region: "Samarqand", product: "A", month: "Fev", amount: 300, qty: 3 }
];

describe("CubeBuilder", () => {
  it("row×col×measure indeksini quradi", () => {
    const cube = new CubeBuilder();
    const config: PivotConfig = {
      ...DEFAULT_PIVOT_CONFIG,
      rows: ["region"],
      columns: ["month"],
      values: [{ fieldId: "amount", aggregation: "SUM" }]
    };
    cube.build(ROWS, config);

    expect(cube.getValues("Toshkent", "Yan", "amount")).toEqual([100, 200]);
    expect(cube.getValues("Samarqand", "Fev", "amount")).toEqual([300]);
  });

  it("grand total uchun ALL_GROUP_KEY", () => {
    const cube = new CubeBuilder();
    const config: PivotConfig = {
      ...DEFAULT_PIVOT_CONFIG,
      rows: ["region"],
      values: [{ fieldId: "amount", aggregation: "SUM" }]
    };
    cube.build(ROWS, config);

    expect(cube.getValues(ALL_GROUP_KEY, ROOT_COL_KEY, "amount")).toEqual([100, 200, 300]);
  });

  it("ichki ierarxiya kalitlari", () => {
    const cube = new CubeBuilder();
    const config: PivotConfig = {
      ...DEFAULT_PIVOT_CONFIG,
      rows: ["region", "product"],
      values: [{ fieldId: "qty", aggregation: "SUM" }]
    };
    cube.build(ROWS, config);

    expect(cube.getValues("Toshkent | A", ROOT_COL_KEY, "qty")).toEqual([1]);
    expect(cube.getValues("Toshkent", ROOT_COL_KEY, "qty")).toEqual([1, 2]);
  });
});
