export type RawRecordColumn = {
    id: string;
    label: string;
};
export type ExportRawRecordsOptions = {
    filename?: string;
    sheetName?: string;
};
/** Drill-through yoki xom qatorlarni Excel/CSV ga eksport qilish. */
export declare function exportRawRecordsToExcel(records: Record<string, unknown>[], columns: RawRecordColumn[], options?: ExportRawRecordsOptions): void;
/** Oddiy CSV yuklab olish (Excel kutubxonasiz fallback). */
export declare function exportRawRecordsToCsv(records: Record<string, unknown>[], columns: RawRecordColumn[], options?: {
    filename?: string;
}): void;
//# sourceMappingURL=exportRawRecords.d.ts.map