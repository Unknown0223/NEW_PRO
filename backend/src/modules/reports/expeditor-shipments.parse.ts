import { monthToDateYmd } from "../../lib/month-to-date";
import { intList, strList } from "./expeditor-returns.helpers";
import type { ExpeditorShipmentsDateType, ExpeditorShipmentsFilters } from "./expeditor-shipments.types";

export function parseExpeditorShipmentsQuery(q: Record<string, string | undefined>): ExpeditorShipmentsFilters {
  const page = Math.max(1, Number.parseInt(q.page ?? "1", 10) || 1);
  const limit = Math.min(200, Math.max(1, Number.parseInt(q.limit ?? "50", 10) || 50));
  const { from: defaultFrom, to: defaultTo } = monthToDateYmd();
  const dtRaw = (q.date_type ?? "").trim();
  const date_type: ExpeditorShipmentsDateType =
    dtRaw === "order_date" || dtRaw === "shipped_date" || dtRaw === "delivered_date" ? dtRaw : "shipped_date";
  return {
    date_type,
    from: (q.from ?? "").trim() || defaultFrom,
    to: (q.to ?? "").trim() || defaultTo,
    expeditor_ids: intList(q.expeditor_ids),
    category_ids: intList(q.category_ids),
    product_ids: intList(q.product_ids),
    statuses: strList(q.statuses),
    search: q.search?.trim() || undefined,
    page,
    limit
  };
}
