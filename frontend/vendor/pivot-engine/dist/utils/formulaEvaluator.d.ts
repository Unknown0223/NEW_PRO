/**
 * Xavfsiz formula baholovchi — eval() ishlatilmaydi.
 * Qo'llab-quvvatlanadi: +, -, *, /, ^, qavs, taqqoslash, AND/OR,
 * IF / ABS / MIN / MAX, maydon id va sonlar.
 */
/** Formula matnini xavfsiz AST orqali baholash funksiyasiga aylantiradi. */
export declare function compileFormula(formula: string, allowedFieldIds: string[]): (row: Record<string, unknown>) => number | null;
/** Bir qator uchun formula qiymatini hisoblaydi. */
export declare function evaluateFormula(formula: string, row: Record<string, unknown>, allowedFieldIds: string[]): number | null;
//# sourceMappingURL=formulaEvaluator.d.ts.map