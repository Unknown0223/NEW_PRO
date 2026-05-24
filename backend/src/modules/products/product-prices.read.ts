import { prisma } from "../../config/database";

const DEFAULT_PRICE_TYPE = "retail";

export type PriceRow = {
  id: number;
  price_type: string;
  price: string;
  currency: string;
};

export type PriceMatrixRow = {
  product_id: number;
  name: string;
  sku: string;
  price: string | null;
  currency: string;
  category_id: number | null;
  category_name: string | null;
};

const MAX_MATRIX_CATEGORIES = 50;

export async function getProductPrice(
  tenantId: number,
  productId: number,
  priceType: string = DEFAULT_PRICE_TYPE
): Promise<string | null> {
  const normalized = priceType.trim();
  if (!normalized) return null;
  const row = await prisma.productPrice.findUnique({
    where: {
      tenant_id_product_id_price_type: {
        tenant_id: tenantId,
        product_id: productId,
        price_type: normalized
      }
    }
  });
  if (row) return row.price.toString();
  const ciRow = await prisma.productPrice.findFirst({
    where: {
      tenant_id: tenantId,
      product_id: productId,
      price_type: { equals: normalized, mode: "insensitive" }
    }
  });
  return ciRow ? ciRow.price.toString() : null;
}

export async function listProductPrices(tenantId: number, productId: number): Promise<PriceRow[]> {
  const product = await prisma.product.findFirst({
    where: { id: productId, tenant_id: tenantId }
  });
  if (!product) {
    throw new Error("NOT_FOUND");
  }
  const rows = await prisma.productPrice.findMany({
    where: { tenant_id: tenantId, product_id: productId },
    orderBy: [{ price_type: "asc" }]
  });
  return rows.map((r) => ({
    id: r.id,
    price_type: r.price_type,
    price: r.price.toString(),
    currency: r.currency
  }));
}

export async function listCategoryPricesMatrix(
  tenantId: number,
  categoryId: number,
  priceType: string,
  defaultCurrency: string
): Promise<PriceMatrixRow[]> {
  const cat = await prisma.productCategory.findFirst({
    where: { id: categoryId, tenant_id: tenantId }
  });
  if (!cat) {
    throw new Error("NOT_FOUND");
  }
  const t = priceType.trim();
  if (!t) {
    throw new Error("VALIDATION");
  }
  const products = await prisma.product.findMany({
    where: { tenant_id: tenantId, category_id: categoryId },
    orderBy: [{ sort_order: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      sku: true,
      prices: {
        where: { price_type: t },
        take: 1,
        select: { price: true, currency: true }
      }
    }
  });
  return products.map((p) => ({
    product_id: p.id,
    name: p.name,
    sku: p.sku,
    price: p.prices[0] ? p.prices[0].price.toString() : null,
    currency: p.prices[0]?.currency ?? defaultCurrency,
    category_id: categoryId,
    category_name: cat.name
  }));
}

export async function listPricesMatrixForCategories(
  tenantId: number,
  categoryIds: number[],
  priceType: string,
  defaultCurrency: string
): Promise<PriceMatrixRow[]> {
  const uniqueIds = [...new Set(categoryIds.filter((id) => Number.isInteger(id) && id > 0))];
  if (uniqueIds.length === 0) {
    throw new Error("VALIDATION");
  }
  if (uniqueIds.length > MAX_MATRIX_CATEGORIES) {
    throw new Error("VALIDATION");
  }
  const t = priceType.trim();
  if (!t) {
    throw new Error("VALIDATION");
  }

  const categories = await prisma.productCategory.findMany({
    where: { tenant_id: tenantId, id: { in: uniqueIds } },
    select: { id: true, name: true }
  });
  if (categories.length !== uniqueIds.length) {
    throw new Error("NOT_FOUND");
  }
  const nameById = new Map(categories.map((c) => [c.id, c.name]));

  const products = await prisma.product.findMany({
    where: { tenant_id: tenantId, category_id: { in: uniqueIds } },
    orderBy: [{ category_id: "asc" }, { sort_order: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      sku: true,
      category_id: true,
      prices: {
        where: { price_type: t },
        take: 1,
        select: { price: true, currency: true }
      }
    }
  });

  return products.map((p) => ({
    product_id: p.id,
    name: p.name,
    sku: p.sku,
    price: p.prices[0] ? p.prices[0].price.toString() : null,
    currency: p.prices[0]?.currency ?? defaultCurrency,
    category_id: p.category_id,
    category_name: p.category_id != null ? (nameById.get(p.category_id) ?? null) : null
  }));
}
