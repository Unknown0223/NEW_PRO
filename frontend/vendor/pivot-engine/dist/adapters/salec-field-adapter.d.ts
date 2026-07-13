import type { PivotField } from "../types/pivot.types.js";
import type { DatasetFieldSchema } from "../types/schema.types.js";
/** SALEC report-builder metadata dan keladigan maydon ta'rifi. */
export type SalecReportBuilderField = {
    id: string;
    label: string;
    allowRow?: boolean;
    allowCol?: boolean;
};
export type SalecReportBuilderMetric = {
    id: string;
    label: string;
};
/**
 * SALEC `/report-builder/metadata` javobini PivotField[] ga aylantiradi.
 */
export declare function salecFieldsToPivotFields(fields: SalecReportBuilderField[], metrics?: SalecReportBuilderMetric[]): PivotField[];
/** Registry dagi barcha WDR metrikalarini PivotField sifatida qaytaradi. */
export declare function salecWdrMeasuresToPivotFields(): PivotField[];
export declare function salecFieldsToDatasetSchema(datasetId: string, datasetLabel: string, fields: SalecReportBuilderField[], metrics?: SalecReportBuilderMetric[]): {
    id: string;
    label: string;
    fields: DatasetFieldSchema[];
    measures: DatasetFieldSchema[];
};
/**
 * SALEC dataset qatorlarini pivot engine uchun normalizatsiya qiladi.
 * Sana, null va son maydonlarini parse qiladi.
 */
export declare function normalizeSalecDatasetRows(rows: Record<string, unknown>[]): Record<string, unknown>[];
//# sourceMappingURL=salec-field-adapter.d.ts.map