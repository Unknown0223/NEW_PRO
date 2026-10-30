import { monthToDateRange } from "@/components/dashboard/shared/date-ranges";
import type { SalesFilterDraft } from "@/components/dashboard/sales/types";

export function defaultSalesDraft(supervisorId = ""): SalesFilterDraft {
  const { from, to } = monthToDateRange();
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
