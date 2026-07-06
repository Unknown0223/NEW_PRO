import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import {
  buildClientWhere,
  buildOrderCreatedLocalDateClause,
  loadTenantPaymentRefs,
  sqlIntIdToNumber,
  type ClientBalanceListQuery
} from "../client-balances/client-balances.service";
import { resolvePaymentMethodRefToLabel } from "../tenant-settings/finance-refs";
import { ORDER_STATUSES_OUTSTANDING_RECEIVABLE } from "../orders/order-status";
import { sqlOrderMerchandiseNetReceivable } from "../orders/order-merchandise-net";
import type { OrderDebtsListQuery } from "./order-debts.types";

const PAYMENT_NOT_PENDING = Prisma.sql`COALESCE(p.workflow_status, 'confirmed') <> 'pending_confirmation'`;

import type { OrderDebtRow, OrderDebtsListResponse, RawOrderDebtRow } from "./order-debts.types";
import { parseOrderDebtsListQuery } from "./order-debts.parse";
import {
  clientIdsScopeClause,
  expeditorOrderClause,
  loadUnallocatedByClient,
  orderBySql,
  orderConsignmentDueClause,
  orderConsignmentModeSql,
  orderDebtsNeedsClientIdList,
  orderPaymentRefClause,
  readSort,
  shipmentDateClause,
  tableSearchClause,
  warehouseClause
} from "./order-debts.query";

