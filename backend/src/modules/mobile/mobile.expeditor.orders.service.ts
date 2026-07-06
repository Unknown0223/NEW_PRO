/**
 * Mobil ekspeditor — yetkazishlar, zakaz holati, mijoz koordinatasi.
 */
import { prisma } from "../../config/database";
import { updateClientFields } from "../clients/clients.service";
import { updateOrderStatus } from "../orders/domain/order.lifecycle";
import { getAllowedNextStatuses, normalizeOrderType } from "../orders/order-status";
import { listOrdersPaged } from "../orders/orders.service";
import { resolveMobileConfigForUser } from "../staff/agent-mobile-config.defaults";
import type { AgentMobileConfigV1 } from "../staff/agent-mobile-config.types";

export async function loadExpeditorMobileConfig(
  tenantId: number,
  expeditorUserId: number
): Promise<AgentMobileConfigV1> {
  const u = await prisma.user.findFirst({
    where: { id: expeditorUserId, tenant_id: tenantId, role: "expeditor", is_active: true },
    select: { role: true, agent_entitlements: true }
  });
  if (!u) throw new Error("NOT_FOUND");
  return resolveMobileConfigForUser(u.role ?? "expeditor", u.agent_entitlements);
}

export async function assertExpeditorOwnsOrder(
  tenantId: number,
  expeditorUserId: number,
  orderId: number
) {
  const row = await prisma.order.findFirst({
    where: { id: orderId, tenant_id: tenantId, expeditor_user_id: expeditorUserId },
    select: {
      id: true,
      client_id: true,
      agent_id: true,
      status: true,
      order_type: true,
      comment: true,
      total_sum: true,
      is_consignment: true
    }
  });
  if (!row) throw new Error("NOT_FOUND");
  return row;
}

function tradeDirectionAllowed(
  cfg: AgentMobileConfigV1,
  tradeDirectionId: number | null | undefined
): boolean {
  const allowed = cfg.expeditor?.allowed_trade_direction_ids;
  if (!allowed || allowed.length === 0) return true;
  if (tradeDirectionId == null || tradeDirectionId < 1) return false;
  return allowed.includes(tradeDirectionId);
}

/** Ekspeditor yetkazishlar ro'yxati (mijoz manzili bilan). */
export async function listMobileExpeditorDeliveries(
  tenantId: number,
  expeditorUserId: number,
  opts: { page?: number; limit?: number; status?: string }
) {
  const cfg = await loadExpeditorMobileConfig(tenantId, expeditorUserId);
  const result = await listOrdersPaged(
    tenantId,
    {
      page: opts.page ?? 1,
      limit: Math.min(opts.limit ?? 50, 100),
      status: opts.status?.trim() || undefined,
      expeditor_user_id: expeditorUserId,
      order_type: "order"
    },
    "expeditor",
    expeditorUserId
  );

  const allowedDirs = cfg.expeditor?.allowed_trade_direction_ids;
  let data = result.data;
  if (allowedDirs && allowedDirs.length > 0) {
    const dirSet = new Set(allowedDirs);
    const orderIds = data.map((o) => o.id);
    if (orderIds.length > 0) {
      const rows = await prisma.order.findMany({
        where: { tenant_id: tenantId, id: { in: orderIds } },
        select: {
          id: true,
          agent: { select: { trade_direction_id: true } }
        }
      });
      const dirByOrder = new Map(rows.map((r) => [r.id, r.agent?.trade_direction_id ?? null]));
      data = data.filter((o) => {
        const td = dirByOrder.get(o.id) ?? null;
        return tradeDirectionAllowed(cfg, td);
      });
    }
  }

  return {
    ...result,
    data: data.map((o) => ({
      id: o.id,
      number: o.number,
      status: o.status,
      client_id: o.client_id,
      client_name: o.client_name,
      client_phone: o.client_phone,
      address: [o.city, o.zone, o.region].filter(Boolean).join(", ") || null,
      total_sum: o.total_sum,
      debt: o.debt,
      delivered_at: o.delivered_at,
      expected_ship_date: o.expected_ship_date
    }))
  };
}

