import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { env } from "../../config/env";

export async function resolveByExpeditor(
  tenantId: number,
  selectedExpeditorUserId: number
): Promise<{
  client_ids: Set<number>;
  agent_ids: Set<number>;
  warehouse_ids: Set<number>;
  cash_desk_ids: Set<number>;
  expeditor_ids: Set<number>;
  product_ids: Set<number>;
}> {
  const [expeditor, clientsByAssign, clientsByOrders, agentsByAssign, agentsByOrders, whLinks, cashLinks, productByOrders] =
    await Promise.all([
      prisma.user.findFirst({
        where: { tenant_id: tenantId, id: selectedExpeditorUserId, role: "expeditor", is_active: true },
        select: { id: true }
      }),
      prisma.clientAgentAssignment.findMany({
        where: { tenant_id: tenantId, expeditor_user_id: selectedExpeditorUserId },
        distinct: ["client_id"],
        select: { client_id: true }
      }),
      prisma.order.findMany({
        where: { tenant_id: tenantId, expeditor_user_id: selectedExpeditorUserId },
        distinct: ["client_id"],
        select: { client_id: true }
      }),
      prisma.clientAgentAssignment.findMany({
        where: {
          tenant_id: tenantId,
          expeditor_user_id: selectedExpeditorUserId,
          agent_id: { not: null }
        },
        distinct: ["agent_id"],
        select: { agent_id: true }
      }),
      prisma.order.findMany({
        where: { tenant_id: tenantId, expeditor_user_id: selectedExpeditorUserId, agent_id: { not: null } },
        distinct: ["agent_id"],
        select: { agent_id: true }
      }),
      prisma.warehouseUserLink.findMany({
        where: { user_id: selectedExpeditorUserId, warehouse: { tenant_id: tenantId, is_active: true } },
        distinct: ["warehouse_id"],
        select: { warehouse_id: true }
      }),
      prisma.cashDeskUserLink.findMany({
        where: { user_id: selectedExpeditorUserId, cash_desk: { tenant_id: tenantId, is_active: true } },
        distinct: ["cash_desk_id"],
        select: { cash_desk_id: true }
      }),
      prisma.orderItem.findMany({
        where: { order: { tenant_id: tenantId, expeditor_user_id: selectedExpeditorUserId } },
        distinct: ["product_id"],
        select: { product_id: true }
      })
    ]);
  if (!expeditor) {
    return {
      client_ids: new Set<number>(),
      agent_ids: new Set<number>(),
      warehouse_ids: new Set<number>(),
      cash_desk_ids: new Set<number>(),
      expeditor_ids: new Set<number>(),
      product_ids: new Set<number>()
    };
  }
  const agentIds = [
    ...agentsByAssign.map((r) => r.agent_id).filter((n): n is number => n != null),
    ...agentsByOrders.map((r) => r.agent_id).filter((n): n is number => n != null)
  ];
  const uniqueAgentIds = [...new Set(agentIds)];
  const [clientsPrimary, clientsSlots, whByAgent, cashByAgent] = await Promise.all([
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
      ? prisma.warehouseUserLink.findMany({
          where: { user_id: { in: uniqueAgentIds }, warehouse: { tenant_id: tenantId, is_active: true } },
          distinct: ["warehouse_id"],
          select: { warehouse_id: true }
        })
      : Promise.resolve([]),
    uniqueAgentIds.length
      ? prisma.cashDeskUserLink.findMany({
          where: { user_id: { in: uniqueAgentIds }, cash_desk: { tenant_id: tenantId, is_active: true } },
          distinct: ["cash_desk_id"],
          select: { cash_desk_id: true }
        })
      : Promise.resolve([])
  ]);

  const client_ids = new Set<number>(clientsByAssign.map((r) => r.client_id));
  for (const r of clientsByOrders) client_ids.add(r.client_id);
  for (const r of clientsPrimary) client_ids.add(r.id);
  for (const r of clientsSlots) client_ids.add(r.client_id);
  const warehouse_ids = new Set<number>(whLinks.map((r) => r.warehouse_id));
  for (const r of whByAgent) warehouse_ids.add(r.warehouse_id);
  const cash_desk_ids = new Set<number>(cashLinks.map((r) => r.cash_desk_id));
  for (const r of cashByAgent) cash_desk_ids.add(r.cash_desk_id);

  return {
    client_ids,
    agent_ids: new Set<number>(uniqueAgentIds),
    warehouse_ids,
    cash_desk_ids,
    expeditor_ids: new Set<number>([selectedExpeditorUserId]),
    product_ids: new Set<number>(productByOrders.map((r) => r.product_id))
  };
}

/**
 * Klientni `territories` bilan bog‘lash: GPS poligon yoki manzil maydonlari `code`/`name` bilan mos kelganda.
 * Buyurtma formasida faqat shu hududga biriktirilgan agentlar ro‘yxati uchun ishlatiladi.
 */
