import type { ClientBalanceListQuery } from "./client-balances.types";
import { makePerfMarker, tashkentDayEndUtc } from "./client-balances.date";
import { buildClientWhere } from "./client-balances.where";

export type ClientBalancesReportContext = {
  tenantId: number;
  q: ClientBalanceListQuery;
  perf: ReturnType<typeof makePerfMarker>;
  page: number;
  limit: number;
  asOfEnd: Date | null;
  odFrom: string | null;
  odTo: string | null;
  skipBal: boolean;
  where: Awaited<ReturnType<typeof buildClientWhere>>;
};

export async function buildClientBalancesReportContext(
  tenantId: number,
  q: ClientBalanceListQuery
): Promise<ClientBalancesReportContext> {
  const perf = makePerfMarker(`client-balances t=${tenantId} view=${q.view}`);
  const page = Math.max(1, q.page);
  const maxL = q.allow_large_export ? 5000 : 200;
  const limit = Math.min(maxL, Math.max(1, q.limit));
  const asOfRaw = q.balance_as_of?.trim();
  const asOfEnd = asOfRaw ? tashkentDayEndUtc(asOfRaw) : null;
  const odFrom = q.order_date_from?.trim() || null;
  const odTo = q.order_date_to?.trim() || null;
  const skipBal = q.view === "clients_delivery";
  const where = await buildClientWhere(tenantId, q, { skipBalanceFilter: skipBal });
  perf("where-ready", { page, limit, hasSearch: Boolean(q.search?.trim()) });
  return { tenantId, q, perf, page, limit, asOfEnd, odFrom, odTo, skipBal, where };
}
