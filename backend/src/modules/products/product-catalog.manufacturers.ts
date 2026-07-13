import type { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import type { ListCatalogOpts } from "./product-catalog.types";
import { listWhere, normCode } from "./product-catalog.shared";

export async function listProductManufacturers(tenantId: number, opts: ListCatalogOpts) {
  const where = listWhere(tenantId, opts) as Prisma.ProductManufacturerWhereInput;
  const [total, data] = await Promise.all([
    prisma.productManufacturer.count({ where }),
    prisma.productManufacturer.findMany({
      where,
      skip: (opts.page - 1) * opts.limit,
      take: opts.limit,
      orderBy: [{ sort_order: "asc" }, { name: "asc" }, { id: "asc" }]
    })
  ]);
  return { total, data };
}

export async function createProductManufacturer(
  tenantId: number,
  input: { name: string; code?: string | null; sort_order?: number | null; is_active?: boolean }
) {
  const name = input.name.trim();
  if (!name) throw new Error("VALIDATION");
  return prisma.productManufacturer.create({
    data: {
      tenant_id: tenantId,
      name,
      code: normCode(input.code ?? null),
      sort_order: input.sort_order ?? null,
      is_active: input.is_active ?? true
    }
  });
}

export async function updateProductManufacturer(
  tenantId: number,
  id: number,
  input: Partial<{ name: string; code: string | null; sort_order: number | null; is_active: boolean }>
) {
  const row = await prisma.productManufacturer.findFirst({ where: { id, tenant_id: tenantId } });
  if (!row) throw new Error("NOT_FOUND");
  const data: Prisma.ProductManufacturerUpdateInput = {};
  if (input.name !== undefined) data.name = input.name.trim();
  if (input.code !== undefined) data.code = normCode(input.code);
  if (input.sort_order !== undefined) data.sort_order = input.sort_order;
  if (input.is_active !== undefined) data.is_active = input.is_active;
  return prisma.productManufacturer.update({ where: { id }, data });
}

export async function deleteProductManufacturer(tenantId: number, id: number) {
  const row = await prisma.productManufacturer.findFirst({ where: { id, tenant_id: tenantId } });
  if (!row) throw new Error("NOT_FOUND");
  const n = await prisma.product.count({ where: { tenant_id: tenantId, manufacturer_id: id } });
  if (n > 0) throw new Error("IN_USE");
  await prisma.productManufacturer.delete({ where: { id } });
}

// —— Segments ——
