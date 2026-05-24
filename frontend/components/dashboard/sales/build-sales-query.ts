import type { SalesFilterDraft } from "@/components/dashboard/sales/types";

function normTrim(s: string): string {
  return String(s ?? "").trim();
}

function joinCsv(values: string[] | undefined): string {
  if (!values || values.length === 0) return "";
  const set = new Set<string>();
  for (const v of values) {
    const t = normTrim(v);
    if (t) set.add(t);
  }
  return Array.from(set).join(",");
}

export function buildSalesQueryString(
  applied: SalesFilterDraft,
  extra?: { page?: number; limit?: number }
): string {
  const q = new URLSearchParams();
  q.set("date_type", applied.date_type);
  q.set("from", applied.from);
  q.set("to", applied.to);
  const status = joinCsv(applied.status);
  if (status) q.set("status", status);
  const cats = joinCsv(applied.category_ids);
  if (cats) q.set("category_ids", cats);
  const mans = joinCsv(applied.manufacturer_ids);
  if (mans) q.set("manufacturer_ids", mans);
  const sups = joinCsv(applied.supervisor_ids);
  if (sups) q.set("supervisor_ids", sups);
  const groups = joinCsv(applied.group_ids);
  if (groups) q.set("group_ids", groups);
  const brands = joinCsv(applied.brand_ids);
  if (brands) q.set("brand_ids", brands);
  const td = joinCsv(applied.trade_directions);
  if (td) q.set("trade_direction", td);
  const t1 = joinCsv(applied.territory_1_list);
  if (t1) q.set("territory_1", t1);
  const t2 = joinCsv(applied.territory_2_list);
  if (t2) q.set("territory_2", t2);
  const t3 = joinCsv(applied.territory_3_list);
  if (t3) q.set("territory_3", t3);
  const pay = joinCsv(applied.payment_types);
  if (pay) q.set("payment_types", pay);
  if (extra?.page != null) q.set("page", String(extra.page));
  if (extra?.limit != null) q.set("limit", String(extra.limit));
  return q.toString();
}
