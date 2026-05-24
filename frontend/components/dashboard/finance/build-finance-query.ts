import { financeDateTypeToApi } from "@/components/dashboard/finance/finance-date-type";
import type { FinanceFilterDraft } from "@/components/dashboard/finance/types";

function normTrim(s: string): string {
  return String(s ?? "").trim();
}

export function joinCsv(values: string[] | undefined): string {
  if (!values || values.length === 0) return "";
  const set = new Set<string>();
  for (const v of values) {
    const t = normTrim(v);
    if (t) set.add(t);
  }
  return Array.from(set).join(",");
}

/** Backend `parseFinanceDashboardFilters` query params. */
export function buildFinanceQueryString(
  applied: FinanceFilterDraft,
  extra?: { page?: number; limit?: number }
): string {
  const q = new URLSearchParams();
  q.set("date_type", financeDateTypeToApi(applied.date_type));
  q.set("from", applied.from);
  q.set("to", applied.to);
  const pay = joinCsv(applied.payment_types);
  if (pay) q.set("payment_type", pay);
  const agents = joinCsv(applied.agent_ids);
  if (agents) q.set("agent_ids", agents);
  const sups = joinCsv(applied.supervisor_ids);
  if (sups) q.set("supervisor_ids", sups);
  const td = joinCsv(applied.trade_directions);
  if (td) q.set("trade_direction", td);
  const cc = joinCsv(applied.client_categories);
  if (cc) q.set("client_category", cc);
  const cats = joinCsv(applied.category_ids);
  if (cats) q.set("category_ids", cats);
  const t1 = joinCsv(applied.territory_1_list);
  if (t1) q.set("territory_1", t1);
  const t2 = joinCsv(applied.territory_2_list);
  if (t2) q.set("territory_2", t2);
  const t3 = joinCsv(applied.territory_3_list);
  if (t3) q.set("territory_3", t3);
  const st = joinCsv(applied.statuses);
  if (st) q.set("statuses", st);
  if (extra?.page != null) q.set("page", String(extra.page));
  if (extra?.limit != null) q.set("limit", String(extra.limit));
  return q.toString();
}
