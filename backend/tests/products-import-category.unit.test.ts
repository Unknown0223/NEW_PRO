import { describe, expect, it } from "vitest";
import {
  formatCategoryImportError,
  headerToTemplateCol,
  mapTemplateHeaderRow,
  normalizeTemplateHeader
} from "../src/modules/products/products.import.helpers";

describe("products import — category column", () => {
  it("maps unit-of-measure header before generic «название»", () => {
    expect(headerToTemplateCol("Единица измерения (название) *")).toBe("unitName");
    expect(headerToTemplateCol("Единица измерения(код) *")).toBe("unitName");
    expect(headerToTemplateCol("Название *")).toBe("name");
  });

  it("does not treat unit «(название)» as product name", () => {
    expect(headerToTemplateCol("Единица измерения (название) *")).not.toBe("name");
  });

  it("maps preview-rebuild headers without letting unit overwrite name", () => {
    // Frontend rebuild: canonical «…(название)» + eski fayldagi «…(код)»
    const cols = mapTemplateHeaderRow([
      { col: 1, text: "Название *" },
      { col: 2, text: "Код" },
      { col: 3, text: "Категория *" },
      { col: 4, text: "Единица измерения (название) *" },
      { col: 5, text: "Единица измерения(код) *" }
    ]);
    expect(cols.name).toBe(1);
    expect(cols.code).toBe(2);
    expect(cols.categoryName).toBe(3);
    expect(cols.unitName).toBe(4);
  });

  it("maps new and legacy category headers to categoryName", () => {
    expect(headerToTemplateCol("Категория *")).toBe("categoryName");
    expect(headerToTemplateCol("Категория(код) *")).toBe("categoryName");
    expect(headerToTemplateCol("Категория(название) *")).toBe("categoryName");
  });

  it("normalizes header text", () => {
    expect(normalizeTemplateHeader("Категория(код) *")).toBe("категория(код)");
  });

  it("formats row-level category errors in Russian", () => {
    expect(
      formatCategoryImportError(5, "Молоко", { ok: false, reason: "not_found" })
    ).toBe("Строка 5: категория «Молоко» не найдена в системе");

    expect(
      formatCategoryImportError(3, "  ", { ok: false, reason: "empty" })
    ).toBe("Строка 3: категория обязательна");

    expect(
      formatCategoryImportError(7, "Напитки", {
        ok: false,
        reason: "ambiguous",
        detail: "Напитки (код A); Напитки (код B)"
      })
    ).toContain("неоднозначна");
  });
});
