import type { IncomeReportQuery } from "./income-report.types";
import { parseDate } from "./income-report.types";

export function parseIncomeReportQuery(q: Record<string, string | undefined>): IncomeReportQuery {
  const fromRaw = (q.from ?? q.date_from)?.trim();
  const toRaw = (q.to ?? q.date_to)?.trim();
  if (!fromRaw || !toRaw) throw new Error("BAD_RANGE");
  const from = parseDate(fromRaw, fromRaw);
  const to = parseDate(toRaw, toRaw);
  to.setUTCHours(23, 59, 59, 999);
  if (to < from) throw new Error("BAD_RANGE");
  const intOr = (v?: string) => {
    if (!v) return undefined;
    const n = Number.parseInt(v, 10);
    return Number.isFinite(n) ? n : undefined;
  };
  const requestTypeRaw = (q.request_type ?? q.type_request ?? q.type)?.trim().toLowerCase();
  let request_type: IncomeReportQuery["request_type"] = "all";
  if (requestTypeRaw === "regular") request_type = "regular";
  if (requestTypeRaw === "consignment") request_type = "consignment";
  return {
    from: from.toISOString(),
    to: to.toISOString(),
    request_type,
    expeditor_id: intOr(q.expeditor_id),
    agent_id: intOr(q.agent_id),
    cash_desk_id: intOr(q.cash_desk_id ?? q.cashbox_id),
    client_category: q.client_category?.trim() || undefined,
    payment_type: q.payment_type?.trim() || undefined,
    trade_direction: q.trade_direction?.trim() || undefined,
    territory_1: q.territory_1?.trim() || undefined,
    territory_2: q.territory_2?.trim() || undefined,
    territory_3: q.territory_3?.trim() || undefined
  };
}
