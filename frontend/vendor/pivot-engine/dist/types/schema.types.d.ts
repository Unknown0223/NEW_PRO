import type { DataType } from "./pivot.types.js";
/** Maydon roli — WDR `type` va SALEC registry bilan moslashuv. */
export type FieldRole = "dimension" | "measure" | "date" | "calculated";
export interface DatasetFieldSchema {
    id: string;
    label: string;
    role: FieldRole;
    dataType: DataType;
    allowRow?: boolean;
    allowCol?: boolean;
    allowFilter?: boolean;
}
export interface DatasetSchema {
    id: string;
    label: string;
    fields: DatasetFieldSchema[];
    /** Standart metrika maydonlari (amount, qty, …) */
    measures?: DatasetFieldSchema[];
}
//# sourceMappingURL=schema.types.d.ts.map