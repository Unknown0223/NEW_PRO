/**
 * Lalaku spravochniklari — re-export (import-once va boshqa skriptlar).
 */
export {
  ZONE_ROOT_NAMES,
  REGION_ZONE_ROWS,
  mergeTerritoryBundle,
  SALES_CHANNELS,
  CLIENT_FORMATS,
  CLIENT_CATEGORIES,
  CLIENT_TYPES,
  TRADE_DIRECTIONS,
  WAREHOUSE_NAMES
} from "./lalaku-reference-catalog";
export { canonicalRegionNameFromExcel, normalizeTerritoryLabel } from "./lalaku-reference-territory";
export {
  mergeExcelRegionsIntoTerritoryForest,
  buildTerritoryForestWithRegionAndCityRows,
  mergeCitiesIntoTerritoryForest,
  buildTerritoryForestWithCitiesFromRows
} from "./lalaku-reference-territory-excel";
export type {
  CityXlsxRow,
  MergeCitiesIntoTerritoryStats,
  MergeRegionsIntoTerritoryStats,
  RegionXlsxRow
} from "./lalaku-reference-territory-excel";
export type { LalakuReferenceOptions } from "./lalaku-reference-ensure";
export { runLalakuReferenceImport } from "./lalaku-reference-ensure";
