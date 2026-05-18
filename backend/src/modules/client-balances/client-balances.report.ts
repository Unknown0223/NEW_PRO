import type { ClientBalanceListQuery, ClientBalanceListResponse } from "./client-balances.types";
import { buildClientBalancesReportContext } from "./client-balances.report.context";
import { listClientBalancesReportDelivery } from "./client-balances.report.delivery";
import { listClientBalancesReportFiltered } from "./client-balances.report.filtered";
import { listClientBalancesReportMain } from "./client-balances.report.main";

export async function listClientBalancesReport(
  tenantId: number,
  q: ClientBalanceListQuery
): Promise<ClientBalanceListResponse> {
  const ctx = buildClientBalancesReportContext(tenantId, q);
  if (q.view === "clients_delivery") {
    return listClientBalancesReportDelivery(ctx);
  }
  const bfEarly = q.balance_filter?.trim() ?? "";
  if (q.view === "clients" && (bfEarly === "debt" || bfEarly === "credit")) {
    return listClientBalancesReportFiltered(ctx);
  }
  return listClientBalancesReportMain(ctx);
}
