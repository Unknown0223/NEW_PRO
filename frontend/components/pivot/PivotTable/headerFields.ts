import type { PivotConfig, PivotData } from "@salec/pivot-engine";

/**
 * Resolve which pivot field a header caption filters.
 * Flat: header.key is the field id.
 * Compact/classic: row dims use config.rows; column levels use config.columns[level];
 * measure headers use config.values (by label, fieldId, or `__fieldId` suffix on key).
 */
export function resolveHeaderFilterFieldId(
  header: PivotData["headers"][0][0],
  config: PivotConfig,
  levelIdx: number,
  isFlat: boolean
): string | undefined {
  if (isFlat) {
    if (header.key && header.key !== "__row_label__" && header.key !== "__row_label__2") {
      return header.key;
    }
    return undefined;
  }

  if (header.isValue) {
    const byLabel = config.values.find(
      (v) => (v.label ?? v.fieldId) === header.label || v.fieldId === header.label
    );
    if (byLabel) return byLabel.fieldId;
    if (config.values.some((v) => v.fieldId === header.key)) return header.key;
    const sep = header.key.lastIndexOf("__");
    if (sep >= 0) {
      const fid = header.key.slice(sep + 2);
      if (config.values.some((v) => v.fieldId === fid)) return fid;
    }
    return config.values[0]?.fieldId;
  }

  if (levelIdx < config.columns.length) {
    return config.columns[levelIdx];
  }

  return undefined;
}

/** Same field id used for header sort clicks. */
export function resolveHeaderSortFieldId(
  header: PivotData["headers"][0][0],
  config: PivotConfig,
  levelIdx: number,
  isFlat: boolean
): string | undefined {
  return resolveHeaderFilterFieldId(header, config, levelIdx, isFlat);
}
