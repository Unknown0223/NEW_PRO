import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import {
  computeAgentConsignmentOutstanding,
  parseYearMonth,
  utcMonthStart
} from "../consignment/consignment.service";
import { ORDER_STATUSES_EXCLUDED_FROM_CREDIT_EXPOSURE } from "../orders/order-status";
import {
  loadDeliveryDebtByClient,
  mergeLedgerWithUnpaidDelivered
} from "../client-balances/client-balances.service";

export type MobileOrderClientFinance = {
  credit_limit: string;
  account_balance: string;
  open_orders_total: string;
  /** `credit_limit + account_balance` (backend kredit tekshiruvi bilan bir xil). */
  credit_headroom: string;
  agent_consignment_enabled: boolean;
  consignment_limit_amount: string | null;
  consignment_outstanding: string | null;
};

export async function getMobileOrderClientFinance(
  tenantId: number,
  agentUserId: number,
  clientId: number
): Promise<MobileOrderClientFinance | null> {
  const [client, agg, balRow, deliveryMap, agent] = await Promise.all([
    prisma.client.findFirst({
      where: { id: clientId, tenant_id: tenantId, merged_into_client_id: null },
      select: { id: true, credit_limit: true }
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
    })
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
    consignment_outstanding: consignmentOutstanding
  };
}
