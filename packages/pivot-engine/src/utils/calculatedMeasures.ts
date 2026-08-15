import type { CalculatedMeasure, PivotConfig, PivotField } from "../types/pivot.types.js";
import { compileFormula } from "./formulaEvaluator.js";
import { getPivotStrings } from "../i18n/index.js";

/** Hisoblangan metrikalarni qatorlarga qo'shadi (cube build dan oldin). */
export function applyCalculatedMeasures(
  data: Record<string, unknown>[],
  measures: CalculatedMeasure[],
  fields: PivotField[]
): Record<string, unknown>[] {
  if (!measures.length) return data;

  const numericFieldIds = fields
    .filter((f) => f.dataType === "number" || f.dataType === "currency")
    .map((f) => f.id);

  const evaluators = new Map<string, (row: Record<string, unknown>) => number | null>();
  for (const m of measures) {
    const allowed = [...numericFieldIds, ...measures.map((x) => x.id).filter((id) => id !== m.id)];
    evaluators.set(m.id, compileFormula(m.formula, allowed));
  }

  return data.map((row) => {
    const enriched = { ...row };
    for (const m of measures) {
      const fn = evaluators.get(m.id)!;
      const value = fn(enriched);
      if (value != null) enriched[m.id] = value;
    }
    return enriched;
  });
}

/** PivotField ro'yxatiga hisoblangan metrikalarni qo'shadi. */
export function calculatedMeasuresToFields(measures: CalculatedMeasure[]): PivotField[] {
  return measures.map((m) => ({
    id: m.id,
    label: m.label,
    dataType: "number" as const,
    format: m.format
  }));
}

/** PivotConfig dan barcha hisoblangan metrikalarni qaytaradi. */
export function getConfigCalculatedMeasures(config: PivotConfig): CalculatedMeasure[] {
  return config.calculatedMeasures ?? [];
}

/** SavdoDesk retrobonus tierlari — Aggregator.calculateRetrobonus bilan mos. */
export const RETROBONUS_TIER_PRESETS: Array<{
  id: string;
  label: string;
  tiers: Array<{ minVolume: number; percent: number }>;
  description: string;
}> = [
  {
    id: "retro_std",
    label: "Retrobonus standart",
    tiers: [
      { minVolume: 10_000_000, percent: 2 },
      { minVolume: 25_000_000, percent: 3 },
      { minVolume: 50_000_000, percent: 5 }
    ],
    description: "10M→2%, 25M→3%, 50M→5% (jami hajm bo'yicha)"
  },
  {
    id: "retro_premium",
    label: "Retrobonus premium",
    tiers: [
      { minVolume: 20_000_000, percent: 3 },
      { minVolume: 50_000_000, percent: 5 },
      { minVolume: 100_000_000, percent: 7 }
    ],
    description: "20M→3%, 50M→5%, 100M→7%"
  }
];

/** Oldindan belgilangan formulalar (UI preset) — joriy til bo'yicha. */
export function getCalculatedMeasurePresets() {
  return getPivotStrings().calculatedMeasurePresets;
}

/** @deprecated `getCalculatedMeasurePresets()` ishlating */
export const CALCULATED_MEASURE_PRESETS = getCalculatedMeasurePresets();