/** Bitta yetkazish — mahsulotlar, mijoz, keyingi holatlar. */
export async function getMobileExpeditorOrderDetail(
  tenantId: number,
  expeditorUserId: number,
  orderId: number
) {
  await assertExpeditorOwnsOrder(tenantId, expeditorUserId, orderId);
  const row = await prisma.order.findFirst({
    where: { id: orderId, tenant_id: tenantId, expeditor_user_id: expeditorUserId },
    select: {
      id: true,
      number: true,
      order_type: true,
      status: true,
      total_sum: true,
      bonus_sum: true,
      discount_sum: true,
      comment: true,
      created_at: true,
      is_consignment: true,
      client: {
        select: {
          id: true,
          name: true,
          phone: true,
          address: true,
          city: true,
          region: true,
          zone: true,
          latitude: true,
          longitude: true
        }
      },
      items: {
        select: {
          id: true,
          qty: true,
          price: true,
          total: true,
          is_bonus: true,
          product: { select: { id: true, name: true, sku: true } }
        },
        orderBy: [{ is_bonus: "asc" }, { id: "asc" }]
      }
    }
  });
  if (!row) throw new Error("NOT_FOUND");

  const orderType = normalizeOrderType(row.order_type);
  const items = row.items.map((i) => ({
    id: i.id,
    product_id: i.product.id,
    product_name: i.product.name,
    sku: i.product.sku,
    qty: Number(i.qty),
    price: Number(i.price),
    total: Number(i.total),
    is_bonus: i.is_bonus
  }));

  const existingPayments = await prisma.payment.findMany({
    where: {
      tenant_id: tenantId,
      order_id: orderId,
      deleted_at: null,
      entry_kind: "payment"
    },
    select: {
      id: true,
      amount: true,
      payment_type: true,
      paid_at: true,
      received_at: true,
      created_at: true,
      workflow_status: true
    }
  });

  return {
    id: row.id,
    number: row.number,
    order_type: row.order_type ?? "order",
    status: row.status,
    comment: row.comment,
    is_consignment: row.is_consignment === true,
    created_at: row.created_at.toISOString(),
    total_sum: Number(row.total_sum),
    bonus_sum: Number(row.bonus_sum),
    discount_sum: Number(row.discount_sum),
    client: {
      id: row.client.id,
      name: row.client.name,
      phone: row.client.phone,
      address: row.client.address,
      city: row.client.city,
      region: row.client.region,
      zone: row.client.zone,
      latitude: row.client.latitude != null ? Number(row.client.latitude) : null,
      longitude: row.client.longitude != null ? Number(row.client.longitude) : null
    },
    items,
    payments: existingPayments.map((p) => ({
      id: p.id,
      amount: Number(p.amount),
      payment_type: p.payment_type,
      paid_at: p.paid_at?.toISOString() ?? null,
      received_at: p.received_at?.toISOString() ?? null,
      created_at: p.created_at.toISOString(),
      workflow_status: String(p.workflow_status ?? "confirmed")
    })),
    allowed_next_statuses: getAllowedNextStatuses(row.status, {
      omitBackward: true,
      orderType
    })
  };
}

export async function patchMobileExpeditorOrderStatus(
  tenantId: number,
  expeditorUserId: number,
  orderId: number,
  nextStatus: string,
  reason?: string | null
) {
  await assertExpeditorOwnsOrder(tenantId, expeditorUserId, orderId);
  const row = await updateOrderStatus(tenantId, orderId, nextStatus, expeditorUserId, "expeditor");

  // Vazvrat sababini jurnalga yozamiz (audit + keyinroq ko'rsatish uchun).
  const trimmedReason = reason != null && String(reason).trim() ? String(reason).trim().slice(0, 500) : null;
  if (nextStatus.trim() === "returned" && trimmedReason) {
    await prisma.orderChangeLog.create({
      data: {
        order_id: orderId,
        user_id: expeditorUserId,
        action: "return_reason",
        payload: { reason: trimmedReason, source: "mobile_expeditor" }
      }
    });
  }
  return row;
}

