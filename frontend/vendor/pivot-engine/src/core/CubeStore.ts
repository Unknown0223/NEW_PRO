import type { PivotConfig } from "../types/pivot.types.js";
import { CubeBuilder } from "./CubeBuilder.js";

export type CubeCacheEntry = {
  cube: CubeBuilder;
  filteredData: Record<string, unknown>[];
  dataHash: string;
  configHash: string;
};

/** Ma'lumot va agregatsiya konfiguratsiyasi bo'yicha cube keshi. */
export class CubeStore {
  private cache = new Map<string, CubeCacheEntry>();
  private maxEntries = 8;

  get(dataHash: string, configHash: string): CubeCacheEntry | undefined {
    return this.cache.get(`${dataHash}|${configHash}`);
  }

  set(entry: CubeCacheEntry): void {
    const key = `${entry.dataHash}|${entry.configHash}`;
    if (this.cache.size >= this.maxEntries && !this.cache.has(key)) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }
    this.cache.set(key, entry);
  }

  clear(): void {
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }
}

/** Ma'lumot massivi uchun oddiy kontent xeshi. */
export function hashPivotData(data: Record<string, unknown>[]): string {
  if (data.length === 0) return "empty";
  const first = data[0];
  const last = data[data.length - 1];
  let checksum = data.length;
  const sample = [first, last];
  for (const row of sample) {
    if (!row) continue;
    for (const v of Object.values(row)) {
      if (typeof v === "number" && Number.isFinite(v)) checksum += v;
    }
  }
  return `${data.length}:${checksum}`;
}

/** Agregatsiya uchun konfig xeshi (sort va ko'rinish opsiyalari tashqari). */
export function hashAggregationConfig(config: PivotConfig): string {
  const agg = {
    rows: config.rows,
    columns: config.columns,
    values: config.values,
    reportFilters: config.reportFilters,
    filters: config.filters,
    calculatedMeasures: config.calculatedMeasures ?? [],
    showSubtotals: config.options.showSubtotals,
    showGrandTotal: config.options.showGrandTotal,
    showColumnTotals: config.options.showColumnTotals,
    drillDown: config.options.drillDown,
    maxRows: config.options.maxRows,
    conditionalFormats: config.options.conditionalFormats
  };
  return JSON.stringify(agg);
}

/** To'liq konfig (tartiblash bilan) — natija keshi kaliti. */
export function hashFullConfig(config: PivotConfig): string {
  return JSON.stringify(config);
}

/**
 * Yangi ma'lumot eskisining faqat qo'shimcha qatorlari ekanini tekshiradi.
 * Prefix xeshi mos kelsa append-only deb hisoblanadi.
 */
export function isAppendOnlyDataUpdate(
  prev: Record<string, unknown>[],
  next: Record<string, unknown>[]
): boolean {
  if (prev.length === 0 || next.length <= prev.length) return false;
  return hashPivotData(prev) === hashPivotData(next.slice(0, prev.length));
}

/** Faqat tartiblash o'zgarganini aniqlash. */
export function isSortOnlyChange(prev: PivotConfig, next: PivotConfig): boolean {
  const prevSort = JSON.stringify(prev.options.sortBy ?? null);
  const nextSort = JSON.stringify(next.options.sortBy ?? null);
  if (prevSort === nextSort) return false;

  const prevAgg = { ...prev, options: { ...prev.options, sortBy: undefined } };
  const nextAgg = { ...next, options: { ...next.options, sortBy: undefined } };
  return hashAggregationConfig(prevAgg) === hashAggregationConfig(nextAgg);
}
