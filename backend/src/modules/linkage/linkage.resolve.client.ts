import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { env } from "../../config/env";
import { mergeAgentsFromClientTerritories } from "./linkage.territory";

export async function resolveByClient(
  tenantId: number,
  selectedClientId: number
): Promise<{
  client_ids: Set<number>;
  agent_ids: Set<number>;
  warehouse_ids: Set<number>;
  cash_desk_ids: Set<number>;
  expeditor_ids: Set<number>;
  product_ids: Set<number>;
}> {
  const [client, assignments, orders] = await Promise.all([
    prisma.client.findFirst({
      where: { tenant_id: tenantId, id: selectedClientId, merged_into_client_id: null, is_active: true },
      select: {
        id: true,
        agent_id: true,
        latitude: true,
        longitude: true,
        region: true,
        city: true,
        district: true,
        zone: true
      }
    }),
    prisma.clientAgentAssignment.findMany({
      where: { tenant_id: tenantId, client_id: selectedClientId },
      select: { agent_id: true, expeditor_user_id: true }
    }),
    prisma.order.findMany({
      where: { tenant_id: tenantId, client_id: selectedClientId },
      select: { agent_id: true, expeditor_user_id: true, warehouse_id: true }
    })
  ]);
  if (!client) {
    return {
      client_ids: new Set<number>(),
      agent_ids: new Set<number>(),
      warehouse_ids: new Set<number>(),
      cash_desk_ids: new Set<number>(),
      expeditor_ids: new Set<number>(),
      product_ids: new Set<number>()
    };
  }

  const agentIds = new Set<number>();
  if (client.agent_id != null) agentIds.add(client.agent_id);
  for (const r of assignments) {
    if (r.agent_id != null) agentIds.add(r.agent_id);
  }
  for (const o of orders) {
    if (o.agent_id != null) agentIds.add(o.agent_id);
  }

  await mergeAgentsFromClientTerritories(tenantId, client, agentIds);

  const expeditor_ids = new Set<number>();
  for (const r of assignments) {
    if (r.expeditor_user_id != null) expeditor_ids.add(r.expeditor_user_id);
  }
  for (const o of orders) {
    if (o.expeditor_user_id != null) expeditor_ids.add(o.expeditor_user_id);
  }

  const warehouse_ids = new Set<number>();
  for (const o of orders) {
    if (o.warehouse_id != null) warehouse_ids.add(o.warehouse_id);
  }

  if (agentIds.size > 0) {
    const [whLinks, cashLinks] = await Promise.all([
      prisma.warehouseUserLink.findMany({
        where: { user_id: { in: [...agentIds] }, warehouse: { tenant_id: tenantId, is_active: true } },
        distinct: ["warehouse_id"],
        select: { warehouse_id: true }
      }),
      prisma.cashDeskUserLink.findMany({
        where: { user_id: { in: [...agentIds] }, cash_desk: { tenant_id: tenantId, is_active: true } },
        distinct: ["cash_desk_id"],
        select: { cash_desk_id: true }
      })
    ]);
    for (const r of whLinks) warehouse_ids.add(r.warehouse_id);
    return {
      client_ids: new Set<number>([selectedClientId]),
      agent_ids: agentIds,
      warehouse_ids,
      cash_desk_ids: new Set<number>(cashLinks.map((r) => r.cash_desk_id)),
      expeditor_ids,
      product_ids: new Set<number>()
    };
  }

  // Client without any linked routing actors must not participate in order flow.
  if (expeditor_ids.size === 0) {
    return {
      client_ids: new Set<number>(),
      agent_ids: new Set<number>(),
      warehouse_ids: new Set<number>(),
      cash_desk_ids: new Set<number>(),
      expeditor_ids: new Set<number>(),
      product_ids: new Set<number>()
    };
  }

  return {
    client_ids: new Set<number>([selectedClientId]),
    agent_ids: agentIds,
    warehouse_ids,
    cash_desk_ids: new Set<number>(),
    expeditor_ids,
    product_ids: new Set<number>()
  };
}
