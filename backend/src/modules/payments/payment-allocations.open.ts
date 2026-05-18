import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { appendTenantAuditEvent, AuditEntityType } from "../../lib/tenant-audit";
import { ORDER_STATUSES_OUTSTANDING_RECEIVABLE } from "../orders/order-status";

import type { AllocationMode, OpenAllocationOrderRow } from "./payment-allocations.types";
import {
  dueSortTime,
  getAllocatedForOrder,
  normalizeAllocationMode
} from "./payment-allocations.helpers";

export type AllocationCandidateOrder = {
  id: number;
  number: string;
  total_sum: Prisma.Decimal;
  created_at: Date;
  consignment_due_date: Date | null;
  is_consignment: boolean;
};


export async function listOpenOrdersForAllocation(
  tenantId: number,
  args: {
    client_id: number;
    agent_id?: number | null;
    mode?: AllocationMode;
  }
): Promise<OpenAllocationOrderRow[]> {
  const mode = normalizeAllocationMode(args.mode);
  const clientId = Number(args.client_id);
  if (!Number.isFinite(clientId) || clientId < 1) return [];
  const agentId =
    args.agent_id != null && Number.isFinite(args.agent_id) && args.agent_id > 0
      ? Number(args.agent_id)
      : null;

  const andMode =
    mode === "cash"
      ? Prisma.sql`AND COALESCE(o.is_consignment, false) = false`
      : mode === "consignment"
        ? Prisma.sql`AND o.is_consignment = true`
        : Prisma.empty;

  const andAgent =
    agentId != null ? Prisma.sql`AND o.agent_id = ${agentId}` : Prisma.empty;

  const rows = await prisma.$queryRaw<
    Array<{
      order_id: number;
      order_number: string;
      created_at: Date;
      consignment_due_date: Date | null;
      is_consignment: boolean;
      outstanding: Prisma.Decimal;
    }>
  >`
    WITH ord AS (
      SELECT o.id, o.number, o.created_at, o.consignment_due_date, o.is_consignment, o.total_sum
      FROM orders o
      WHERE o.tenant_id = ${tenantId}
        AND o.client_id = ${clientId}
        AND o.order_type = 'order'
        AND o.status IN (${Prisma.join([...ORDER_STATUSES_OUTSTANDING_RECEIVABLE])})
        ${andMode}
        ${andAgent}
    ),
    alloc AS (
      SELECT pa.order_id, SUM(pa.amount)::decimal(15,2) AS allocated
      FROM payment_allocations pa
      WHERE pa.tenant_id = ${tenantId}
        AND pa.order_id IN (SELECT id FROM ord)
      GROUP BY pa.order_id
    )
    SELECT
      o.id AS order_id,
      o.number AS order_number,
      o.created_at,
      o.consignment_due_date,
      COALESCE(o.is_consignment, false) AS is_consignment,
      GREATEST(o.total_sum - COALESCE(a.allocated, 0), 0)::decimal(15,2) AS outstanding
    FROM ord o
    LEFT JOIN alloc a ON a.order_id = o.id
    WHERE GREATEST(o.total_sum - COALESCE(a.allocated, 0), 0) > 0
    ORDER BY COALESCE(o.consignment_due_date, o.created_at) ASC, o.created_at ASC, o.id ASC
  `;

  return rows.map((r) => ({
    order_id: r.order_id,
    order_number: r.order_number,
    created_at: r.created_at.toISOString(),
    consignment_due_date: r.consignment_due_date?.toISOString() ?? null,
    is_consignment: r.is_consignment,
    outstanding: r.outstanding.toString()
  }));
}

export async function getCandidateOrdersForAllocation(
  tx: Prisma.TransactionClient,
  tenantId: number,
  args: {
    client_id: number;
    agent_id?: number | null;
    mode: AllocationMode;
    order_ids?: number[];
  }
): Promise<AllocationCandidateOrder[]> {
  const mode = normalizeAllocationMode(args.mode);
  const orderIds = (args.order_ids ?? []).filter((id) => Number.isFinite(id) && id > 0);
  const where: Prisma.OrderWhereInput = {
    tenant_id: tenantId,
    client_id: args.client_id,
    order_type: "order",
    status: { in: [...ORDER_STATUSES_OUTSTANDING_RECEIVABLE] }
  };

  if (args.agent_id != null && Number.isFinite(args.agent_id) && args.agent_id > 0) {
    where.agent_id = args.agent_id;
  }
  if (mode === "cash") where.is_consignment = false;
  if (mode === "consignment") where.is_consignment = true;
  if (orderIds.length > 0) where.id = { in: orderIds };

  const rows = await tx.order.findMany({
    where,
    select: {
      id: true,
      number: true,
      total_sum: true,
      created_at: true,
      consignment_due_date: true,
      is_consignment: true
    }
  });

  const out: AllocationCandidateOrder[] = [];
  for (const row of rows) {
    const alreadyAllocatedToOrder = await getAllocatedForOrder(tx, tenantId, row.id);
    const orderRemaining = row.total_sum.sub(alreadyAllocatedToOrder);
    if (orderRemaining.lte(0)) continue;
    out.push(row);
  }

  out.sort((a, b) => {
    const d = dueSortTime(a) - dueSortTime(b);
    if (d !== 0) return d;
    if (a.created_at.getTime() !== b.created_at.getTime()) {
      return a.created_at.getTime() - b.created_at.getTime();
    }
    return a.id - b.id;
  });

  if (orderIds.length > 0) {
    const rank = new Map<number, number>();
    orderIds.forEach((id, idx) => {
      if (!rank.has(id)) rank.set(id, idx);
    });
    out.sort((a, b) => {
      const ra = rank.get(a.id);
      const rb = rank.get(b.id);
      if (ra != null && rb != null) return ra - rb;
      if (ra != null) return -1;
      if (rb != null) return 1;
      return 0;
    });
  }

  return out;
}
