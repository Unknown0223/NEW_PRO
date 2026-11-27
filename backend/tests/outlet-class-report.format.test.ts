import { describe, expect, it } from "vitest";
import {
  formatCategorySharePct,
  formatOutletClientCode,
  formatOutletTerritory,
  orderCategoryColumns,
  sharesToPctRecord
} from "../src/modules/reports/outlet-class-report.format";

describe("outlet-class-report.format", () => {
  it("formats territory and client code", () => {
    expect(formatOutletTerritory("Z", "R", "C")).toBe("Z, R, C");
    expect(formatOutletClientCode("301", 12)).toBe("301");
    expect(formatOutletClientCode("", 12)).toBe("12");
  });

  it("formats category share percents and column order", () => {
    expect(formatCategorySharePct(25, 100)).toBe("25.0");
    expect(sharesToPctRecord({ A: 50, B: 50 }, 100)).toEqual({ A: "50.0", B: "50.0" });
    expect(orderCategoryColumns({ B: 10, A: 90 })).toEqual(["A", "B"]);
  });
});
