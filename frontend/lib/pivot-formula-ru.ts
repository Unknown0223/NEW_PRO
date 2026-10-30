/** Formula kalit so‘zlari: ekranda ruscha, motorda (compileFormula) inglizcha. */
export const PIVOT_FORMULA_KEYWORDS_RU: Record<string, string> = {
  IF: "ЕСЛИ",
  ABS: "ABS",
  MIN: "МИН",
  MAX: "МАКС",
  AND: "И",
  OR: "ИЛИ"
};

const RU_TO_ENGINE = new Map(
  Object.entries(PIVOT_FORMULA_KEYWORDS_RU).map(([en, ru]) => [ru.toUpperCase(), en])
);

const RU_WORD_RE = /(?<![\p{L}\p{N}_])[\p{Script=Cyrillic}]+(?![\p{L}\p{N}_])/gu;
const ENGINE_WORD_RE = /(?<![\p{L}\p{N}_])(IF|ABS|MIN|MAX|AND|OR)(?![\p{L}\p{N}_])/gu;

export function formulaToEngine(formula: string): string {
  return formula.replace(RU_WORD_RE, (word) => RU_TO_ENGINE.get(word.toUpperCase()) ?? word);
}

export function formulaToDisplay(formula: string): string {
  return formula.replace(ENGINE_WORD_RE, (word) => PIVOT_FORMULA_KEYWORDS_RU[word] ?? word);
}
