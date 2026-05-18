import type { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import type { ProductCategoryListRow } from "./reference.category.types";

export async function listProductCategoriesForTenant(tenantId: number): Promise<ProductCategoryListRow[]> {
  const rows = await prisma.productCategory.findMany({
    where: { tenant_id: tenantId },
    select: {
      id: true,
      name: true,
      parent_id: true,
      code: true,
      sort_order: true,
      default_unit: true,
      is_active: true,
      comment: true,
      created_at: true
    }
  });
  return [...rows].sort((a, b) => {
    const ao = a.sort_order ?? 1_000_000;
    const bo = b.sort_order ?? 1_000_000;
    if (ao !== bo) return ao - bo;
    return a.name.localeCompare(b.name, "uz");
  });
}
