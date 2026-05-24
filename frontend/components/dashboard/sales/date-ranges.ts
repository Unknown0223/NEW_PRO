import type { SalesFilterDraft } from "@/components/dashboard/sales/types";

export function defaultSalesDraft(supervisorId = ""): SalesFilterDraft {
  const to = new Date().toISOString().slice(0, 10);
  const from = new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10);
  return {
    date_type: "shipment_date",
    from,
    to,
    status: [],
    category_ids: [],
    manufacturer_ids: [],
    supervisor_ids: supervisorId ? [supervisorId] : [],
    group_ids: [],
    brand_ids: [],
    trade_directions: [],
    territory_1_list: [],
    territory_2_list: [],
    territory_3_list: [],
    payment_types: []
  };
}
