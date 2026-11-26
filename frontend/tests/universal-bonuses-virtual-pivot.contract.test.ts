import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const frontendRoot = join(__dirname, "..");

describe("universal-bonuses Virtual Pivot contract", () => {
  it("page uses UniversalBonusesVirtualPivotWorkspace not FlatReportPage", () => {
    const page = readFileSync(
      join(frontendRoot, "app/(dashboard)/reports/universal-bonuses/page.tsx"),
      "utf8"
    );
    expect(page).toMatch(/UniversalBonusesVirtualPivotWorkspace/);
    expect(page).not.toMatch(/FlatReportPage/);
  });

  it("flat builder lists design columns", async () => {
    const {
      buildUniversalBonusesFlatPivotConfig,
      UNIVERSAL_BONUSES_DEFAULT_FLAT_FIELD_IDS
    } = await import(
      "../components/reports/universal-bonuses/universal-bonuses-pivot-fields"
    );
    const cfg = buildUniversalBonusesFlatPivotConfig();
    expect(cfg.options.layoutForm).toBe("flat");
    expect(cfg.rows).toEqual([...UNIVERSAL_BONUSES_DEFAULT_FLAT_FIELD_IDS]);
  });

  it("filter config has no group_by or search field", () => {
    const src = readFileSync(
      join(
        frontendRoot,
        "components/reports/universal-bonuses/universal-bonuses-filter-config.ts"
      ),
      "utf8"
    );
    expect(src).not.toMatch(/paramKey:\s*["']group_by["']/);
    expect(src).not.toMatch(/kind:\s*["']search["']/);
    expect(src).toMatch(/apiPath:\s*["']universal-bonuses["']/);
    expect(src).toMatch(/dateTypeAsRadio:\s*true/);
    expect(src).toMatch(/filterGridCols:\s*9/);
    expect(src).toMatch(/placeholder:\s*"Зона"/);
    expect(src).toMatch(/placeholder:\s*"Область"/);
    expect(src).toMatch(/placeholder:\s*"Город"/);
    expect(src).not.toMatch(/Территория [123]/);
  });

  it("classic apply keeps SUM qty when compact", async () => {
    const { applyUniversalBonusesLayoutOptions } = await import(
      "../components/reports/universal-bonuses/universal-bonuses-pivot-fields"
    );
    const cfg = applyUniversalBonusesLayoutOptions(undefined, {
      layoutForm: "compact",
      grandTotals: "both",
      subtotals: "both"
    });
    expect(cfg.options.layoutForm).toBe("compact");
    expect(cfg.options.compactMode).toBe(true);
    expect(cfg.values[0]?.fieldId).toBe("qty");
    expect(cfg.values[0]?.aggregation).toBe("SUM");
  });

  it("workspace uses dataset + toolbar + layout apply + saved dataset id", () => {
    const ws = readFileSync(
      join(
        frontendRoot,
        "components/reports/universal-bonuses/universal-bonuses-virtual-pivot-workspace.tsx"
      ),
      "utf8"
    );
    const hook = readFileSync(
      join(
        frontendRoot,
        "components/reports/universal-bonuses/use-universal-bonuses-pivot.ts"
      ),
      "utf8"
    );
    const saved = readFileSync(
      join(
        frontendRoot,
        "components/reports/universal-bonuses/universal-bonuses-pivot-saved-chrome.tsx"
      ),
      "utf8"
    );
    const bridge = readFileSync(join(frontendRoot, "lib/pivot-bridge.ts"), "utf8");
    expect(hook).toMatch(/\/reports\/universal-bonuses\/dataset/);
    expect(ws).toMatch(/usePivot|useUniversalBonusesPivot/);
    expect(ws).toMatch(/UniversalBonusesPivotToolbar/);
    expect(ws).toMatch(/applyUniversalBonusesLayoutOptions/);
    expect(bridge).toMatch(/UNIVERSAL_BONUSES_PIVOT_DATASET_ID\s*=\s*["']universal_bonuses["']/);
    expect(saved).toMatch(/UNIVERSAL_BONUSES_PIVOT_DATASET_ID/);
  });

  it("workspace shows truncated banner when dataset truncated", () => {
    const ws = readFileSync(
      join(
        frontendRoot,
        "components/reports/universal-bonuses/universal-bonuses-virtual-pivot-workspace.tsx"
      ),
      "utf8"
    );
    expect(ws).toMatch(/datasetQ\.data\?\.truncated/);
    expect(ws).toMatch(/border-amber/);
    expect(ws).toMatch(/показаны|обрезан|из|truncated/i);
  });
});
