import type { PivotFilter } from "../types/pivot.types.js";
import { getPivotStrings } from "../i18n/index.js";

/** Pivot filter holatini qisqa matn sifatida ko'rsatadi (chip badge). */
export function summarizePivotFilter(filter: PivotFilter | undefined): string | null {
  if (!filter) return null;
  const f = getPivotStrings().filters;

  switch (filter.type) {
    case "include":
      return filter.values?.length ? f.selectedCount(filter.values.length) : null;
    case "exclude":
      return filter.values?.length ? `-${filter.values.length}` : null;
    case "range":
      if (filter.range?.min != null && filter.range?.max != null) {
        return `${filter.range.min}…${filter.range.max}`;
      }
      if (filter.range?.min != null) return `≥ ${filter.range.min}`;
      if (filter.range?.max != null) return `≤ ${filter.range.max}`;
      return null;
    case "date_range": {
      const from = filter.dateRange?.from?.toISOString().slice(0, 10);
      const to = filter.dateRange?.to?.toISOString().slice(0, 10);
      if (from && to) return `${from} — ${to}`;
      if (from) return `≥ ${from}`;
      if (to) return `≤ ${to}`;
      return null;
    }
    case "top_n":
      return filter.topN != null ? `Top ${filter.topN}` : null;
    case "bottom_n":
      return filter.topN != null ? `Bottom ${filter.topN}` : null;
    default:
      return null;
  }
}