export async function listOrderDebtsReport(
  tenantId: number,
  rawQ: Record<string, string | undefined>
): Promise<OrderDebtsListResponse> {
  const q = parseOrderDebtsListQuery(rawQ);
  const page = q.page;
  const limit = q.limit;
  const offset = (page - 1) * limit;

  let clientIds: number[] | null = null;
  if (orderDebtsNeedsClientIdList(q)) {
    const forClients: ClientBalanceListQuery = {
      ...q,
      search: undefined,
      view: "clients",
      page: 1,
      limit: 1
    };
    const clientWhere = buildClientWhere(tenantId, forClients, { skipBalanceFilter: true });
    const idRows = await prisma.client.findMany({ where: clientWhere, select: { id: true } });
    let ids = idRows.map((r) => r.id);
    if (q.explicit_client_ids && q.explicit_client_ids.length > 0) {
      const allow = new Set(q.explicit_client_ids);
      ids = ids.filter((id) => allow.has(id));
    }
    if (ids.length === 0) {
      return {
        data: [],
        total: 0,
        page,
        limit,
        summary: { total_remainder: "0", currency: "UZS" }
      };
    }
    clientIds = ids;
  }
  const clientScopeSql = clientIdsScopeClause(tenantId, clientIds);

  const orderDateClause = buildOrderCreatedLocalDateClause(q.order_date_from ?? null, q.order_date_to ?? null);
  const shipClause = shipmentDateClause(q.shipment_date_from, q.shipment_date_to);
  const consDueClause = orderConsignmentDueClause(q.order_consignment_due_from, q.order_consignment_due_to);
  const consModeSql = orderConsignmentModeSql(q.order_consignment);
  const whClause = warehouseClause(q.warehouse_ids ?? []);
  const exClause = expeditorOrderClause(q.expeditor_user_id);
  const payRefClause = orderPaymentRefClause(q.order_payment_ref);
  const searchClause = tableSearchClause(q.search);
  const sortSql = orderBySql(readSort(q));

  const receivable = [...ORDER_STATUSES_OUTSTANDING_RECEIVABLE] as string[];

  const [countRows, dataRows] = await Promise.all([
    prisma.$queryRaw<[{ total: bigint; sum_remainder: Prisma.Decimal }]>`
    WITH alloc AS (
      SELECT pa.order_id, SUM(pa.amount)::decimal(15,2) AS sum_amt
      FROM payment_allocations pa
      WHERE pa.tenant_id = ${tenantId}
      GROUP BY pa.order_id
    ),
    ship AS (
      SELECT sl.order_id, MIN(sl.created_at) AS shipped_at
      FROM order_status_logs sl
      INNER JOIN orders ox ON ox.id = sl.order_id AND ox.tenant_id = ${tenantId}
      WHERE sl.to_status IN ('delivering', 'delivered')
      GROUP BY sl.order_id
    ),
    base AS (
      SELECT
        o.id,
        o.client_id,
        GREATEST(${sqlOrderMerchandiseNetReceivable("o")} - COALESCE(a.sum_amt, 0), 0)::decimal(15,2) AS remainder,
        ship.shipped_at
      FROM orders o
      INNER JOIN clients c ON c.id = o.client_id AND c.tenant_id = ${tenantId}
      LEFT JOIN alloc a ON a.order_id = o.id
      LEFT JOIN ship ON ship.order_id = o.id
      WHERE o.tenant_id = ${tenantId}
        AND o.order_type = 'order'
        AND o.status IN (${Prisma.join(receivable)})
        ${clientScopeSql}
        ${orderDateClause}
        ${whClause}
        ${exClause}
        ${consModeSql}
        ${consDueClause}
        ${payRefClause}
        ${searchClause}
        ${shipClause}
    )
    SELECT
      COUNT(*)::bigint AS total,
      COALESCE(SUM(remainder), 0)::decimal(15,2) AS sum_remainder
    FROM base
    WHERE remainder > 0
  `,
    prisma.$queryRaw<RawOrderDebtRow[]>`
    WITH alloc AS (
      SELECT pa.order_id, SUM(pa.amount)::decimal(15,2) AS sum_amt
      FROM payment_allocations pa
      WHERE pa.tenant_id = ${tenantId}
      GROUP BY pa.order_id
    ),
    ship AS (
      SELECT sl.order_id, MIN(sl.created_at) AS shipped_at
      FROM order_status_logs sl
      INNER JOIN orders ox ON ox.id = sl.order_id AND ox.tenant_id = ${tenantId}
      WHERE sl.to_status IN ('delivering', 'delivered')
      GROUP BY sl.order_id
    ),
    base AS (
      SELECT
        o.id AS order_id,
        o.number AS order_number,
        o.status AS order_status,
        o.client_id,
        c.name AS client_name,
        'UZS'::text AS currency,
        c.address,
        c.landmark,
        c.phone,
        o.agent_id,
        ag.name AS agent_name,
        ag.code AS agent_code,
        o.expeditor_user_id,
        ex.name AS expeditor_name,
        ex.code AS expeditor_code,
        o.warehouse_id,
        w.name AS warehouse_name,
        o.total_sum,
        LEAST(COALESCE(a.sum_amt, 0), ${sqlOrderMerchandiseNetReceivable("o")})::decimal(15,2) AS allocated_sum,
        o.payment_method_ref,
        ship.shipped_at AS shipped_at,
        o.consignment_due_date,
        GREATEST(${sqlOrderMerchandiseNetReceivable("o")} - COALESCE(a.sum_amt, 0), 0)::decimal(15,2) AS remainder,
        COALESCE(cb.balance, 0)::decimal(15,2) AS client_balance
      FROM orders o
      INNER JOIN clients c ON c.id = o.client_id AND c.tenant_id = ${tenantId}
      LEFT JOIN users ag ON ag.id = o.agent_id
      LEFT JOIN users ex ON ex.id = o.expeditor_user_id
      LEFT JOIN warehouses w ON w.id = o.warehouse_id
      LEFT JOIN client_balances cb ON cb.client_id = c.id AND cb.tenant_id = ${tenantId}
      LEFT JOIN alloc a ON a.order_id = o.id
      LEFT JOIN ship ON ship.order_id = o.id
      WHERE o.tenant_id = ${tenantId}
        AND o.order_type = 'order'
        AND o.status IN (${Prisma.join(receivable)})
        ${clientScopeSql}
        ${orderDateClause}
        ${whClause}
        ${exClause}
        ${consModeSql}
        ${consDueClause}
        ${payRefClause}
        ${searchClause}
        ${shipClause}
    )
    SELECT * FROM base
    WHERE remainder > 0
    ${sortSql}
    LIMIT ${limit} OFFSET ${offset}
  `
  ]);

  const total = Number(countRows[0]?.total ?? 0n);
  const sumAllRemainder = (countRows[0]?.sum_remainder ?? new Prisma.Decimal(0)).toString();

  const sliceClientIds = [...new Set(dataRows.map((r) => sqlIntIdToNumber(r.client_id)).filter(Number.isFinite))];
  const { entries: pmEntries } = await loadTenantPaymentRefs(tenantId);
  const unallocMap = await loadUnallocatedByClient(tenantId, sliceClientIds);

  const data: OrderDebtRow[] = dataRows.map((r) => {
    const oid = sqlIntIdToNumber(r.order_id);
    const cid = sqlIntIdToNumber(r.client_id);
    const rem = r.remainder ?? new Prisma.Decimal(0);
    const unallocated = unallocMap.get(cid) ?? new Prisma.Decimal(0);
    return {
      order_id: oid,
      order_number: r.order_number,
      order_status: r.order_status ?? "",
      client_id: cid,
      client_name: r.client_name,
      currency: r.currency,
      address: r.address,
      landmark: r.landmark,
      phone: r.phone,
      agent_id: r.agent_id != null ? sqlIntIdToNumber(r.agent_id) : null,
      agent_name: r.agent_name,
      agent_code: r.agent_code?.trim() || null,
      expeditor_user_id: r.expeditor_user_id != null ? sqlIntIdToNumber(r.expeditor_user_id) : null,
      expeditor_name: r.expeditor_name,
      expeditor_code: r.expeditor_code?.trim() || null,
      warehouse_id: r.warehouse_id != null ? sqlIntIdToNumber(r.warehouse_id) : null,
      warehouse_name: r.warehouse_name,
      total_sum: r.total_sum.toString(),
      allocated_sum: (r.allocated_sum ?? new Prisma.Decimal(0)).toString(),
      payment_method_label: resolvePaymentMethodRefToLabel(r.payment_method_ref, pmEntries),
      shipped_at: r.shipped_at?.toISOString() ?? null,
      consignment_due_date: r.consignment_due_date?.toISOString() ?? null,
      remainder: rem.toString(),
      unallocated: unallocated.toString(),
      client_balance: (r.client_balance ?? new Prisma.Decimal(0)).toString()
    };
  });

  return {
    data,
    total,
    page,
    limit,
    summary: { total_remainder: sumAllRemainder, currency: "UZS" }
  };
}

