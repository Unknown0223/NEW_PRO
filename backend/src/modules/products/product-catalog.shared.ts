import type { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
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
  if (opts.is_active === true) where.is_active = true;
  if (opts.is_active === false) where.is_active = false;
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
