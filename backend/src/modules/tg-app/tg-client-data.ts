import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { loadDeliveryDebtByClient, mergeLedgerWithUnpaidDelivered } from "../client-balances/client-balances.service";
import { ORDER_STATUSES_EXCLUDED_FROM_CREDIT_EXPOSURE, ORDER_STATUSES_OUTSTANDING_RECEIVABLE } from "../orders/order-status";

export const CLIENT_PAGE_SIZE = 5;

export type ConsignmentDebtRow = { id: number; number: string; total: number; unpaid: number; due: Date | null; overdue: boolean };

export async function loadConsignmentDebts(tenantId: number, clientId: number): Promise<ConsignmentDebtRow[]> {
  const rows = await prisma.$queryRaw<
    Array<{ id: number; number: string; total_sum: Prisma.Decimal; allocated: Prisma.Decimal | null; consignment_due_date: Date | null }>
  >`
    SELECT o.id, o.number, o.total_sum, o.consignment_due_date,
      (SELECT COALESCE(SUM(pa.amount), 0) FROM payment_allocations pa
        WHERE pa.tenant_id = ${tenantId} AND pa.order_id = o.id)::decimal(15,2) AS allocated
    FROM orders o
    WHERE o.tenant_id = ${tenantId}
      AND o.client_id = ${clientId}
      AND o.order_type = 'order'
      AND o.is_consignment = true
      AND o.status IN (${Prisma.join([...ORDER_STATUSES_OUTSTANDING_RECEIVABLE])})
    ORDER BY o.consignment_due_date ASC NULLS LAST, o.id ASC
    LIMIT 200
  `;
  const now = Date.now();
  return rows
    .map((r) => {
      const total = Number(r.total_sum);
      const unpaid = Math.max(0, total - Number(r.allocated ?? 0));
      const due = r.consignment_due_date;
      return { id: r.id, number: r.number, total, unpaid, due, overdue: due != null && due.getTime() < now };
    })
    .filter((r) => r.unpaid > 0.009);
}

export async function loadClientSummary(tenantId: number, clientId: number) {
  const [client, bal, delivery, openAgg, consignment] = await Promise.all([
    prisma.client.findFirst({
      where: { id: clientId, tenant_id: tenantId },
      select: {
        id: true,
        name: true,
        credit_limit: true,
        agent_id: true,
        agent: { select: { id: true, name: true, phone: true } }
      }
    }),
    prisma.clientBalance.findUnique({
      where: { tenant_id_client_id: { tenant_id: tenantId, client_id: clientId } },
      select: { balance: true }
    }),
    loadDeliveryDebtByClient(tenantId, [clientId]),
    prisma.order.aggregate({
      where: {
        tenant_id: tenantId,
        client_id: clientId,
        order_type: "order",
        status: { in: ["new", "confirmed", "picking", "delivering"] }
      },
      _sum: { total_sum: true },
      _count: true
    }),
    loadConsignmentDebts(tenantId, clientId)
  ]);
  if (!client) return null;
  const ledger = bal?.balance ?? new Prisma.Decimal(0);
  const balance = Number(mergeLedgerWithUnpaidDelivered(ledger, delivery.get(clientId)));
  const creditLimit = Number(client.credit_limit);
  const consTotal = consignment.reduce((s, r) => s + r.unpaid, 0);
  const overdue = consignment.filter((r) => r.overdue).reduce((s, r) => s + r.unpaid, 0);
  return {
    client,
    balance,
    creditLimit,
    headroom: creditLimit + balance,
    openOrdersCount: openAgg._count,
    openOrdersSum: Number(openAgg._sum.total_sum ?? 0),
    consignmentTotal: consTotal,
    overdue,
    consignment
  };
}

export async function loadClientOrdersPage(tenantId: number, clientId: number, page: number) {
  const where: Prisma.OrderWhereInput = {
    tenant_id: tenantId,
    client_id: clientId,
    order_type: "order",
    status: { notIn: ["pending_sync"] }
  };
  const [total, rows] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where,
      orderBy: { created_at: "desc" },
      skip: (Math.max(1, page) - 1) * CLIENT_PAGE_SIZE,
      take: CLIENT_PAGE_SIZE,
      select: { id: true, number: true, status: true, total_sum: true, created_at: true, is_consignment: true }
    })
  ]);
  return { total, pages: Math.max(1, Math.ceil(total / CLIENT_PAGE_SIZE)), rows };
}

/** Buyurtma tafsiloti — faqat shu mijozniki bo'lsa. */
export async function loadClientOrder(tenantId: number, clientId: number, orderId: number) {
  const o = await prisma.order.findFirst({
    where: { id: orderId, tenant_id: tenantId, client_id: clientId, order_type: "order" },
    select: {
      id: true,
      number: true,
      status: true,
      total_sum: true,
      bonus_sum: true,
      created_at: true,
      is_consignment: true,
      consignment_due_date: true,
      agent: { select: { name: true, phone: true } },
      expeditor_user: { select: { name: true, phone: true } },
      items: {
        select: { qty: true, total: true, is_bonus: true, product: { select: { name: true, unit: true } } },
        orderBy: { id: "asc" },
        take: 30
      },
      _count: { select: { items: true } }
    }
  });
  if (!o) return null;
  const alloc = await prisma.paymentAllocation.aggregate({
    where: { tenant_id: tenantId, order_id: o.id },
    _sum: { amount: true }
  });
  const paid = Number(alloc._sum.amount ?? 0);
  return { ...o, paid, unpaid: Math.max(0, Number(o.total_sum) - paid) };
}

export async function loadClientPayments(tenantId: number, clientId: number, page: number) {
  const where: Prisma.PaymentWhereInput = { tenant_id: tenantId, client_id: clientId, deleted_at: null };
  const [total, rows] = await Promise.all([
    prisma.payment.count({ where }),
    prisma.payment.findMany({
      where,
      orderBy: { created_at: "desc" },
      skip: (Math.max(1, page) - 1) * 8,
      take: 8,
      select: { id: true, amount: true, payment_type: true, paid_at: true, created_at: true, workflow_status: true }
    })
  ]);
  return { total, pages: Math.max(1, Math.ceil(total / 8)), rows };
}

export async function loadClientReturns(tenantId: number, clientId: number, page: number) {
  const where: Prisma.SalesReturnWhereInput = { tenant_id: tenantId, client_id: clientId, status: { not: "cancelled" } };
  const [total, rows] = await Promise.all([
    prisma.salesReturn.count({ where }),
    prisma.salesReturn.findMany({
      where,
      orderBy: { created_at: "desc" },
      skip: (Math.max(1, page) - 1) * 8,
      take: 8,
      select: { id: true, number: true, status: true, refund_amount: true, created_at: true, _count: { select: { lines: true } } }
    })
  ]);
  return { total, pages: Math.max(1, Math.ceil(total / 8)), rows };
}

export function isOpenStatus(status: string): boolean {
  return !(ORDER_STATUSES_EXCLUDED_FROM_CREDIT_EXPOSURE as readonly string[]).includes(status) && status !== "delivered";
}
