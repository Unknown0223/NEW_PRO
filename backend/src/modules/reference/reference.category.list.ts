import type { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import type { ProductCategoryListRow } from "./reference.category.types";

function categoryDedupeKey(row: { name: string; parent_id: number | null }): string {
  return `${row.parent_id ?? "root"}::${row.name.trim().toLowerCase()}`;
}

/**
 * Bir xil parent ostida bir xil nom — filterda dublikat.
 * Eng kichik id saqlanadi (barqaror).
 */
export function dedupeProductCategoryRows<T extends ProductCategoryListRow>(rows: T[]): T[] {
  const best = new Map<string, T>();
  for (const row of rows) {
    const key = categoryDedupeKey(row);
    const prev = best.get(key);
    if (!prev || row.id < prev.id) best.set(key, row);
  }
  return [...best.values()].sort((a, b) => {
    const ao = a.sort_order ?? 1_000_000;
    const bo = b.sort_order ?? 1_000_000;
    if (ao !== bo) return ao - bo;
    return a.name.localeCompare(b.name, "uz");
  });
}

export async function listProductCategoriesForTenant(
  tenantId: number,
  opts?: { include_inactive?: boolean; is_active?: boolean }
): Promise<ProductCategoryListRow[]> {
  const where: Prisma.ProductCategoryWhereInput = { tenant_id: tenantId };
  if (opts?.include_inactive === true) {
    // filtr yo‘q
  } else if (opts?.is_active === false) {
    where.is_active = false;
  } else {
    where.is_active = true;
  }
  const rows = await prisma.productCategory.findMany({
    where,
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
  return dedupeProductCategoryRows(rows);
}
