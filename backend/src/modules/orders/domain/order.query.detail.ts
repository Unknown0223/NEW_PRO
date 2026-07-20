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

