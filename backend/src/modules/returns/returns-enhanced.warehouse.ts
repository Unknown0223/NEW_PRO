import { randomUUID } from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma } from "../../config/database";
import { emitOrderUpdated } from "../../lib/order-event-bus";
import { invalidateDashboard, invalidateStock } from "../../lib/redis-cache";
import { appendTenantAuditEvent, AuditEntityType } from "../../lib/tenant-audit";
import { assertReturnProductsInterchangeableStrict } from "../products/product-catalog.service";
import { canTransitionOrderStatus, normalizeOrderType } from "../orders/order-status";


export async function findReturnWarehouse(tenantId: number): Promise<number> {
  // Prefer stock_purpose='return' warehouse
  const retWh = await prisma.warehouse.findFirst({
    where: { tenant_id: tenantId, stock_purpose: "return", is_active: true },
    select: { id: true }
  });
  if (retWh) return retWh.id;

  // Fallback: first active warehouse
  const any = await prisma.warehouse.findFirst({
    where: { tenant_id: tenantId, is_active: true },
    orderBy: { id: "asc" },
    select: { id: true }
  });
  if (!any) throw new Error("NO_WAREHOUSE");
  return any.id;
}
