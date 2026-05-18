import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { env } from "../../config/env";
import { parseEntitledProductIds } from "./linkage.shared";
export async function resolveByAgent(
  tenantId: number,
  selectedAgentId: number
): Promise<{
  client_ids: Set<number>;
  agent_ids: Set<number>;
  warehouse_ids: Set<number>;
  cash_desk_ids: Set<number>;
  expeditor_ids: Set<number>;
  product_ids: Set<number>;
  product_restricted: boolean;
}> {
  const [agentRow, clientsByPrimary, clientsBySlots, whLinks, whByOrders, cashLinks, expByClientSlots, expByOrders] =
    await Promise.all([
      prisma.user.findFirst({
        where: { tenant_id: tenantId, id: selectedAgentId, role: "agent", is_active: true },
        select: { id: true, agent_entitlements: true }
      }),
      prisma.client.findMany({
        where: {
          tenant_id: tenantId,
          merged_into_client_id: null,
          agent_id: selectedAgentId
        },
        select: { id: true }
      }),
      prisma.clientAgentAssignment.findMany({
        where: { tenant_id: tenantId, agent_id: selectedAgentId },
        distinct: ["client_id"],
        select: { client_id: true }
      }),
      prisma.warehouseUserLink.findMany({
        where: { user_id: selectedAgentId, warehouse: { tenant_id: tenantId } },
        distinct: ["warehouse_id"],
        select: { warehouse_id: true }
      }),
      prisma.order.findMany({
        where: { tenant_id: tenantId, agent_id: selectedAgentId, warehouse_id: { not: null } },
        distinct: ["warehouse_id"],
        select: { warehouse_id: true }
      }),
      prisma.cashDeskUserLink.findMany({
        where: { user_id: selectedAgentId, cash_desk: { tenant_id: tenantId, is_active: true } },
        distinct: ["cash_desk_id"],
        select: { cash_desk_id: true }
      }),
      prisma.clientAgentAssignment.findMany({
        where: { tenant_id: tenantId, agent_id: selectedAgentId, expeditor_user_id: { not: null } },
        distinct: ["expeditor_user_id"],
        select: { expeditor_user_id: true }
      }),
      prisma.order.findMany({
        where: { tenant_id: tenantId, agent_id: selectedAgentId, expeditor_user_id: { not: null } },
        distinct: ["expeditor_user_id"],
        select: { expeditor_user_id: true }
      })
    ]);

  const client_ids = new Set<number>(clientsByPrimary.map((r) => r.id));
  for (const r of clientsBySlots) client_ids.add(r.client_id);
  const warehouse_ids = new Set<number>(whLinks.map((r) => r.warehouse_id));
  for (const r of whByOrders) {
    if (r.warehouse_id != null) warehouse_ids.add(r.warehouse_id);
  }
  const cash_desk_ids = new Set<number>(cashLinks.map((r) => r.cash_desk_id));
  const expeditor_ids = new Set<number>();
  for (const r of expByClientSlots) {
    if (r.expeditor_user_id != null) expeditor_ids.add(r.expeditor_user_id);
  }
  for (const r of expByOrders) {
    if (r.expeditor_user_id != null) expeditor_ids.add(r.expeditor_user_id);
  }

  if (!agentRow) {
    return {
      client_ids,
      agent_ids: new Set<number>([selectedAgentId]),
      warehouse_ids,
      cash_desk_ids,
      expeditor_ids,
      product_ids: new Set<number>(),
      product_restricted: false
    };
  }

  const { ids: entitledProductIds, restricted: product_restricted } = parseEntitledProductIds(
    agentRow.agent_entitlements
  );
  let product_ids = entitledProductIds;
  if (product_restricted && product_ids.length === 0) {
    const categoryIds = Array.isArray((agentRow.agent_entitlements as Record<string, unknown>)?.product_rules)
      ? ((agentRow.agent_entitlements as Record<string, unknown>).product_rules as unknown[])
          .map((r) =>
            r != null && typeof r === "object" && !Array.isArray(r)
              ? Number((r as Record<string, unknown>).category_id)
              : NaN
          )
          .filter((n) => Number.isInteger(n) && n > 0)
      : [];
    if (categoryIds.length > 0) {
      const rows = await prisma.product.findMany({
        where: { tenant_id: tenantId, category_id: { in: categoryIds } },
        select: { id: true }
      });
      product_ids = rows.map((r) => r.id);
    }
  }

  /**
   * Agent katalogi: avvalo `agent_entitlements.product_rules`.
   * Bo‘sh bo‘lsa — shu agentning savdo zakazlari (`order_type=order`) bo‘yicha sotilgan mahsulotlar.
   * Shunda create-context `selected_agent_id` bilan butun katalogni yuklamaydi.
   */
  if (product_ids.length === 0) {
    /** Prisma `distinct` + join katta jadvallarda sekin; PG `GROUP BY` + indeks yaxshiroq. */
    const sold = await prisma.$queryRaw<{ product_id: number }[]>(Prisma.sql`
      SELECT oi.product_id AS product_id
      FROM order_items oi
      INNER JOIN orders o ON o.id = oi.order_id
      WHERE o.tenant_id = ${tenantId}
        AND o.agent_id = ${selectedAgentId}
        AND o.order_type = 'order'
        AND o.status <> 'cancelled'
        AND oi.is_bonus = false
        AND oi.product_id IS NOT NULL
      GROUP BY oi.product_id
      LIMIT ${env.LINKAGE_AGENT_SOLD_PRODUCT_IDS_LIMIT}
    `);
    const uniq = new Set<number>();
    for (const r of sold) {
      const pid = Number(r.product_id);
      if (Number.isInteger(pid) && pid > 0) uniq.add(pid);
    }
    product_ids = [...uniq];
  }

  return {
    client_ids,
    agent_ids: new Set<number>([selectedAgentId]),
    warehouse_ids,
    cash_desk_ids,
    expeditor_ids,
    product_ids: new Set<number>(product_ids),
    /** Agent tanlangan bo‘lsa — mahsulot kesimi doim ishtirok etadi (bo‘sh = forma katalogi bo‘sh). */
    product_restricted: true
  };
}

