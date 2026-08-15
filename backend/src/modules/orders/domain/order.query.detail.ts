/** Order detail query. */
import { prisma } from "../../../config/database";
import {
  enrichScopedReportActor,
  isOrderAgentAllowedForActor
} from "../../access/access-agent-scope";
import { enrichOrderDetailRow } from "./order.detail-mappers";
import { orderDetailInclude, type OrderDetailLoaded, type OrderDetailRow } from "./order.types";

export async function getOrderDetail(
  tenantId: number,
  id: number,
  viewerRole?: string,
  viewerUserId?: number | null
): Promise<OrderDetailRow> {
  const o = await prisma.order.findFirst({
    where: { id, tenant_id: tenantId },
    include: orderDetailInclude
  });
  if (!o) {
    throw new Error("NOT_FOUND");
  }
  if (viewerRole) {
    const actor = await enrichScopedReportActor(tenantId, {
      userId: viewerUserId ?? null,
      role: viewerRole
    });
    if (!isOrderAgentAllowedForActor(o.agent_id, actor)) {
      throw new Error("NOT_FOUND");
    }
  }
  // enrich: discount_pct display (net/gross) — order.detail-row
  return enrichOrderDetailRow(tenantId, o as unknown as OrderDetailLoaded, viewerRole);
}

/** Bitta so‘rovda bir nechta zakaz detal — guruh jami / excel uchun. */
export async function getOrdersDetailBulk(
  tenantId: number,
  orderIds: number[],
  viewerRole?: string,
  viewerUserId?: number | null
): Promise<OrderDetailRow[]> {
  const ids = [...new Set(orderIds.filter((id) => Number.isFinite(id) && id > 0))];
  if (ids.length === 0) return [];

  const actor = viewerRole
    ? await enrichScopedReportActor(tenantId, {
        userId: viewerUserId ?? null,
        role: viewerRole
      })
    : null;

  const rows = await prisma.order.findMany({
    where: { id: { in: ids }, tenant_id: tenantId },
    include: orderDetailInclude
  });
  const byId = new Map(rows.map((r) => [r.id, r]));
  const out: OrderDetailRow[] = [];
  for (const id of ids) {
    const o = byId.get(id);
    if (!o) continue;
    if (actor && !isOrderAgentAllowedForActor(o.agent_id, actor)) continue;
    out.push(await enrichOrderDetailRow(tenantId, o as unknown as OrderDetailLoaded, viewerRole));
  }
  return out;
}

