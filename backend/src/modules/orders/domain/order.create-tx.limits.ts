import { Prisma } from "@prisma/client";
import {
  computeAgentConsignmentOutstanding,
  parseYearMonth,
  utcMonthStart
} from "../../consignment/consignment.service";
import { ORDER_STATUSES_EXCLUDED_FROM_CREDIT_EXPOSURE } from "../order-status";
import type { CreateOrderTxParams } from "./order.create-tx.types";

export type CreateOrderLimitsResult = {
  isConsignmentOrder: boolean;
  consignmentDueDate: Date | null;
};

export async function assertCreateOrderLimitsInTransaction(
  tx: Prisma.TransactionClient,
  p: CreateOrderTxParams,
  paidTotal: Prisma.Decimal
): Promise<CreateOrderLimitsResult> {
  const { tenantId, input, client, orderType, isInboundShelfReturn } = p;

  const creditLimit = client.credit_limit;
  if (!isInboundShelfReturn && orderType !== "exchange" && creditLimit.gt(0)) {
    const balRow = await tx.clientBalance.findUnique({
      where: { tenant_id_client_id: { tenant_id: tenantId, client_id: client.id } },
      select: { balance: true }
    });
    const accountBalance = balRow?.balance ?? new Prisma.Decimal(0);
    const headroom = creditLimit.add(accountBalance);
    const agg = await tx.order.aggregate({
      where: {
        tenant_id: tenantId,
        client_id: client.id,
        status: { notIn: [...ORDER_STATUSES_EXCLUDED_FROM_CREDIT_EXPOSURE] }
      },
      _sum: { total_sum: true }
    });
    const outstanding = agg._sum.total_sum ?? new Prisma.Decimal(0);
    const projected = outstanding.add(paidTotal);
    if (projected.gt(headroom)) {
      const err = new Error("CREDIT_LIMIT_EXCEEDED") as Error & {
        credit_limit: string;
        outstanding: string;
        order_total: string;
      };
      err.credit_limit = headroom.toString();
      err.outstanding = outstanding.toString();
      err.order_total = paidTotal.toString();
      throw err;
    }
  }

  const isConsignmentOrder =
    !isInboundShelfReturn && orderType !== "exchange" && (input.is_consignment ?? false);
  let consignmentDueDate: Date | null = null;
  if (isConsignmentOrder && input.consignment_due_date?.trim()) {
    const d = new Date(input.consignment_due_date.trim());
    if (Number.isNaN(d.getTime())) {
      throw new Error("BAD_CONSIGNMENT_DUE_DATE");
    }
    consignmentDueDate = d;
  }

  if (isConsignmentOrder) {
    if (input.agent_id == null || input.agent_id <= 0) {
      throw new Error("CONSIGNMENT_REQUIRES_AGENT");
    }
    const ag = await tx.user.findFirst({
      where: {
        id: input.agent_id,
        tenant_id: tenantId,
        role: "agent",
        is_active: true
      },
      select: {
        consignment: true,
        consignment_limit_amount: true,
        consignment_ignore_previous_months_debt: true
      }
    });
    if (!ag) {
      throw new Error("BAD_AGENT");
    }
    if (!ag.consignment) {
      throw new Error("CONSIGNMENT_AGENT_DISABLED");
    }
    const lim = ag.consignment_limit_amount;
    if (lim != null) {
      const { year, month } = parseYearMonth(undefined);
      const monthStartsAt = utcMonthStart(year, month);
      const ignorePrev = lim != null && ag.consignment_ignore_previous_months_debt === true;
      const outstanding = await computeAgentConsignmentOutstanding(tx, tenantId, input.agent_id, {
        ignorePreviousMonthsDebt: ignorePrev,
        monthStartsAt
      });
      const projected = outstanding.add(paidTotal);
      if (projected.gt(lim)) {
        const err = new Error("CONSIGNMENT_LIMIT_EXCEEDED") as Error & {
          consignment_limit?: string;
          outstanding?: string;
          order_total?: string;
        };
        err.consignment_limit = lim.toString();
        err.outstanding = outstanding.toString();
        err.order_total = paidTotal.toString();
        throw err;
      }
    }
  }

  return { isConsignmentOrder, consignmentDueDate };
}
