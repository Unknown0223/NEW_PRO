import type {
  FieldFormat,
  PivotConfig,
  PivotField,
  PivotOptions,
  PivotValue
} from "@salec/pivot-engine";
import { resolveLayoutForm } from "@/lib/pivot-layout-form";

/** Flat↔classic o‘tganda o‘lchovlarni tiklash uchun snapshot. */
export type PreFlatSnapshot = {
  rows: string[];
  columns: string[];
  values: PivotValue[];
};

export type PivotOptionsExtras = {
  fieldFormats?: Record<string, FieldFormat>;
  preFlatSnapshot?: PreFlatSnapshot;
};

export function getPivotOptionsExtras(config: PivotConfig): PivotOptionsExtras {
  return (config.options ?? {}) as PivotOptions & PivotOptionsExtras;
}

export function getFieldFormatOverride(
  config: PivotConfig,
  fieldId: string
): FieldFormat | undefined {
  return getPivotOptionsExtras(config).fieldFormats?.[fieldId];
}

export function withFieldFormats(
  config: PivotConfig,
  fieldFormats: Record<string, FieldFormat>
): PivotConfig {
  return {
    ...config,
    options: {
      ...config.options,
      fieldFormats
    } as PivotConfig["options"]
  };
}

export function capturePreFlatSnapshot(config: PivotConfig): PreFlatSnapshot {
  return {
    rows: [...config.rows],
    columns: [...config.columns],
    values: config.values.map((v) => ({ ...v, format: v.format ? { ...v.format } : undefined }))
  };
}

function uniqueIds(ids: string[]): string[] {
  return Array.from(new Set(ids));
}

function snapshotFieldIds(snap: PreFlatSnapshot): string[] {
  return uniqueIds([...snap.rows, ...snap.columns, ...snap.values.map((v) => v.fieldId)]);
}

const DATE_PART_ID_RE = /_(year|quarter|month|week|day)$/i;

/** Pivot «Значения» uchun mos maydon (kun/oy/yil va *_id — o‘lcham). */
export function isPivotMeasureField(field: PivotField | undefined): boolean {
  if (!field) return false;
  if (DATE_PART_ID_RE.test(field.id) || field.id.endsWith("_id")) return false;
  if (field.id === "bonus_qty" || field.id === "block_qty") return true;
  return field.dataType === "number" || field.dataType === "currency";
}

const PREFERRED_FALLBACK_MEASURES = ["amount", "volume", "qty", "quantity"];

/** Flat ustunlarini classic/compact sxemasiga taqsimlash: o‘lchamlar → Ряды, raqamlar → Значения. */
function redistributeFlatColumns(
  config: PivotConfig,
  fields: PivotField[],
  snap: PreFlatSnapshot | undefined
): Pick<PivotConfig, "rows" | "columns" | "values"> {
  const byId = new Map(fields.map((f) => [f.id, f]));
  const ids = uniqueIds([
    ...config.rows,
    ...config.columns,
    ...config.values.map((v) => v.fieldId)
  ]).filter((id) => byId.has(id));
  const snapValueById = new Map((snap?.values ?? []).map((v) => [v.fieldId, v]));

  const dims = ids.filter((id) => !isPivotMeasureField(byId.get(id)));
  const snapColumns = new Set(snap?.columns ?? []);
  const columns = dims.filter((id) => snapColumns.has(id));
  const rows = dims.filter((id) => !snapColumns.has(id));

  let values: PivotValue[] = ids
    .filter((id) => isPivotMeasureField(byId.get(id)))
    .map((id) => snapValueById.get(id) ?? { fieldId: id, aggregation: "SUM" as const });

  if (!values.length) {
    const fromSnap = (snap?.values ?? []).filter((v) => byId.has(v.fieldId));
    if (fromSnap.length) {
      values = fromSnap.map((v) => ({ ...v }));
    } else {
      const measure =
        PREFERRED_FALLBACK_MEASURES.map((id) => byId.get(id)).find(isPivotMeasureField) ??
        fields.find(isPivotMeasureField);
      if (measure) values = [{ fieldId: measure.id, aggregation: "SUM" }];
      else if (rows[0]) values = [{ fieldId: rows[0], aggregation: "COUNT" }];
    }
  }

  return { rows, columns, values };
}

/** Flat dan classic/compact ga qaytganda snapshotni tiklash yoki flat ustunlarini sxemaga moslash. */
export function restoreFromPreFlatSnapshot(
  config: PivotConfig,
  nextLayout: "classic" | "compact",
  fields?: PivotField[]
): PivotConfig {
  const extras = getPivotOptionsExtras(config);
  const snap = extras.preFlatSnapshot;
  const flatIds = uniqueIds([
    ...config.rows,
    ...config.columns,
    ...config.values.map((v) => v.fieldId)
  ]);
  const snapMatchesFlat =
    snap != null &&
    snap.values.length > 0 &&
    snapshotFieldIds(snap).length === flatIds.length &&
    snapshotFieldIds(snap).every((id) => flatIds.includes(id));

  if (!snapMatchesFlat && fields?.length) {
    return {
      ...config,
      ...redistributeFlatColumns(config, fields, snap),
      options: {
        ...config.options,
        layoutForm: nextLayout,
        compactMode: nextLayout === "compact",
        ...(snap ? { preFlatSnapshot: snap } : {})
      } as PivotConfig["options"]
    };
  }
  if (!snap) {
    return {
      ...config,
      options: {
        ...config.options,
        layoutForm: nextLayout,
        compactMode: nextLayout === "compact"
      }
    };
  }
  return {
    ...config,
    rows: [...snap.rows],
    columns: [...snap.columns],
    values: snap.values.map((v) => ({ ...v })),
    options: {
      ...config.options,
      layoutForm: nextLayout,
      compactMode: nextLayout === "compact",
      preFlatSnapshot: snap
    } as PivotConfig["options"]
  };
}

export function isLeavingFlatLayout(
  prev: PivotConfig,
  nextLayout: "classic" | "compact" | "flat"
): boolean {
  return resolveLayoutForm(prev.options) === "flat" && nextLayout !== "flat";
}
