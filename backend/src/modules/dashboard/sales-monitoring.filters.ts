import { csvToIntArray, nonEmpty } from "./dashboard.helpers";
import type { SalesMonitoringFilters } from "./sales-monitoring.types";
import { csvToBranchCodes, csvToStringList, sanitizeOrderStatuses } from "./sales-monitoring.scope";

export function parseSalesMonitoringFilters(q: Record<string, string | undefined>): SalesMonitoringFilters {
  const month = Math.min(12, Math.max(1, Number.parseInt(String(q.month ?? "1"), 10) || 1));
  const year = Math.max(2000, Math.min(2100, Number.parseInt(String(q.year ?? new Date().getUTCFullYear()), 10)));
  return {
    month,
    year,
    branch_codes: csvToBranchCodes(q.branches ?? q.branch_codes),
    territory_ids: csvToIntArray(q.territory_ids),
    territory_1_list: csvToStringList(q.territory_1 ?? q.territory1),
    territory_2_list: csvToStringList(q.territory_2 ?? q.territory2),
    territory_3_list: csvToStringList(q.territory_3 ?? q.territory3),
    agent_ids: csvToIntArray(q.agent_ids),
    supervisor_ids: csvToIntArray(q.supervisor_ids),
    payment_method_refs: csvToStringList(q.payment_methods ?? q.payment_method_refs),
    order_statuses: sanitizeOrderStatuses(csvToStringList(q.order_statuses)),
    category_ids: csvToIntArray(q.category_ids),
    sku_search: nonEmpty(q.sku_search ?? q.sku)
  };
}
