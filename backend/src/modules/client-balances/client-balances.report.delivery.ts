import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import type { ClientBalanceListResponse, ClientBalanceRow } from "./client-balances.types";
import { agentInclude } from "./client-balances.constants";
import { loadTenantPaymentRefs } from "./client-balances.payments.data";
import {
  buildSummaryOverpaymentsByType,
  compareNumForSort,
  readSortDir
} from "./client-balances.payments.util";
import { loadLastPaymentByClient } from "./client-balances.ledger";
import { loadUnpaidDeliveredOrderDebtRows } from "./client-balances.delivery";
import { mapDeliveryOrderRow } from "./client-balances.mappers";
import type { ClientBalancesReportContext } from "./client-balances.report.context";

export async function listClientBalancesReportDelivery(
  ctx: ClientBalancesReportContext
): Promise<ClientBalanceListResponse> {
  const { tenantId, q, perf, page, limit, asOfEnd, odFrom, odTo, where } = ctx;
  const idRows = await prisma.client.findMany({ where, select: { id: true } });
  const ids = idRows.map((r) => r.id);
  perf("delivery.ids-loaded", { ids: ids.length });
  const filterOid =
    q.delivery_order_id != null && q.delivery_order_id > 0 ? q.delivery_order_id : null;
  let orderRows = await loadUnpaidDeliveredOrderDebtRows(tenantId, ids, odFrom, odTo, filterOid);
  perf("delivery.orders-loaded", { orderRows: orderRows.length, filterOrderId: filterOid });
  const bf = q.balance_filter?.trim();
  if (bf === "credit") {
    orderRows = [];
  }
  const paymentRefs = await loadTenantPaymentRefs(tenantId);
  const sprDelivery = paymentRefs.labels;
  const pmEntriesDelivery = paymentRefs.entries;
  const sortBy = q.sort_by?.trim() ?? "";
  const sortDir = readSortDir(q);
  if (sortBy === "balance") {
    orderRows.sort((a, b) =>
      compareNumForSort(Number(a.unpaid.neg().toString()), Number(b.unpaid.neg().toString()), sortDir)
    );
  } else if (sortBy.startsWith("pay:")) {
    // Qarz tip ustunlarida ko‘rsatilmaydi — pay sort no-op.
    void sortDir;
  }
  const total = orderRows.length;
  const pageSlice = orderRows.slice((page - 1) * limit, page * limit);
  const sliceClientIds = [...new Set(pageSlice.map((r) => r.client_id))];

  let sumUnpaid = new Prisma.Decimal(0);
  for (const r of orderRows) {
    sumUnpaid = sumUnpaid.add(r.unpaid);
  }
  const totalBalanceStr = sumUnpaid.neg().toString();

  const [clients, lastPays] = await Promise.all([
    (async () => {
      if (sliceClientIds.length === 0) return [];
      return prisma.client.findMany({
        where: { id: { in: sliceClientIds } },
        select: {
          id: true,
          name: true,
          is_active: true,
          legal_name: true,
          client_code: true,
          inn: true,
          phone: true,
          license_until: true,
          agent: { select: agentInclude.select },
          client_balances: { take: 1, select: { balance: true } }
        }
      });
    })(),
    loadLastPaymentByClient(tenantId, sliceClientIds, asOfEnd)
  ]);
  perf("delivery.summary-built", {
    pageSlice: pageSlice.length,
    distinctClients: sliceClientIds.length
  });
  const paymentByTypeDelivery = buildSummaryOverpaymentsByType(
    sprDelivery,
    orderRows.map((r) => ({ balance: r.unpaid.neg() }))
  );
  const clientById = new Map(clients.map((c) => [c.id, c]));

  const data: ClientBalanceRow[] = [];
  for (const od of pageSlice) {
    const c = clientById.get(od.client_id);
    if (!c) continue;
    data.push(mapDeliveryOrderRow(c, od, sprDelivery, pmEntriesDelivery, lastPays.get(od.client_id)));
  }

  return {
    view: "clients_delivery",
    data,
    total,
    page,
    limit,
    summary: { balance: totalBalanceStr, payment_by_type: paymentByTypeDelivery }
  };
}
