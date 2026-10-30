import { describe, expect, it } from "vitest";
import { normKeyTerritoryMatch } from "../shared/territory-lalaku-seed";
import {
  resolveTerritoryLabel,
  rollupDebtTerritoryRows,
  rollupSalesTerritoryRows
} from "../src/modules/dashboard/dashboard.territory-rollup";

const index = {
  regionCanon: new Map([[normKeyTerritoryMatch("BUXORO VILOYATI"), "BUXORO VILOYATI"]]),
  parentOf: new Map([[normKeyTerritoryMatch("GUDUVON"), "BUXORO VILOYATI"]])
};

describe("territory rollup", () => {
  it("shahar qatorini viloyatga qo‘shadi", () => {
    expect(resolveTerritoryLabel("GUDUVON", index)).toBe("BUXORO VILOYATI");
    expect(resolveTerritoryLabel("BUXORO VILOYATI", index)).toBe("BUXORO VILOYATI");
    expect(resolveTerritoryLabel("NAMANGAN", index)).toBe("NAMANGAN");
    expect(resolveTerritoryLabel("—", index)).toBe("—");

    const sales = rollupSalesTerritoryRows(
      [
        { territory: "GUDUVON", sales_sum: "100.5", akb: 2, okb: 4, coverage_pct: 50 },
        { territory: "BUXORO VILOYATI", sales_sum: "10", akb: 1, okb: 1, coverage_pct: 100 },
        { territory: "XORAZM VILOYATI", sales_sum: "3", akb: 1, okb: 2, coverage_pct: 50 }
      ],
      index
    );
    expect(sales.map((row) => row.territory)).toEqual(["BUXORO VILOYATI", "XORAZM VILOYATI"]);
    expect(sales[0]).toMatchObject({ sales_sum: "110.5", akb: 3, okb: 5 });

    const debts = rollupDebtTerritoryRows(
      [
        { territory: "GUDUVON", debt_sum: "5", debtors_count: 1 },
        { territory: "BUXORO VILOYATI", debt_sum: "7", debtors_count: 2 }
      ],
      index
    );
    expect(debts).toEqual([{ territory: "BUXORO VILOYATI", debt_sum: "12", debtors_count: 3 }]);
  });
});
