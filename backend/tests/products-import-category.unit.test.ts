import { describe, expect, it } from "vitest";
import {
  formatCategoryImportError,
  headerToTemplateCol,
  normalizeTemplateHeader
} from "../src/modules/products/products.import.helpers";

describe("products import — category column", () => {
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
