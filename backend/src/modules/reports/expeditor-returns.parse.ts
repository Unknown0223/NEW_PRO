import type {
  ExpeditorReturnsApplicationType,
  ExpeditorReturnsDateType,
  ExpeditorReturnsFilters,
  ExpeditorReturnsUnitMode
} from "./expeditor-returns.types";
import { intList, strList } from "./expeditor-returns.helpers";

export function parseExpeditorReturnsQuery(q: Record<string, string | undefined>): ExpeditorReturnsFilters {
  const page = Math.max(1, Number.parseInt(q.page ?? "1", 10) || 1);
  const limit = Math.min(200, Math.max(1, Number.parseInt(q.limit ?? "50", 10) || 50));
  const today = new Date();
  const defaultFrom = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
  const defaultTo = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().slice(0, 10);
  const from = (q.from ?? "").trim() || defaultFrom;
  const to = (q.to ?? "").trim() || defaultTo;
  const dtRaw = (q.date_type ?? "").trim();
  const date_type: ExpeditorReturnsDateType =
    dtRaw === "shipped_date" || dtRaw === "created_date" || dtRaw === "order_date"
      ? (dtRaw as ExpeditorReturnsDateType)
      : "order_date";
  const app =
    q.application_type === "all" || q.application_type === "returns_only"
      ? (q.application_type as ExpeditorReturnsApplicationType)
      : "returns_only";
  const cons =
    q.consignment === "yes" || q.consignment === "no" ? (q.consignment as "yes" | "no") : "all";
  const wid = q.warehouse_id?.trim();
  const warehouse_id = wid ? Number.parseInt(wid, 10) : undefined;
  const sortRaw = (q.sort_by ?? "").trim().toLowerCase();
  const sort_by: ExpeditorReturnsFilters["sort_by"] =
    sortRaw === "order_date"
      ? "order_date"
      : sortRaw === "client_name"
        ? "client_name"
        : sortRaw === "return_qty"
          ? "return_qty"
          : "order_id";
  const um = (q.unit_mode ?? "qty").trim().toLowerCase();
  const unit_mode: ExpeditorReturnsUnitMode =
    um === "pack" || um === "volume" || um === "weight" ? (um as ExpeditorReturnsUnitMode) : "qty";

  return {
    date_type,
    from,
    to,
    application_type: app,
    agent_ids: intList(q.agent_ids),
    expeditor_ids: intList(q.expeditor_ids),
    category_ids: intList(q.category_ids),
    payment_methods: strList(q.payment_methods),
    statuses: strList(q.statuses),
    consignment: cons,
    territory_1_list: strList(q.territory_1_list),
    territory_2_list: strList(q.territory_2_list),
    territory_3_list: strList(q.territory_3_list),
    warehouse_id: Number.isFinite(warehouse_id) && warehouse_id! > 0 ? warehouse_id : undefined,
    search: q.search?.trim() || undefined,
    search_products: q.search_products?.trim() || undefined,
    search_clients: q.search_clients?.trim() || undefined,
    page,
    limit,
    sort_by,
    unit_mode,
    agg_products_limit:
      q.agg_products_limit === "none" || q.agg_products_limit === "0"
        ? null
        : Math.min(50_000, Math.max(1, Number.parseInt(q.agg_products_limit ?? "500", 10) || 500)),
    agg_clients_limit:
      q.agg_clients_limit === "none" || q.agg_clients_limit === "0"
        ? null
        : Math.min(50_000, Math.max(1, Number.parseInt(q.agg_clients_limit ?? "800", 10) || 800))
  };
}
