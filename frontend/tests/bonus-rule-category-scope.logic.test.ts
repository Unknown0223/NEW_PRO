import { describe, expect, it } from "vitest";
import {
  bonusRuleColumnFooter,
  wholeCategoryIncludesAllSkus
} from "../components/bonus-rules/bonus-rule-category-scope.logic";

describe("wholeCategoryIncludesAllSkus", () => {
  it("kategoriya bor, SKU yo‘q — butun kategoriya", () => {
    expect(wholeCategoryIncludesAllSkus([10], [])).toBe(true);
  });

  it("SKU tanlangan — faqat shu mahsulotlar", () => {
    expect(wholeCategoryIncludesAllSkus([10], [1, 2])).toBe(false);
  });

  it("kategoriya yo‘q — false", () => {
    expect(wholeCategoryIncludesAllSkus([], [])).toBe(false);
  });
});

describe("bonusRuleColumnFooter", () => {
  it("kategoriya 3+1 — 0 SKU emas, barcha tovarlar", () => {
    expect(
      bonusRuleColumnFooter({
        productCount: 0,
        categoryCount: 1,
        categoryMode: true,
        locked: true
      })
    ).toBe("Категория: все товары внутри · только просмотр");
  });

  it("kategoriya + aniq SKU", () => {
    expect(
      bonusRuleColumnFooter({
        productCount: 5,
        categoryCount: 1,
        categoryMode: true,
        locked: false
      })
    ).toBe("Категории: 1 · SKU: 5");
  });

  it("qulflangan bonus-tovarlar — не сохраняется emas", () => {
    expect(
      bonusRuleColumnFooter({
        productCount: 5,
        categoryCount: 0,
        categoryMode: false,
        locked: true
      })
    ).toBe("Выбрано: 5 · только просмотр");
  });
});