/** Qisman / to'liq qaytarish — holat `returned`. */
export async function createMobileExpeditorPartialReturn(
  tenantId: number,
  expeditorUserId: number,
  orderId: number,
  input: {
    reason: string;
    note?: string | null;
    items?: Array<{ order_item_id: number; qty: number }>;
  }
) {
  const cfg = await loadExpeditorMobileConfig(tenantId, expeditorUserId);
  if (cfg.orders?.allow_partial_return_edit === false) throw new Error("RETURN_DISABLED");

  const order = await assertExpeditorOwnsOrder(tenantId, expeditorUserId, orderId);
  if (order.status !== "delivered") throw new Error("BAD_STATUS");

  const reason = input.reason.trim();
  if (!reason) throw new Error("BAD_REASON");

  let itemsNote = "";
  if (input.items?.length) {
    const orderItems = await prisma.orderItem.findMany({
      where: { order_id: orderId, order: { tenant_id: tenantId } },
      select: {
        id: true,
        qty: true,
        product: { select: { sku: true, name: true } }
      }
    });
    const byId = new Map(orderItems.map((i) => [i.id, i]));
    const lines: string[] = [];
    for (const row of input.items) {
      const line = byId.get(row.order_item_id);
      if (!line) throw new Error("BAD_RETURN_ITEM");
      const maxQty = Number(line.qty);
      if (!Number.isFinite(row.qty) || row.qty <= 0 || row.qty > maxQty) {
        throw new Error("BAD_RETURN_QTY");
      }
      lines.push(`${line.product.sku} ${line.product.name}: ${row.qty}/${maxQty}`);
    }
    itemsNote = lines.join("; ");
  }

  const noteParts = [`qaytarish: ${reason}`];
  if (itemsNote) noteParts.push(`qatorlar: ${itemsNote}`);
  if (input.note?.trim()) noteParts.push(input.note.trim());
  const noteLine = `[${noteParts.join(" | ")}]`;
  const nextComment = order.comment?.trim() ? `${order.comment.trim()}\n${noteLine}` : noteLine;
  await prisma.order.update({
    where: { id: orderId },
    data: { comment: nextComment }
  });

  return updateOrderStatus(tenantId, orderId, "returned", expeditorUserId, "expeditor");
}

/** Avtomobildan qayta yuklash — `delivered` → `delivering`. */
export async function createMobileExpeditorReloadFromVehicle(
  tenantId: number,
  expeditorUserId: number,
  orderId: number,
  input: { note?: string | null }
) {
  const cfg = await loadExpeditorMobileConfig(tenantId, expeditorUserId);
  if (cfg.orders?.allow_reload_from_vehicle === false) throw new Error("RELOAD_DISABLED");

  const order = await assertExpeditorOwnsOrder(tenantId, expeditorUserId, orderId);
  if (order.status !== "delivered") throw new Error("BAD_STATUS");

  if (input.note?.trim()) {
    const noteLine = `[dogruzka] ${input.note.trim()}`;
    const nextComment = order.comment?.trim() ? `${order.comment.trim()}\n${noteLine}` : noteLine;
    await prisma.order.update({
      where: { id: orderId },
      data: { comment: nextComment }
    });
  }

  const updated = await updateOrderStatus(
    tenantId,
    orderId,
    "delivering",
    expeditorUserId,
    "expeditor"
  );
  return { id: updated.id, status: updated.status, number: updated.number };
}

/** Mijoz koordinatasi (config ruxsat bersa). */
export async function patchMobileExpeditorClientLocation(
  tenantId: number,
  expeditorUserId: number,
  clientId: number,
  patch: { latitude: number; longitude: number }
) {
  const cfg = await loadExpeditorMobileConfig(tenantId, expeditorUserId);
  if (cfg.client?.can_change_client_location !== true) throw new Error("LOCATION_FORBIDDEN");

  const orderLink = await prisma.order.findFirst({
    where: {
      tenant_id: tenantId,
      expeditor_user_id: expeditorUserId,
      client_id: clientId
    },
    select: { id: true }
  });
  if (!orderLink) throw new Error("NOT_FOUND");

  await updateClientFields(
    tenantId,
    clientId,
    {
      latitude: patch.latitude,
      longitude: patch.longitude
    },
    expeditorUserId
  );

  const row = await prisma.client.findFirst({
    where: { id: clientId, tenant_id: tenantId },
    select: { id: true, latitude: true, longitude: true }
  });
  if (!row) throw new Error("NOT_FOUND");
  return {
    id: row.id,
    latitude: row.latitude != null ? Number(row.latitude) : null,
    longitude: row.longitude != null ? Number(row.longitude) : null
  };
}
