import { Prisma } from "@prisma/client";
import type { InventoryDateType } from "./inventory.types";

/** SalesDoc Inventorization date column expression. */
export function inventoryDateExpr(dateType: InventoryDateType): Prisma.Sql {
  if (dateType === "shipped_date") {
    return Prisma.sql`COALESCE(sl.shipped_at, sl.delivered_at)`;
  }
  return Prisma.sql`o.created_at`;
}
