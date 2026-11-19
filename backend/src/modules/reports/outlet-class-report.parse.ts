import { monthToDateYmd } from "../../lib/month-to-date";
import { intList, strList } from "./expeditor-returns.helpers";
import type {
  OutletClassBand,
  OutletClassGroupBy,
  OutletClassReportFilters
} from "./outlet-class-report.types";

const GROUP_BY = new Set<OutletClassGroupBy>(["client", "class"]);

const DEFAULT_BANDS: OutletClassBand[] = [
  { name: "A", min_sum: 1_000_000 },
  { name: "B", min_sum: 500_000 },
  { name: "C", min_sum: 100_000 },
  { name: "D", min_sum: 0 }
];

/** `A:1000000,B:500000,C:0` — yuqoridan pastga min_sum. */
export function parseOutletClassBands(raw?: string): OutletClassBand[] {
  const parts = (raw ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length === 0) return DEFAULT_BANDS.map((b) => ({ ...b }));
  const out: OutletClassBand[] = [];
  for (const p of parts) {
    const [nameRaw, sumRaw] = p.split(":");
    const name = (nameRaw ?? "").trim();
    const min_sum = Number.parseFloat((sumRaw ?? "").trim());
    if (!name || !Number.isFinite(min_sum) || min_sum < 0) continue;
    out.push({ name, min_sum });
  }
  if (out.length === 0) return DEFAULT_BANDS.map((b) => ({ ...b }));
  return out.sort((a, b) => b.min_sum - a.min_sum);
}

export function parseOutletClassReportQuery(
  q: Record<string, string | undefined>
): OutletClassReportFilters {
  const page = Math.max(1, Number.parseInt(q.page ?? "1", 10) || 1);
  const limit = Math.min(200, Math.max(1, Number.parseInt(q.limit ?? "50", 10) || 50));
  const { from: defaultFrom, to: defaultTo } = monthToDateYmd();
  const groupRaw = (q.group_by ?? "").trim() as OutletClassGroupBy;
  return {
    from: (q.from ?? "").trim() || defaultFrom,
    to: (q.to ?? "").trim() || defaultTo,
    group_by: GROUP_BY.has(groupRaw) ? groupRaw : "client",
    bands: parseOutletClassBands(q.bands),
    statuses: strList(q.statuses),
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
