export type PivotThemeId = "default" | "striped" | "compact" | "heatmap";
export type PivotThemeTokens = {
    id: PivotThemeId;
    label: string;
    cssVars: Record<string, string>;
};
export declare const PIVOT_THEMES: PivotThemeTokens[];
export declare function resolveThemeTokens(id: PivotThemeId): PivotThemeTokens;
/**
 * Map portable `--pivot-*` tokens onto SALEC PivotTable `--pg-*` CSS vars
 * so the Excel-style gallery and embed themes stay aligned.
 */
export declare function pivotThemeToPgCssVars(theme: PivotThemeTokens): Record<string, string>;
//# sourceMappingURL=tokens.d.ts.map