import { describe, expect, it } from "vitest";
import { resolveChartExportFilename } from "../src/chart/chartExport.js";

describe("chartExport", () => {
  it("resolveChartExportFilename — .png qo'shadi", () => {
    expect(resolveChartExportFilename()).toBe("pivot-chart.png");
    expect(resolveChartExportFilename("report")).toBe("report.png");
    expect(resolveChartExportFilename("report.PNG")).toBe("report.PNG");
  });
});
