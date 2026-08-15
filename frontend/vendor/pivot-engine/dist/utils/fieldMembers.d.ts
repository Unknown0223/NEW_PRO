/** Maydon uchun noyob qiymatlar ro'yxati (filtr UI uchun). */
export declare function getFieldMembers(data: Record<string, unknown>[], fieldId: string): (string | number)[];
type ExpandableRow = {
    key: string;
    children?: ExpandableRow[];
};
/** Pivot jadvalidagi yoyiladigan qator kalitlari. */
export declare function collectExpandableRowKeys(rows: ExpandableRow[]): string[];
export {};
//# sourceMappingURL=fieldMembers.d.ts.map