import { prisma } from "../../config/database";
import {
  agentScopedOrderWhere,
  applyMobileSyncGate,
  assertAgentScopedClient,
  assertMobilePhotoReportForClient,
  loadAgentMobileConfig,
  type PresenceOpts
} from "./mobile-agent-sync.config.service";
import {
  compactPrice,
  compactProduct,
  fetchSyncClients,
  fetchSyncOrders
} from "./mobile-agent-sync.full.service";

export async function syncDelta(
  tenantId: number,
  userId: number,
  lastSyncAt: Date | null,
  entityType?: "clients" | "products" | "prices" | "orders",
  presence?: PresenceOpts
) {
  await applyMobileSyncGate(tenantId, userId, presence);
  const since: Date = lastSyncAt ?? new Date(0);
  const now = new Date();
  let result: Record<string, unknown> = {};

  switch (entityType) {
    case "clients": {
      result.clients = await fetchSyncClients(tenantId, userId, since);
      break;
    }
    case "products": {
      const rows = await prisma.product.findMany({
        where: {
          tenant_id: tenantId,
          is_active: true,
          ...(since.getTime() > 0 ? { updated_at: { gt: since } } : {})
        },
        select: {
          id: true,
          sku: true,
          name: true,
          unit: true,
          barcode: true,
          category_id: true,
          brand_id: true,
          is_active: true,
          weight_kg: true,
          sell_code: true,
          updated_at: true
        },
        take: 5000
      });
      result.products = rows.map(compactProduct);
      break;
    }
    case "prices": {
      const rows = await prisma.productPrice.findMany({
        where: {
          tenant_id: tenantId,
          ...(since.getTime() > 0 ? { updated_at: { gt: since } } : {})
        },
        select: { product_id: true, price_type: true, price: true },
        take: 20000
      });
      result.prices = rows.map(compactPrice);
      break;
    }
    case "orders": {
      result.orders = await fetchSyncOrders(tenantId, userId, since);
      break;
    }
    default:
      break;
  }

  await prisma.user.update({
    where: { id: userId },
    data: { last_sync_at: now }
  });

  return { sync_at: now.toISOString(), ...result };
}

export async function enqueueOrder(
  tenantId: number,
  userId: number,
  clientLocalId: string | number,
  warehouseId: number,
  items: { product_id: number; qty: number; price?: number }[],
  offlineCreatedAt: Date,
  opts?: { price_type?: string; comment?: string | null }
) {
  const clientId =
    typeof clientLocalId === "number"
      ? clientLocalId
      : Number.parseInt(String(clientLocalId), 10);
  if (!Number.isFinite(clientId) || clientId < 1) throw new Error("BAD_CLIENT");

  const cfg = await loadAgentMobileConfig(tenantId, userId);
  await assertAgentScopedClient(tenantId, userId, clientId);
  await assertMobilePhotoReportForClient(tenantId, userId, clientId, cfg);

  const wh = await prisma.warehouse.findFirst({
    where: { id: warehouseId, tenant_id: tenantId },
    select: { id: true }
  });
  if (!wh) throw new Error("BAD_WAREHOUSE");

  const now = new Date();
  const tempNumber = `OFF-${now.getTime()}`;
  const order = await prisma.order.create({
    data: {
      tenant_id: tenantId,
      number: tempNumber,
      client_id: clientId,
      agent_id: userId,
      warehouse_id: warehouseId,
      status: "pending_sync",
      total_sum: 0,
      bonus_sum: 0,
      comment: opts?.comment?.trim() || null,
      created_at: offlineCreatedAt,
      updated_at: now,
      items: {
        create: items.map((it) => ({
          product_id: it.product_id,
          qty: it.qty,
          price: it.price ?? 0,
          total: 0,
          is_bonus: false
        }))
      },
      change_logs: {
        create: {
          user_id: userId,
          action: "offline_enqueue",
          payload: {
            offline_created_at: offlineCreatedAt.toISOString(),
            price_type: (opts?.price_type ?? "").trim() || "retail"
          }
        }
      }
    },
    select: { id: true, number: true, status: true, created_at: true }
  });

  return order;
}

export async function getPendingCount(tenantId: number, userId: number) {
  const count = await prisma.order.count({
    where: {
      ...agentScopedOrderWhere(tenantId, userId),
      status: "pending_sync"
    }
  });
  return { pending: count };
}

export async function syncOrders(tenantId: number, userId: number) {
  const offlineOrders = await prisma.order.findMany({
    where: {
      ...agentScopedOrderWhere(tenantId, userId),
      status: "pending_sync"
    },
    include: { items: true },
    orderBy: { created_at: "asc" }
  });

  if (offlineOrders.length === 0) {
    return { synced: 0, results: [] };
  }

  const results: { clientLocalId: number; serverId: number; serverNumber: string }[] = [];

  await prisma.$transaction(async (tx) => {
    for (const order of offlineOrders) {
      let totalSum = 0;
      for (const item of order.items) {
        const total = Number(item.qty) * Number(item.price);
        totalSum += total;
        await tx.orderItem.update({ where: { id: item.id }, data: { total } });
      }

      const serverNumber = String(order.id);
      await tx.order.update({
        where: { id: order.id },
        data: { number: serverNumber, status: "new", total_sum: totalSum, updated_at: new Date() }
      });

      results.push({
        clientLocalId: order.client_id,
        serverId: order.id,
        serverNumber
      });
    }
  });

  return { synced: results.length, results };
}
