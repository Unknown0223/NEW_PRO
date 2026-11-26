import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const reportsRoot = join(__dirname, "../app/(dashboard)/reports");
const closeoutSlugs = [
  "balance-control",
  "cumulative-bonus",
  "discount-detail",
  "expeditor-share",
  "expeditor-visits",
  "rfm",
  "sales-compare",
  "universal-discounts",
  "universal-returns",
  "universal-visits",
  "visit-totals",
  "visits-2",
  "sku-3"
] as const;

describe("otchot FlatReport wave close-out", () => {
  it("close-out adapters have prefs/grid, no filter search, no Территория N", () => {
    for (const slug of closeoutSlugs) {
      const src = readFileSync(join(reportsRoot, slug, "page.tsx"), "utf8");
      expect(src, slug).toMatch(/FlatReportPage/);
      expect(src, slug).toMatch(/tablePrefsId:/);
      expect(src, slug).toMatch(/filterGridCols:\s*9/);
      expect(src, slug).not.toMatch(/kind:\s*"search"/);
      expect(src, slug).not.toMatch(/Территория [123]/);
    }
  });

  it("no FlatReport page left with Территория 1/2/3 placeholders", () => {
    const dirs = readdirSync(reportsRoot, { withFileTypes: true }).filter((d) => d.isDirectory());
    for (const d of dirs) {
      const fp = join(reportsRoot, d.name, "page.tsx");
      try {
        const src = readFileSync(fp, "utf8");
        if (!src.includes("FlatReportPage")) continue;
        expect(src, d.name).not.toMatch(/placeholder:\s*"Территория [123]"/);
      } catch {
        /* no page */
      }
    }
  });

  it("every FlatReport page uses filterGridCols 9 (bosganda bitta qator / kengayish)", () => {
    const dirs = readdirSync(reportsRoot, { withFileTypes: true }).filter((d) => d.isDirectory());
    for (const d of dirs) {
      const fp = join(reportsRoot, d.name, "page.tsx");
      try {
        const src = readFileSync(fp, "utf8");
        if (!src.includes("FlatReportPage")) continue;
        expect(src, d.name).toMatch(/filterGridCols:\s*9/);
      } catch {
        /* no page */
      }
    }
  });
});
