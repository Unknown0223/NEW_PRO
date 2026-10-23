import { describe, expect, it } from "vitest";
import {
  evaluateFormula,
  normalizeVarName,
  parseFormula,
  type FormulaAst,
  MAX_RECURSION_DEPTH,
  MAX_NUMBER,
  MAX_FORMULA_LENGTH,
  MAX_FUNCTION_ARGS,
  collectVariables
} from "../src/modules/payroll/payroll.formula-engine";

const vars = (o: Record<string, number>) => new Map(Object.entries(o).map(([k, v]) => [normalizeVarName(k), v]));
const ev = (text: string, o: Record<string, number> = {}) => evaluateFormula(parseFormula(text), vars(o));

describe("formula engine hardening — security limits", () => {
  it("rekursiya chiziqligi cheklovi (MAX_RECURSION_DEPTH) evaluateFormula da", () => {
    const deepNested = "1" + "+1".repeat(200);
    const ast = parseFormula(deepNested);
    expect(() => evaluateFormula(ast, vars({}))).toThrow(/Превышена глубина рекурсии/i);
  });

  it("formula uzunligi cheklovi (MAX_FORMULA_LENGTH)", () => {
    const longFormula = "1+" + "1".repeat(MAX_FORMULA_LENGTH);
    expect(() => parseFormula(longFormula)).toThrow(/слишком длинная/i);
  });

  it("MAX_NUMBER dan oshgan qiymat clamp qilinadi", () => {
    const result = ev("[A] * [B]", { A: MAX_NUMBER * 10, B: 10 });
    expect(result.value).toBe(MAX_NUMBER);
  });

  it("minus Infinity clamp qilinadi", () => {
    const result = ev("0 - [A]", { A: MAX_NUMBER * 10 });
    expect(result.value).toBe(-MAX_NUMBER);
  });

  it("NaN kiritiladi, 0 qaytadi lekin division_by_zero ogohlantiriladi", () => {
    const result = ev("0 / 0");
    expect(result.value).toBe(0);
    expect(result.warnings).toContain("division_by_zero");
  });

  it("Infinity natija clamp qilinadi (MAX_NUMBER)", () => {
    const result = ev("[A]^2", { A: MAX_NUMBER });
    expect(result.value).toBe(MAX_NUMBER);
  });

  it("funksiya argumentlari soni chekloviga tekshirish", () => {
    const args = Array(MAX_FUNCTION_ARGS + 1).fill("1").join(", ");
    expect(() => ev(`СУММ(${args})`, {})).toThrow(/аргументов/i);
  });

  it("noma'lum o'zgaruvchi ogohlantirish va 0 qaytaradi", () => {
    const result = ev("[Неизвестная переменная]", {});
    expect(result.value).toBe(0);
    expect(result.warnings).toContain("unknown_var:Неизвестная переменная");
  });

  it("ko'plab funksiyalarning ich iceложение rekursiya cheklovi", () => {
    const nestedIf = "ЕСЛИ(1>0, ЕСЛИ(1>0, ".repeat(40) + "1" + ")".repeat(80);
    expect(() => ev(nestedIf, {})).toThrow(/Превышена глубина рекурсии/i);
  });
});
