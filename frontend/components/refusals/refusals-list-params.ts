import { todayYmd, type RefusalFiltersState } from "@/lib/refusals-types";

export function defaultRefusalFilters(): RefusalFiltersState {
  const t = todayYmd();
  return {
    dateFrom: t,
    dateTo: t,
    agent: "",
    reason: "",
    clientCategory: "",
    zone: "",
    region: "",
    city: ""
  };
}

export function buildRefusalListParams(
  applied: RefusalFiltersState,
  page: number,
  perPage: number,
  sortKey: string,
  sortDir: "asc" | "desc",
  search: string,
  opts?: { forExport?: boolean }
): URLSearchParams {
  const qs = new URLSearchParams({
    page: String(page),
    limit: opts?.forExport ? "5000" : String(perPage),
    sort_by: sortKey,
    sort_dir: sortDir
  });
  if (opts?.forExport) qs.set("export_limit", "5000");
  if (applied.dateFrom) qs.set("date_from", applied.dateFrom);
  if (applied.dateTo) qs.set("date_to", applied.dateTo);
  if (applied.agent) qs.set("agent_id", applied.agent);
  if (applied.reason) qs.set("refusal_reason_ref", applied.reason);
  if (applied.clientCategory) qs.set("client_category", applied.clientCategory);
  if (applied.zone) qs.set("zone", applied.zone);
  if (applied.region) qs.set("region", applied.region);
  if (applied.city) qs.set("city", applied.city);
  if (search.trim()) qs.set("search", search.trim());
  return qs;
}
