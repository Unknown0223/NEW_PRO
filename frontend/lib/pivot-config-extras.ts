import type { FieldFormat, PivotConfig, PivotValue } from "@salec/pivot-engine";
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

/** Flat dan classic/compact ga qaytganda snapshotni tiklash. */
export function restoreFromPreFlatSnapshot(
  config: PivotConfig,
  nextLayout: "classic" | "compact"
): PivotConfig {
  const extras = getPivotOptionsExtras(config);
  const snap = extras.preFlatSnapshot;
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
