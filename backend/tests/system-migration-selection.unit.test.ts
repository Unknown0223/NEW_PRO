import { describe, expect, it } from "vitest";
import { resolveImportSelection } from "../src/modules/system-migration/system-migration.constants";
import { fkSkipWarningUz } from "../src/modules/system-migration/system-migration.extended.import-fk";

describe("resolveImportSelection", () => {
  it("bo‘sh modules — hammasi (profil + initial_setup)", () => {
    const r = resolveImportSelection(undefined);
    expect(r.applyProfile).toBe(true);
    expect(r.stages.has("initial_setup")).toBe(true);
    expect(r.stages.has("references")).toBe(true);
    expect(r.stages.has("extended")).toBe(true);
  });

  it("faqat initial_setup — profil + initial_setup, spravochnik yo‘q", () => {
    const r = resolveImportSelection(["initial_setup"]);
    expect(r.applyProfile).toBe(true);
    expect(r.stages.has("initial_setup")).toBe(true);
    expect(r.stages.has("references")).toBe(false);
    expect(r.stages.has("transactional")).toBe(false);
  });

  it("faqat profile", () => {
    const r = resolveImportSelection(["profile"]);
    expect(r.applyProfile).toBe(true);
    expect(r.stages.size).toBe(0);
  });

  it("orders + payments — transactional", () => {
    const r = resolveImportSelection(["orders", "payments"]);
    expect(r.applyProfile).toBe(true);
    expect(r.stages.has("transactional")).toBe(true);
    expect(r.stages.has("references")).toBe(false);
  });
});

describe("fkSkipWarningUz", () => {
  it("product_prices uchun sodda o‘zbekcha", () => {
    const w = fkSkipWarningUz("product_prices", "product_id");
    expect(w).toContain("Mahsulot narxi");
    expect(w).toContain("mahsulot topilmadi");
    expect(w).not.toMatch(/Prisma|Argument|\.ts:/);
  });

  it("boshqa jadval — umumiy matn", () => {
    const w = fkSkipWarningUz("stock_take_lines", "product_id");
    expect(w).toContain("mahsulot topilmadi");
  });
});
