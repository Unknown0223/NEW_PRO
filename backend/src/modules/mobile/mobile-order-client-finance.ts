import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import {
  computeAgentConsignmentOutstanding,
  parseYearMonth,
  utcMonthStart
} from "../consignment/consignment.service";
import {
  loadDeliveryDebtByClient,
  mergeLedgerWithUnpaidDelivered
} from "../client-balances/client-balances.service";
import {
  ORDER_STATUSES_EXCLUDED_FROM_CREDIT_EXPOSURE,
  ORDER_STATUSES_OUTSTANDING_RECEIVABLE
} from "../orders/order-status";

export type MobileOrderClientFinance = {
  credit_limit: string;
  account_balance: string;
  open_orders_total: string;
  /** `credit_limit + account_balance` (backend kredit tekshiruvi bilan bir xil). */
  credit_headroom: string;
  agent_consignment_enabled: boolean;
  consignment_limit_amount: string | null;
  consignment_outstanding: string | null;
  /** Клиент: обычный заказ при общем долге */
  allow_order_with_debt: boolean;
  /** Клиент: консигнация разрешена */
  allow_consignment: boolean;
  /** Клиент: консигнация при долге по консигнации */
  allow_consignment_with_debt: boolean;
  /** account_balance < 0 */
  has_account_debt: boolean;
  /** Неоплаченная консигнация по клиенту > 0 */
  has_consignment_debt: boolean;
};

async function clientHasUnpaidConsignmentDebt(
  tenantId: number,
  clientId: number
): Promise<boolean> {
  const rows = await prisma.$queryRaw<Array<{ unpaid: Prisma.Decimal | null }>>`
    WITH cand AS (
      SELECT o.id, o.total_sum
      FROM orders o
      WHERE o.tenant_id = ${tenantId}
        AND o.client_id = ${clientId}
        AND o.order_type = 'order'
        AND o.is_consignment = true
        AND o.status IN (${Prisma.join([...ORDER_STATUSES_OUTSTANDING_RECEIVABLE])})
    ),
    alloc AS (
      SELECT pa.order_id, SUM(pa.amount)::decimal(15,2) AS allocated
      FROM payment_allocations pa
      WHERE pa.tenant_id = ${tenantId}
        AND pa.order_id IN (SELECT id FROM cand)
      GROUP BY pa.order_id
    )
    SELECT COALESCE(SUM(GREATEST(c.total_sum - COALESCE(a.allocated, 0), 0)), 0)::decimal(15,2) AS unpaid
    FROM cand c
    LEFT JOIN alloc a ON a.order_id = c.id
  `;
  const unpaid = rows[0]?.unpaid ?? new Prisma.Decimal(0);
  return unpaid.gt(0);
}

export async function getMobileOrderClientFinance(
  tenantId: number,
  agentUserId: number,
  clientId: number
): Promise<MobileOrderClientFinance | null> {
  const [client, agg, balRow, deliveryMap, agent, hasConsignmentDebt] = await Promise.all([
    prisma.client.findFirst({
      where: { id: clientId, tenant_id: tenantId, merged_into_client_id: null },
      select: {
        id: true,
        credit_limit: true,
        allow_order_with_debt: true,
        allow_consignment: true,
        allow_consignment_with_debt: true
      }
    }),
    prisma.order.aggregate({
      where: {
        tenant_id: tenantId,
        client_id: clientId,
        status: { notIn: [...ORDER_STATUSES_EXCLUDED_FROM_CREDIT_EXPOSURE] }
      },
      _sum: { total_sum: true }
    }),
    prisma.clientBalance.findUnique({
      where: { tenant_id_client_id: { tenant_id: tenantId, client_id: clientId } },
      select: { balance: true }
    }),
    loadDeliveryDebtByClient(tenantId, [clientId]),
    prisma.user.findFirst({
      where: { id: agentUserId, tenant_id: tenantId, role: "agent", is_active: true },
      select: {
        consignment: true,
        consignment_limit_amount: true,
        consignment_ignore_previous_months_debt: true
      }
    }),
    clientHasUnpaidConsignmentDebt(tenantId, clientId)
  ]);

  if (!client) return null;

  const creditLimit = client.credit_limit;
  const ledger = balRow?.balance ?? new Prisma.Decimal(0);
  const accountBalance = mergeLedgerWithUnpaidDelivered(ledger, deliveryMap.get(clientId));
  const openOrders = agg._sum.total_sum ?? new Prisma.Decimal(0);
  const headroom = creditLimit.add(accountBalance);

  let consignmentOutstanding: string | null = null;
  let consignmentLimit: string | null = null;
  const agentConsignment = agent?.consignment === true;

  if (agentConsignment && agent) {
    consignmentLimit = agent.consignment_limit_amount?.toString() ?? null;
    if (consignmentLimit != null) {
      const { year, month } = parseYearMonth(undefined);
      const monthStartsAt = utcMonthStart(year, month);
      const ignorePrev = agent.consignment_ignore_previous_months_debt === true;
      const outstanding = await computeAgentConsignmentOutstanding(prisma, tenantId, agentUserId, {
        ignorePreviousMonthsDebt: ignorePrev,
        monthStartsAt
      });
      consignmentOutstanding = outstanding.toString();
    }
  }

  return {
    credit_limit: creditLimit.toString(),
    account_balance: accountBalance.toString(),
    open_orders_total: openOrders.toString(),
    credit_headroom: headroom.toString(),
    agent_consignment_enabled: agentConsignment,
    consignment_limit_amount: consignmentLimit,
    consignment_outstanding: consignmentOutstanding,
    allow_order_with_debt: client.allow_order_with_debt !== false,
    allow_consignment: client.allow_consignment !== false,
    allow_consignment_with_debt: client.allow_consignment_with_debt !== false,
    has_account_debt: accountBalance.lt(0),
    has_consignment_debt: hasConsignmentDebt
  };
}
