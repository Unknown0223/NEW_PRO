import type { FieldFormat } from "../types/pivot.types.js";
/**
 * Son, valyuta, foiz va sanani O'zbekiston locale (uz-UZ) bo'yicha formatlaydi.
 */
export declare function formatValue(value: number | string | Date | null | undefined, format?: FieldFormat): string;
export declare function formatCurrency(value: number, format?: FieldFormat): string;
export declare function formatPercent(value: number, format?: FieldFormat): string;
export declare function formatNumber(value: number, format?: FieldFormat): string;
export declare function formatDate(date: Date, format?: FieldFormat): string;
export declare function formatUzNumber(value: number): string;
//# sourceMappingURL=formatters.d.ts.map