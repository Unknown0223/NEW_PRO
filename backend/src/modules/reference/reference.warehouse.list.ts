import type { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";

export async function listWarehousesForTenant(
  tenantId: number,
  opts?: { allowed_ids?: number[] }
) {
  const where: Prisma.WarehouseWhereInput = { tenant_id: tenantId };
  if (opts?.allowed_ids !== undefined) {
    where.id = { in: opts.allowed_ids };
  }
  return prisma.warehouse.findMany({
    where,
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      type: true,
      stock_purpose: true,
      code: true,
      address: true,
      payment_method: true,
      van_selling: true,
      is_active: true
    }
  });
}
