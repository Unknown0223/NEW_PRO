/**
 * Xavfsiz formula baholovchi — eval() ishlatilmaydi.
 * Qo'llab-quvvatlanadi: fieldId + fieldId, fieldId * 0.12, fieldId / fieldId
 */
/** Formula matnini xavfsiz AST orqali baholash funksiyasiga aylantiradi. */
export declare function compileFormula(formula: string, allowedFieldIds: string[]): (row: Record<string, unknown>) => number | null;
/** Bir qator uchun formula qiymatini hisoblaydi. */
export declare function evaluateFormula(formula: string, row: Record<string, unknown>, allowedFieldIds: string[]): number | null;
//# sourceMappingURL=formulaEvaluator.d.ts.map