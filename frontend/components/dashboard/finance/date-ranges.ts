import type { FinanceFilterDraft } from "@/components/dashboard/finance/types";
import { monthToDateRange } from "@/components/dashboard/shared/date-ranges";

export {
  formatDateDot,
  parseIsoDate,
  quickRangeToDates,
  shiftDateRange
} from "@/components/dashboard/shared/date-ranges";

export function defaultFinanceDraft(supervisorId = ""): FinanceFilterDraft {
  const { from, to } = monthToDateRange();
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
