import type { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { listDistinctPriceTypesForTenant } from "../reference/reference.service";
import type { InterchangeableGroupRow, ListCatalogOpts } from "./product-catalog.types";
import { normCode } from "./product-catalog.shared";

export async function listInterchangeableProductGroups(
  tenantId: number,
  opts: ListCatalogOpts
): Promise<{ total: number; data: InterchangeableGroupRow[] }> {
  const base: Prisma.InterchangeableProductGroupWhereInput = { tenant_id: tenantId };
  if (opts.is_active === true) base.is_active = true;
  if (opts.is_active === false) base.is_active = false;
  if (opts.search?.trim()) {
    const s = opts.search.trim();
    base.OR = [
      { name: { contains: s, mode: "insensitive" } },
      { code: { contains: s, mode: "insensitive" } }
    ];
  }
  const [total, rows] = await Promise.all([
    prisma.interchangeableProductGroup.count({ where: base }),
    prisma.interchangeableProductGroup.findMany({
      where: base,
      skip: (opts.page - 1) * opts.limit,
      take: opts.limit,
      orderBy: [{ sort_order: "asc" }, { name: "asc" }, { id: "asc" }],
      include: {
        products: {
          include: {
            product: { select: { id: true, sku: true, name: true } }
          }
        },
        price_type_links: true
      }
    })
  ]);
  const data: InterchangeableGroupRow[] = rows.map((g) => ({
    id: g.id,
    name: g.name,
    code: g.code,
    sort_order: g.sort_order,
    comment: g.comment,
    is_active: g.is_active,
    created_at: g.created_at,
    updated_at: g.updated_at,
    products: g.products.map((l) => l.product),
    price_types: g.price_type_links.map((p) => p.price_type)
  }));
  return { total, data };
}

async function assertTenantPriceTypes(tenantId: number, priceTypes: string[]) {
  if (priceTypes.length === 0) return;
  const allowed = await listDistinctPriceTypesForTenant(tenantId, "sale");
  const set = new Set(allowed.length ? allowed : ["retail"]);
  for (const pt of priceTypes) {
    if (!set.has(pt)) {
      const err = new Error("BAD_PRICE_TYPE") as Error & { price_type?: string };
      err.price_type = pt;
      throw err;
    }
  }
}

export async function createInterchangeableProductGroup(
  tenantId: number,
  input: {
    name: string;
    code?: string | null;
    sort_order?: number | null;
    comment?: string | null;
    is_active?: boolean;
    product_ids?: number[];
    price_types?: string[];
  }
) {
  const name = input.name.trim();
  if (!name) throw new Error("VALIDATION");
  const productIds = [...new Set((input.product_ids ?? []).filter((x) => Number.isInteger(x) && x > 0))];
  const priceTypes = [...new Set((input.price_types ?? []).map((t) => t.trim()).filter(Boolean))];

  await assertTenantPriceTypes(tenantId, priceTypes);

  if (productIds.length) {
    const cnt = await prisma.product.count({
      where: { tenant_id: tenantId, id: { in: productIds } }
    });
    if (cnt !== productIds.length) throw new Error("BAD_PRODUCT");
  }

  return prisma.$transaction(async (tx) => {
    const g = await tx.interchangeableProductGroup.create({
      data: {
        tenant_id: tenantId,
        name,
        code: normCode(input.code ?? null),
        sort_order: input.sort_order ?? null,
        comment: input.comment?.trim() || null,
        is_active: input.is_active ?? true
      }
    });
    if (productIds.length) {
      await tx.interchangeableGroupProduct.createMany({
        data: productIds.map((product_id) => ({ group_id: g.id, product_id }))
      });
    }
    if (priceTypes.length) {
      await tx.interchangeableGroupPriceType.createMany({
        data: priceTypes.map((price_type) => ({ group_id: g.id, price_type }))
      });
    }
    return g;
  });
}

export async function updateInterchangeableProductGroup(
  tenantId: number,
  id: number,
  input: Partial<{
    name: string;
    code: string | null;
    sort_order: number | null;
    comment: string | null;
    is_active: boolean;
    product_ids: number[];
    price_types: string[];
  }>
) {
  const row = await prisma.interchangeableProductGroup.findFirst({ where: { id, tenant_id: tenantId } });
  if (!row) throw new Error("NOT_FOUND");

  if (input.product_ids !== undefined) {
    const productIds = [...new Set(input.product_ids.filter((x) => Number.isInteger(x) && x > 0))];
    if (productIds.length) {
      const cnt = await prisma.product.count({
        where: { tenant_id: tenantId, id: { in: productIds } }
      });
      if (cnt !== productIds.length) throw new Error("BAD_PRODUCT");
    }
  }

  if (input.price_types !== undefined) {
    const priceTypes = [...new Set(input.price_types.map((t) => t.trim()).filter(Boolean))];
    await assertTenantPriceTypes(tenantId, priceTypes);
  }

  return prisma.$transaction(async (tx) => {
    const data: Prisma.InterchangeableProductGroupUpdateInput = {};
    if (input.name !== undefined) data.name = input.name.trim();
    if (input.code !== undefined) data.code = normCode(input.code);
    if (input.sort_order !== undefined) data.sort_order = input.sort_order;
    if (input.comment !== undefined) data.comment = input.comment?.trim() || null;
    if (input.is_active !== undefined) data.is_active = input.is_active;
    if (Object.keys(data).length) {
      await tx.interchangeableProductGroup.update({ where: { id }, data });
    }

    if (input.product_ids !== undefined) {
      const productIds = [...new Set(input.product_ids.filter((x) => Number.isInteger(x) && x > 0))];
      await tx.interchangeableGroupProduct.deleteMany({ where: { group_id: id } });
      if (productIds.length) {
        await tx.interchangeableGroupProduct.createMany({
          data: productIds.map((product_id) => ({ group_id: id, product_id }))
        });
      }
    }

    if (input.price_types !== undefined) {
      const priceTypes = [...new Set(input.price_types.map((t) => t.trim()).filter(Boolean))];
      await tx.interchangeableGroupPriceType.deleteMany({ where: { group_id: id } });
      if (priceTypes.length) {
        await tx.interchangeableGroupPriceType.createMany({
          data: priceTypes.map((price_type) => ({ group_id: id, price_type }))
        });
      }
    }

    return tx.interchangeableProductGroup.findFirstOrThrow({ where: { id } });
  });
}

export async function deleteInterchangeableProductGroup(tenantId: number, id: number) {
  const row = await prisma.interchangeableProductGroup.findFirst({ where: { id, tenant_id: tenantId } });
  if (!row) throw new Error("NOT_FOUND");
  await prisma.interchangeableProductGroup.delete({ where: { id } });
}

export async function getInterchangeableProductGroup(
  tenantId: number,
  id: number
): Promise<InterchangeableGroupRow | null> {
  const g = await prisma.interchangeableProductGroup.findFirst({
    where: { id, tenant_id: tenantId },
    include: {
      products: {
        include: {
          product: { select: { id: true, sku: true, name: true } }
        }
      },
      price_type_links: true
    }
  });
  if (!g) return null;
  return {
    id: g.id,
    name: g.name,
    code: g.code,
    sort_order: g.sort_order,
    comment: g.comment,
    is_active: g.is_active,
    created_at: g.created_at,
    updated_at: g.updated_at,
    products: g.products.map((l) => l.product),
    price_types: g.price_type_links.map((p) => p.price_type)
  };
}
