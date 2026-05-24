import type { FinanceFilterDraft } from "@/components/dashboard/finance/types";

export {
  formatDateDot,
  parseIsoDate,
  quickRangeToDates,
  shiftDateRange
} from "@/components/dashboard/shared/date-ranges";

export function defaultFinanceDraft(supervisorId = ""): FinanceFilterDraft {
  const to = new Date().toISOString().slice(0, 10);
  const from = new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10);
  return {
    date_type: "order",
    from,
    to,
    payment_types: [],
    agent_ids: [],
    supervisor_ids: supervisorId ? [supervisorId] : [],
    trade_directions: [],
    client_categories: [],
    category_ids: [],
    territory_1_list: [],
    territory_2_list: [],
    territory_3_list: [],
    statuses: []
  };
}
