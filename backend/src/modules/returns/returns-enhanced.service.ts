/**
 * Domain: Polki / davr vozvratlari (enhanced).
 */
export * from "./returns-enhanced.types";
export * from "./returns-enhanced.helpers";
export * from "./returns-enhanced.warehouse";
export * from "./returns-enhanced.polki";
export * from "./returns-enhanced.client-data";
export * from "./returns-enhanced.compute";
export * from "./returns-enhanced.create-period";
export * from "./returns-enhanced.create-batch";
export * from "./returns-enhanced.auto-mark";
export * from "./returns-enhanced.full-return";
export {
  loadReturnFilterSettings,
  normalizeReturnFilterSettings
} from "./returns-filter.settings";
export {
  resolveReturnEligibleWindow,
  returnFilterMetaFromWindow,
  subtractReturnPeriod
} from "./returns-filter.service";
export type { ReturnFilterSettings, ReturnFilterMeta } from "./returns-filter.types";
export {
  checkShelfReturnByOrderEligibility,
  type ShelfReturnByOrderCheckResult,
  type ShelfReturnByOrderCheckCode
} from "./returns-shelf-by-order.check";
export {
  previewPolkiAutoBonusReverse,
  computeReverseLineSplit,
  type PolkiAutoBonusPreviewInput,
  type PolkiAutoBonusPreviewResult
} from "./returns-bonus-reverse.preview";
