import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { appendTenantAuditEvent, AuditEntityType } from "../../lib/tenant-audit";
import { ORDER_STATUSES_OUTSTANDING_RECEIVABLE } from "../orders/order-status";

import type { AgingBucket, ClientAgingOptions } from "./payment-allocations.types";
import { assertTenantAccess } from "./payment-allocations.helpers";

export async function getClientAging(
  tenantId: number,
  options?: ClientAgingOptions
): Promise<AgingBucket[]> {
  await assertTenantAccess(tenantId);

  const asOfDate = options?.asOf ? new Date(options.asOf) : new Date();

  // Helper: difference in days between asOf and order date
  const toDays = (d: Date): number =>
    Math.floor((asOfDate.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));

  /** As-of sanasigacha bo‘lgan yozuvlar — kelajakdagi tranzaksiyalar yukni oshirmaydi. */
  const asOfFilter = { lte: asOfDate };

  const [orders, payments, allocations] = await Promise.all([
    prisma.order.findMany({
      where: { tenant_id: tenantId, created_at: asOfFilter },
      select: {
        id: true,
        client_id: true,
        total_sum: true,
        created_at: true
      }
    }),
    prisma.payment.findMany({
      where: { tenant_id: tenantId, deleted_at: null, created_at: asOfFilter },
      select: {
        client_id: true,
        amount: true,
        created_at: true
      }
    }),
    prisma.paymentAllocation.findMany({
      where: { tenant_id: tenantId, created_at: asOfFilter },
      select: { order_id: true, amount: true, created_at: true }
    })
  ]);

  // Aggregate per client
  const clientData = new Map<number, {
    clientName?: string;
    orderTotal: Prisma.Decimal;
    paymentTotal: Prisma.Decimal;
    buckets: { current: Prisma.Decimal; b30: Prisma.Decimal; b60: Prisma.Decimal; b90: Prisma.Decimal; b120: Prisma.Decimal };
  }>();

  // Build allocated map per order
  const allocatedPerOrder = new Map<number, Prisma.Decimal>();
  for (const alloc of allocations) {
    const prev = allocatedPerOrder.get(alloc.order_id) ?? new Prisma.Decimal(0);
    allocatedPerOrder.set(alloc.order_id, prev.add(alloc.amount));
  }

  // Process orders: only include outstanding (unallocated) amounts in aging
  const orderIds = new Set(orders.map((o) => o.client_id));
  for (const clientId of orderIds) {
    if (!clientData.has(clientId)) {
      clientData.set(clientId, {
        orderTotal: new Prisma.Decimal(0),
        paymentTotal: new Prisma.Decimal(0),
        buckets: {
          current: new Prisma.Decimal(0),
          b30: new Prisma.Decimal(0),
          b60: new Prisma.Decimal(0),
          b90: new Prisma.Decimal(0),
          b120: new Prisma.Decimal(0)
        }
      });
    }
  }

  // Sum order totals per client
  for (const order of orders) {
    const cd = clientData.get(order.client_id);
    if (!cd) continue;
    cd.orderTotal = cd.orderTotal.add(order.total_sum);

    const allocated = allocatedPerOrder.get(order.id) ?? new Prisma.Decimal(0);
    const outstanding = order.total_sum.sub(allocated);
    if (outstanding.lte(0)) continue;

    // Determine day bucket based on order creation date
    const days = toDays(order.created_at);
    if (days <= 30) {
      cd.buckets.current = cd.buckets.current.add(outstanding);
    } else if (days <= 60) {
      cd.buckets.b30 = cd.buckets.b30.add(outstanding);
    } else if (days <= 90) {
      cd.buckets.b60 = cd.buckets.b60.add(outstanding);
    } else if (days <= 120) {
      cd.buckets.b90 = cd.buckets.b90.add(outstanding);
    } else {
      cd.buckets.b120 = cd.buckets.b120.add(outstanding);
    }
  }

  // Sum payment totals per client
  for (const payment of payments) {
    const cd = clientData.get(payment.client_id);
    if (!cd) continue;
    cd.paymentTotal = cd.paymentTotal.add(payment.amount);
  }

  // Fetch client names
  const clientIds = Array.from(clientData.keys());
  const clients =
    clientIds.length > 0
      ? await prisma.client.findMany({
          where: { id: { in: clientIds } },
          select: { id: true, name: true }
        })
      : [];
  const clientNameMap = new Map(clients.map((c) => [c.id, c.name]));

  // Build result
  const result: AgingBucket[] = Array.from(clientData.entries())
    .map(([clientId, data]) => {
      const outstanding = data.orderTotal.sub(data.paymentTotal);
      return {
        client_id: clientId,
        client_name: clientNameMap.get(clientId) ?? `Client #${clientId}`,
        total_orders: data.orderTotal.toString(),
        total_payments: data.paymentTotal.toString(),
        outstanding: outstanding.toString(),
        current: data.buckets.current.toString(),
        bucket_30: data.buckets.b30.toString(),
        bucket_60: data.buckets.b60.toString(),
        bucket_90: data.buckets.b90.toString(),
        bucket_120: data.buckets.b120.toString()
      };
    })
    .sort((a, b) => b.outstanding.localeCompare(a.outstanding));

  return result;
}

