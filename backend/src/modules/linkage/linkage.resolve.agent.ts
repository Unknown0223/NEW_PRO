import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { env } from "../../config/env";
import {
  collectAllTrueCategoryIds,
  parseProductEntitlementRules
} from "./linkage.shared";
import { collectWarehouseIdsForUsers } from "./linkage.warehouse-ids";

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
  const [agentRow, clientsByPrimary, clientsBySlots, extraWh, whByOrders, cashLinks, expByClientSlots, expByOrders] =
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
      collectWarehouseIdsForUsers(tenantId, [selectedAgentId]),
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
  const warehouse_ids = new Set<number>(extraWh);
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

  const parsedRules = parseProductEntitlementRules(agentRow.agent_entitlements);
  const productIdSet = new Set<number>(parsedRules.productIds);
  if (parsedRules.allCategoryIds.length > 0) {
    const categoryRows = await prisma.productCategory.findMany({
      where: { tenant_id: tenantId },
      select: { id: true, parent_id: true }
    });
    const expandIds = collectAllTrueCategoryIds(
      parsedRules.allCategoryIds,
      parsedRules.partialCategoryIds,
      categoryRows
    );
    if (expandIds.length > 0) {
      const rows = await prisma.product.findMany({
        where: { tenant_id: tenantId, category_id: { in: expandIds } },
        select: { id: true }
      });
      for (const r of rows) productIdSet.add(r.id);
    }
  }
  let product_ids = [...productIdSet];

  /**
   * Agent katalogi: avvalo `agent_entitlements.product_rules`.
   * Qoidalar bo‘lmasa — shu agentning savdo zakazlari (`order_type=order`) bo‘yicha sotilgan mahsulotlar.
   * `all: true` + qisman tanlov aralashganda sold-fallback ishlatilmaydi (aks holda
   * to‘liq belgilangan kategoriyalar yo‘qolardi).
   */
  if (product_ids.length === 0 && !parsedRules.restricted) {
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

