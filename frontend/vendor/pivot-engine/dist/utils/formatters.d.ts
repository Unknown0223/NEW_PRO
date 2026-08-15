import type { FieldFormat, PivotConfig, PivotField } from "../types/pivot.types.js";
export type FormatValueOptions = {
    /**
     * true — valyuta belgisi/kodi (soʻm, UZS, USD…);
     * false/omit — faqat son (bitta valyuta rejimida).
     */
    showCurrency?: boolean;
};
/**
 * Pivot value/field formatlaridan unique valyuta kodlari.
 * Bitta kod → suffix kerak emas; 2+ → ko‘rsatiladi.
 */
export declare function collectCurrencyCodesFromPivot(config: PivotConfig, fields?: PivotField[]): string[];
/** Ikki yoki undan ortiq turli valyuta bo‘lsa — suffix kerak. */
export declare function shouldShowCurrencySuffix(config: PivotConfig, fields?: PivotField[]): boolean;
/** Custom minglik/o‘nlik ajratuvchilar bilan formatlash. */
export declare function formatNumberWithSeparators(value: number, format?: FieldFormat): string;
/**
 * Son, valyuta, foiz va sanani O'zbekiston locale (uz-UZ) bo'yicha formatlaydi.
 */
export declare function formatValue(value: number | string | Date | null | undefined, format?: FieldFormat, opts?: FormatValueOptions): string;
export declare function formatCurrency(value: number, format?: FieldFormat, opts?: FormatValueOptions): string;
export declare function formatPercent(value: number, format?: FieldFormat): string;
export declare function formatNumber(value: number, format?: FieldFormat): string;
export declare function formatDate(date: Date, format?: FieldFormat): string;
export declare function formatUzNumber(value: number): string;
//# sourceMappingURL=formatters.d.ts.map