import type { PivotField, PivotValue } from "../types/pivot.types.js";

/**
 * Display caption for a measure / value field.
 * Prefer explicit PivotValue.label, then field catalog label (same as Поля chips), never raw id when a caption exists.
 */
export function resolvePivotValueLabel(
  value: Pick<PivotValue, "fieldId" | "label">,
  fields: PivotField[] | Map<string, PivotField>
): string {
  const explicit = value.label?.trim();
  if (explicit) return explicit;

  const field =
    fields instanceof Map ? fields.get(value.fieldId) : fields.find((f) => f.id === value.fieldId);
  const fromCatalog = field?.label?.trim();
  if (fromCatalog) return fromCatalog;

  return value.fieldId;
}

/** Attach catalog labels onto values that only have fieldId (templates / legacy saved configs). */
export function hydratePivotValueLabels(
  values: PivotValue[],
  fields: PivotField[]
): PivotValue[] {
  const map = new Map(fields.map((f) => [f.id, f]));
  return values.map((v) => {
    if (v.label?.trim()) return v;
    const label = map.get(v.fieldId)?.label?.trim();
    return label ? { ...v, label } : v;
  });
}
