import type { Prisma } from "@prisma/client";
import type { ListCatalogOpts } from "./product-catalog.types";

export function listWhere(
  tenantId: number,
  opts: ListCatalogOpts
): {
  tenant_id: number;
  is_active?: boolean;
  OR?: Prisma.ProductCatalogGroupWhereInput["OR"];
} {
  const where: {
    tenant_id: number;
    is_active?: boolean;
    OR?: Prisma.ProductCatalogGroupWhereInput["OR"];
  } = { tenant_id: tenantId };
  // Default: faqat aktiv; include_inactive yoki is_active=false bilan kengaytiriladi.
  if (opts.include_inactive === true) {
    // filtr yo‘q
  } else if (opts.is_active === false) {
    where.is_active = false;
  } else {
    where.is_active = true;
  }
  if (opts.search?.trim()) {
    const s = opts.search.trim();
    where.OR = [
      { name: { contains: s, mode: "insensitive" } },
      { code: { contains: s, mode: "insensitive" } }
    ];
  }
  return where;
}

export function normCode(v: string | null | undefined): string | null {
  if (v == null || v === "") return null;
  const t = v.trim().slice(0, 24);
  return t || null;
}

export {
  CATALOG_CODE_DB_MAX,
  catalogDeactivateData,
  catalogRestoreData
} from "../../lib/soft-void";
