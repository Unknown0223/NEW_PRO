import { ru } from "./ru.js";
import type { PivotLocale, PivotStrings } from "./types.js";
import { uz } from "./uz.js";

const LOCALES: Record<PivotLocale, PivotStrings> = { ru, uz };

let currentLocale: PivotLocale = "ru";

/** Joriy pivot UI tili (default: ru). */
export function getPivotLocale(): PivotLocale {
  return currentLocale;
}

export function setPivotLocale(locale: PivotLocale): void {
  currentLocale = locale;
}

/** Joriy til uchun barcha UI matnlari. */
export function getPivotStrings(): PivotStrings {
  return LOCALES[currentLocale];
}

export function getAggregationLabel(aggregation: keyof PivotStrings["aggregations"]): string {
  return getPivotStrings().aggregations[aggregation];
}

export type { PivotLocale, PivotStrings, CalculatedMeasurePreset } from "./types.js";
