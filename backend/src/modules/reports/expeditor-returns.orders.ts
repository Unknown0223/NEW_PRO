import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { ORDER_STATUSES, ORDER_TYPES, ORDER_TYPE_LABELS } from "../orders/order-status";
import {
  paymentMethodStorageKey,
  resolveCurrencyEntries,
  resolvePaymentMethodEntries
} from "../tenant-settings/finance-refs";
import type { ReportActor } from "./client-sales-4-report.service";
import { mergeTerritoryFilterOptions } from "./territory-nodes";
import type { ExpeditorReturnsFilters, OrderRowRaw } from "./expeditor-returns.types";
import {
  decStr,
  mapOrderRow,
  ordersCoreCte,
  sortOrdersSql
} from "./expeditor-returns.helpers";

export async function getExpeditorReturnsOrders(
  tenantId: number,
  f: ExpeditorReturnsFilters,
  actor?: ReportActor
) {
  const offset = (f.page - 1) * f.limit;
  const sortSql = sortOrdersSql(f.sort_by);

  const countRows = await prisma.$queryRaw<Array<{ total: bigint }>>`
    WITH ${ordersCoreCte(tenantId, f, actor)}
    SELECT COUNT(*)::bigint AS total FROM base_orders
  `;
  const total = Number(countRows[0]?.total ?? 0);

  const rows = await prisma.$queryRaw<OrderRowRaw[]>`
    WITH ${ordersCoreCte(tenantId, f, actor)}
    SELECT * FROM base_orders bo
    ORDER BY ${sortSql}
    LIMIT ${f.limit} OFFSET ${offset}
  `;

  const mapped = rows.map((r, idx) => mapOrderRow(r, idx, f.page, f.limit));
  const sumBefore = rows.reduce((a, r) => a.add(r.total_sum), new Prisma.Decimal(0));
  const sumReturn = rows.reduce((a, r) => a.add(r.refund_sum), new Prisma.Decimal(0));
  const sumAfter = rows.reduce((a, r) => a.add(r.total_sum.sub(r.refund_sum)), new Prisma.Decimal(0));

  return {
    period_from: f.from,
    period_to: f.to,
    date_type: f.date_type,
    application_type: f.application_type,
    page: f.page,
    limit: f.limit,
    total,
    totals: {
      sum_before: decStr(sumBefore),
      sum_return: decStr(sumReturn),
      sum_after: decStr(sumAfter),
      qty_ordered: decStr(rows.reduce((a, r) => a.add(r.qty_ordered), new Prisma.Decimal(0))),
      qty_returned: decStr(rows.reduce((a, r) => a.add(r.return_qty_effective), new Prisma.Decimal(0)))
    },
    rows: mapped
  };
}
