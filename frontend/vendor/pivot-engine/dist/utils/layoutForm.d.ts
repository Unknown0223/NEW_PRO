import type { PivotConfig, PivotLayoutForm, PivotOptions } from "../types/pivot.types.js";
/** Options dan layout formani aniqlaydi (layoutForm yoki eski compactMode). */
export declare function resolveLayoutForm(options: PivotOptions | undefined): PivotLayoutForm;
/** layoutForm ni compactMode bilan sinxronlash (eski kod uchun). */
export declare function withLayoutForm(options: PivotOptions, layoutForm: PivotLayoutForm): PivotOptions;
/** Flat rejimda slice tanlanganmi (value shart emas). */
export declare function hasFlatSlice(config: PivotConfig): boolean;
//# sourceMappingURL=layoutForm.d.ts.map