import { describe, expect, it } from "vitest";
import { compileFormula } from "@salec/pivot-engine";
import { formulaToDisplay, formulaToEngine } from "@/lib/pivot-formula-ru";

describe("pivot formula ru ↔ engine", () => {
  it("ruscha kalit so‘zlar motor formatiga o‘giriladi va kompilyatsiya bo‘ladi", () => {
    const ru = "ЕСЛИ(amount > 0 И qty > 0, МАКС(amount, qty), ABS(МИН(amount, 0))) ИЛИ volume";
    const engine = formulaToEngine(ru);
    expect(engine).toBe("IF(amount > 0 AND qty > 0, MAX(amount, qty), ABS(MIN(amount, 0))) OR volume");
    expect(() => compileFormula(engine, ["amount", "qty", "volume"])).not.toThrow();
  });

  it("kichik harfli ruscha ham qabul qilinadi", () => {
    expect(formulaToEngine("если(amount > 0, amount, 0)")).toBe("IF(amount > 0, amount, 0)");
  });

  it("saqlangan inglizcha formula ruscha ko‘rinadi, field id o‘zgarmaydi", () => {
    expect(formulaToDisplay("IF(order_min > 0 AND max_qty > 0, MAX(order_min, 1), 0)")).toBe(
      "ЕСЛИ(order_min > 0 И max_qty > 0, МАКС(order_min, 1), 0)"
    );
  });
});
