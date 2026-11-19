import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG, cloneConfig } from "@salec/plans-proposal";
import type { ConfigMap } from "../../src/lib/selection";
import {
  withAllConfigs,
  withCellFormula,
  withConfig,
  withExcluded,
  withManual
} from "../../src/lib/config-ops";

function setup(): ConfigMap {
  return { "1": cloneConfig(DEFAULT_CONFIG), "2": cloneConfig(DEFAULT_CONFIG) };
}

describe("konfiguratsiya operatsiyalari", () => {
  it("asl configmap ni o‘zgartirmaydi", () => {
    const configs = setup();
    const next = withConfig(configs, 1, (d) => {
      d.defaultFormula.value = 25;
    });
    expect(configs["1"]!.defaultFormula.value).toBe(10);
    expect(next["1"]!.defaultFormula.value).toBe(25);
    expect(next["2"]).toBe(configs["2"]);
  });

  it("katak formulasi va qo‘lda qiymatni yozadi/o‘chiradi", () => {
    const base = setup();
    const formula = { basis: "fact" as const, mode: "percent" as const, value: 7 };
    const withFormula = withCellFormula(base, 1, "1:1001", formula);
    expect(withFormula["1"]!.cellFormulas?.["1:1001"]).toEqual(formula);
    expect(withCellFormula(withFormula, 1, "1:1001", null)["1"]!.cellFormulas).toEqual({});
    const manual = { value: "500000000", reason: "Hudud rejasi" };
    const withManualValue = withManual(withFormula, 1, "1:1001", manual);
    expect(withManualValue["1"]!.overrides["1:1001"]).toEqual(manual);
    expect(withManual(withManualValue, 1, "1:1001", null)["1"]!.overrides).toEqual({});
  });

  it("hisobdan chiqarishni almashtiradi va manual bilan tozalanadi", () => {
    const excluded = withExcluded(setup(), 2, "2:1002");
    expect(excluded["2"]!.excluded).toContain("2:1002");
    expect(withExcluded(excluded, 2, "2:1002")["2"]!.excluded).toEqual([]);
    const cleared = withManual(excluded, 2, "2:1002", {
      value: "100000",
      reason: "Qayta hisob"
    });
    expect(cleared["2"]!.excluded).toEqual([]);
  });

  it("barcha KPI konfiguratsiyalariga bir xil o‘zgartirish qo‘llanadi", () => {
    const next = withAllConfigs(setup(), (d) => {
      d.settings.growthWarningPercent = 35;
    });
    expect(Object.values(next).every((c) => c.settings.growthWarningPercent === 35)).toBe(true);
  });
});
