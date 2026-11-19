import { monthToDateYmd } from "../../lib/month-to-date";
import { intList, strList } from "./expeditor-returns.helpers";
import type { RfmReportFilters } from "./rfm-report.types";

export function parseRfmReportQuery(q: Record<string, string | undefined>): RfmReportFilters {
  const page = Math.max(1, Number.parseInt(q.page ?? "1", 10) || 1);
  const limit = Math.min(200, Math.max(1, Number.parseInt(q.limit ?? "50", 10) || 50));
  const { from: defaultFrom, to: defaultTo } = monthToDateYmd();
  return {
    from: (q.from ?? "").trim() || defaultFrom,
    to: (q.to ?? "").trim() || defaultTo,
    agent_ids: intList(q.agent_ids),
    client_categories: strList(q.client_categories),
    territory_1_list: strList(q.territory_1_list),
    territory_2_list: strList(q.territory_2_list),
    territory_3_list: strList(q.territory_3_list),
    search: q.search?.trim() || undefined,
    page,
    limit
  };
}

/** Quintile 1..5 within the set; 5 = best (higher or lower per flag). */
export function scoreRfmQuintiles(values: number[], higherIsBetter: boolean): number[] {
  const n = values.length;
  if (n === 0) return [];
  const ranked = values.map((v, i) => ({
    i,
    v: Number.isFinite(v) ? v : 0
  }));
  ranked.sort((a, b) => (higherIsBetter ? a.v - b.v : b.v - a.v));
  const scores = new Array<number>(n).fill(1);
  for (let rank = 0; rank < n; rank++) {
    const quintile = Math.min(5, Math.floor((rank * 5) / n) + 1);
    scores[ranked[rank]!.i] = quintile;
  }
  return scores;
}