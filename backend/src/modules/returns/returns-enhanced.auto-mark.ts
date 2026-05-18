import { randomUUID } from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma } from "../../config/database";
import { emitOrderUpdated } from "../../lib/order-event-bus";
import { invalidateDashboard, invalidateStock } from "../../lib/redis-cache";
import { appendTenantAuditEvent, AuditEntityType } from "../../lib/tenant-audit";
import { assertReturnProductsInterchangeableStrict } from "../products/product-catalog.service";
import { canTransitionOrderStatus, normalizeOrderType } from "../orders/order-status";

import { localDayEnd, localDayStart } from "./returns-enhanced.helpers";

export async function autoMarkReturnedOrders(
  tenantId: number, clientId: number,
  dateFrom?: string, dateTo?: string,
  actorUserId: number | null = null
): Promise<void> {
  const orderWhere: Prisma.OrderWhereInput = {
    tenant_id: tenantId, client_id: clientId,
    status: { notIn: ["cancelled", "returned"] }
  };
  if (dateFrom) orderWhere.created_at = { gte: localDayStart(dateFrom) };
  if (dateTo) orderWhere.created_at = { ...(orderWhere.created_at as object) ?? {}, lte: localDayEnd(dateTo) };

  const orders = await prisma.order.findMany({
    where: orderWhere,
    orderBy: { created_at: "asc" },
    select: { id: true, status: true, order_type: true, items: { select: { product_id: true, qty: true } } }
  });
  if (orders.length === 0) return;

  const orderIds = orders.map((o) => o.id);
  const linkedReturns = await prisma.salesReturn.findMany({
    where: { tenant_id: tenantId, client_id: clientId, order_id: { in: orderIds }, status: "posted" },
    select: { order_id: true, lines: { select: { product_id: true, qty: true } } }
  });
  const linkedByOrderId = new Map<number, typeof linkedReturns>();
  for (const r of linkedReturns) {
    if (r.order_id == null) continue;
    const arr = linkedByOrderId.get(r.order_id) ?? [];
    arr.push(r);
    linkedByOrderId.set(r.order_id, arr);
  }

  /** Sana filtri bo‘lsa — `order_id`siz polki qaytarishlarni FIFO bilan zakazlarga taqsimlash. */
  const useFifoPool = dateFrom != null || dateTo != null;
  const pool = new Map<number, number>();
  if (useFifoPool) {
    const unlinkedWhere: Prisma.SalesReturnWhereInput = {
      tenant_id: tenantId,
      client_id: clientId,
      status: "posted",
      order_id: null
    };
    if (dateFrom) unlinkedWhere.created_at = { gte: localDayStart(dateFrom) };
    if (dateTo) {
      unlinkedWhere.created_at = {
        ...(unlinkedWhere.created_at as object) ?? {},
        lte: localDayEnd(dateTo)
      };
    }
    const unlinked = await prisma.salesReturn.findMany({
      where: unlinkedWhere,
      orderBy: { created_at: "asc" },
      select: { lines: { select: { product_id: true, qty: true } } }
    });
    for (const ret of unlinked) {
      for (const ln of ret.lines) {
        pool.set(ln.product_id, (pool.get(ln.product_id) ?? 0) + Number(ln.qty));
      }
    }
  }

  for (const ord of orders) {
    const orderedQty = new Map<number, number>();
    for (const item of ord.items) {
      orderedQty.set(item.product_id, (orderedQty.get(item.product_id) ?? 0) + Number(item.qty));
    }

    const returnedQty = new Map<number, number>();
    for (const ret of linkedByOrderId.get(ord.id) ?? []) {
      for (const ln of ret.lines) {
        returnedQty.set(ln.product_id, (returnedQty.get(ln.product_id) ?? 0) + Number(ln.qty));
      }
    }

    if (useFifoPool) {
      for (const [pid, ordQty] of orderedQty) {
        const have = returnedQty.get(pid) ?? 0;
        const need = Math.max(0, ordQty - have);
        if (need <= 0) continue;
        const avail = pool.get(pid) ?? 0;
        const take = Math.min(need, avail);
        if (take > 0) {
          returnedQty.set(pid, have + take);
          pool.set(pid, avail - take);
        }
      }
    }

    const allReturned = [...orderedQty.keys()].every((pid) => {
      const need = orderedQty.get(pid) ?? 0;
      const ret = returnedQty.get(pid) ?? 0;
      return ret >= need;
    });

    const otype = normalizeOrderType(ord.order_type);
    if (allReturned && canTransitionOrderStatus(ord.status, "returned", otype)) {
      await prisma.order.update({ where: { id: ord.id }, data: { status: "returned" } });
      await prisma.orderStatusLog.create({
        data: { order_id: ord.id, from_status: ord.status, to_status: "returned", user_id: actorUserId }
      });
    }
  }
}
