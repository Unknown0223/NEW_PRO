export {
  salecFieldsToPivotFields,
  salecWdrMeasuresToPivotFields,
  salecFieldsToDatasetSchema,
  normalizeSalecDatasetRows,
  type SalecReportBuilderField,
  type SalecReportBuilderMetric
} from "./salec-field-adapter.js";

export {
  mapWdrAggregation,
  parseWdrFieldId,
  wdrSliceToPivotConfig,
  wdrReportToPivotConfig,
  isWdrSavedReportConfig,
  detectSavedReportFormat,
  type WdrSliceJson,
  type WdrSliceField,
  type WdrSliceMeasure,
  type WdrSavedReport
} from "./wdr-slice-adapter.js";
