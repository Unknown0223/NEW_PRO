import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { env } from "../../config/env";

export async function resolveByWarehouse(
  tenantId: number,
  selectedWarehouseId: number
): Promise<{
  client_ids: Set<number>;
  agent_ids: Set<number>;
  warehouse_ids: Set<number>;
  cash_desk_ids: Set<number>;
  expeditor_ids: Set<number>;
  product_ids: Set<number>;
}> {
  const [warehouse, links, clientByOrders, agentsByOrders, productByStock] = await Promise.all([
    prisma.warehouse.findFirst({
      where: { id: selectedWarehouseId, tenant_id: tenantId },
      select: { id: true }
    }),
    prisma.warehouseUserLink.findMany({
      where: { warehouse_id: selectedWarehouseId },
      select: { user_id: true, user: { select: { role: true, id: true } } }
    }),
    prisma.order.findMany({
      where: { tenant_id: tenantId, warehouse_id: selectedWarehouseId },
      distinct: ["client_id"],
      select: { client_id: true }
    }),
    prisma.order.findMany({
      where: { tenant_id: tenantId, warehouse_id: selectedWarehouseId, agent_id: { not: null } },
      distinct: ["agent_id"],
      select: { agent_id: true }
    }),
    prisma.stock.findMany({
      where: { tenant_id: tenantId, warehouse_id: selectedWarehouseId },
      distinct: ["product_id"],
      select: { product_id: true }
    })
  ]);
  if (!warehouse) {
    return {
      client_ids: new Set<number>(),
      agent_ids: new Set<number>(),
      warehouse_ids: new Set<number>(),
      cash_desk_ids: new Set<number>(),
      expeditor_ids: new Set<number>(),
      product_ids: new Set<number>()
    };
  }
  const userIds = links.map((r) => r.user_id);
  const agentIds = links.filter((r) => r.user.role === "agent").map((r) => r.user.id);
  for (const r of agentsByOrders) {
    if (r.agent_id != null) agentIds.push(r.agent_id);
  }
  const uniqueAgentIds = [...new Set(agentIds)];
  const expeditor_ids = new Set<number>(
    links.filter((r) => r.user.role === "expeditor").map((r) => r.user.id)
  );

  const [cashLinks, clientsPrimary, clientsSlots, expFromSlots, expFromOrders] = await Promise.all([
    userIds.length
      ? prisma.cashDeskUserLink.findMany({
          where: { user_id: { in: userIds }, cash_desk: { tenant_id: tenantId, is_active: true } },
          distinct: ["cash_desk_id"],
          select: { cash_desk_id: true }
        })
      : Promise.resolve([]),
    uniqueAgentIds.length
      ? prisma.client.findMany({
          where: { tenant_id: tenantId, merged_into_client_id: null, agent_id: { in: uniqueAgentIds } },
          select: { id: true }
        })
      : Promise.resolve([]),
    uniqueAgentIds.length
      ? prisma.clientAgentAssignment.findMany({
          where: { tenant_id: tenantId, agent_id: { in: uniqueAgentIds } },
          distinct: ["client_id"],
          select: { client_id: true }
        })
      : Promise.resolve([]),
    uniqueAgentIds.length
      ? prisma.clientAgentAssignment.findMany({
          where: { tenant_id: tenantId, agent_id: { in: uniqueAgentIds }, expeditor_user_id: { not: null } },
          distinct: ["expeditor_user_id"],
          select: { expeditor_user_id: true }
        })
      : Promise.resolve([]),
    uniqueAgentIds.length
      ? prisma.order.findMany({
          where: { tenant_id: tenantId, agent_id: { in: uniqueAgentIds }, expeditor_user_id: { not: null } },
          distinct: ["expeditor_user_id"],
          select: { expeditor_user_id: true }
        })
      : Promise.resolve([])
  ]);

  const client_ids = new Set<number>(clientByOrders.map((r) => r.client_id));
  for (const r of clientsPrimary) client_ids.add(r.id);
  for (const r of clientsSlots) client_ids.add(r.client_id);
  for (const r of expFromSlots) if (r.expeditor_user_id != null) expeditor_ids.add(r.expeditor_user_id);
  for (const r of expFromOrders) if (r.expeditor_user_id != null) expeditor_ids.add(r.expeditor_user_id);

  return {
    client_ids,
    agent_ids: new Set<number>(uniqueAgentIds),
    warehouse_ids: new Set<number>([selectedWarehouseId]),
    cash_desk_ids: new Set<number>(cashLinks.map((r) => r.cash_desk_id)),
    expeditor_ids,
    product_ids: new Set<number>(productByStock.map((r) => r.product_id))
  };
}

