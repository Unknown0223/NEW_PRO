import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { env } from "../../config/env";

export async function resolveByCashDesk(
  tenantId: number,
  selectedCashDeskId: number
): Promise<{
  client_ids: Set<number>;
  agent_ids: Set<number>;
  warehouse_ids: Set<number>;
  cash_desk_ids: Set<number>;
  expeditor_ids: Set<number>;
  product_ids: Set<number>;
}> {
  const [cashDesk, links, clientsByPayments] = await Promise.all([
    prisma.cashDesk.findFirst({
      where: { id: selectedCashDeskId, tenant_id: tenantId, is_active: true },
      select: { id: true }
    }),
    prisma.cashDeskUserLink.findMany({
      where: { cash_desk_id: selectedCashDeskId },
      select: { user_id: true, user: { select: { role: true, id: true } } }
    }),
    prisma.payment.findMany({
      where: { tenant_id: tenantId, cash_desk_id: selectedCashDeskId },
      distinct: ["client_id"],
      select: { client_id: true }
    })
  ]);
  if (!cashDesk) {
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
  const uniqueAgentIds = [...new Set(agentIds)];
  const expeditor_ids = new Set<number>(
    links.filter((r) => r.user.role === "expeditor").map((r) => r.user.id)
  );

  const [whLinks, clientsPrimary, clientsSlots, expFromSlots, expFromOrders] = await Promise.all([
    userIds.length
      ? prisma.warehouseUserLink.findMany({
          where: { user_id: { in: userIds }, warehouse: { tenant_id: tenantId, is_active: true } },
          distinct: ["warehouse_id"],
          select: { warehouse_id: true }
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

  const client_ids = new Set<number>(clientsByPayments.map((r) => r.client_id));
  for (const r of clientsPrimary) client_ids.add(r.id);
  for (const r of clientsSlots) client_ids.add(r.client_id);
  for (const r of expFromSlots) if (r.expeditor_user_id != null) expeditor_ids.add(r.expeditor_user_id);
  for (const r of expFromOrders) if (r.expeditor_user_id != null) expeditor_ids.add(r.expeditor_user_id);

  return {
    client_ids,
    agent_ids: new Set<number>(uniqueAgentIds),
    warehouse_ids: new Set<number>(whLinks.map((r) => r.warehouse_id)),
    cash_desk_ids: new Set<number>([selectedCashDeskId]),
    expeditor_ids,
    product_ids: new Set<number>()
  };
}

