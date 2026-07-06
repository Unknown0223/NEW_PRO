import { z } from "zod";

const optionalIntNull = z.number().int().positive().nullable().optional();
const optionalNumStrNull = z.union([z.number(), z.string()]).nullable().optional();
const idList = z.array(z.number().int().positive()).max(50).optional();

const productPackagingBodySchema = z.object({
  name: z.string().min(1).max(120),
  quantity: z.number().int().positive().nullable().optional(),
  width_cm: optionalNumStrNull,
  height_cm: optionalNumStrNull,
  length_cm: optionalNumStrNull,
  is_main: z.boolean().optional(),
  sort_order: z.number().int().nullable().optional()
});

/** POST `/api/:slug/products` */
export const createProductBodySchema = z.object({
  sku: z.string().min(1),
  name: z.string().min(1),
  unit: z.string().min(1).optional(),
  barcode: z.string().nullable().optional(),
  category_id: z.number().int().positive(),
  is_active: z.boolean().optional(),
  product_group_id: optionalIntNull,
  brand_id: optionalIntNull,
  manufacturer_id: optionalIntNull,
  segment_id: optionalIntNull,
  segment_ids: idList,
  trade_direction_ids: idList,
  image_url: z.string().max(2_800_000).nullable().optional(),
  packagings: z.array(productPackagingBodySchema).max(30).optional(),
  weight_kg: optionalNumStrNull,
  volume_m3: optionalNumStrNull,
  qty_per_block: z.number().int().nullable().optional(),
  dimension_unit: z.string().max(8).nullable().optional(),
  width_cm: optionalNumStrNull,
  height_cm: optionalNumStrNull,
  length_cm: optionalNumStrNull,
  ikpu_code: z.string().max(64).nullable().optional(),
  hs_code: z.string().max(32).nullable().optional(),
  sell_code: z.string().max(64).nullable().optional(),
  comment: z.string().nullable().optional(),
  sort_order: z.number().int().nullable().optional(),
  is_blocked: z.boolean().optional(),
  is_equipment: z.boolean().optional()
});

/** PATCH `/api/:slug/products/:id` */
export const updateProductBodySchema = createProductBodySchema.partial().extend({
  category_id: z.number().int().positive().nullable().optional()
});

/** POST `/api/:slug/products/bulk` */
export const bulkProductsBodySchema = z.object({
  items: z.array(createProductBodySchema).min(1).max(150)
});

function parseFilterId(raw: string | undefined): number | undefined {
  if (!raw?.trim()) return undefined;
  const n = Number.parseInt(raw.trim(), 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function parseFilterIds(raw: string | undefined): number[] | undefined {
  if (!raw?.trim()) return undefined;
  const ids = raw
    .split(",")
    .map((x) => Number.parseInt(x.trim(), 10))
    .filter((n) => Number.isFinite(n) && n > 0);
  return ids.length ? [...new Set(ids)] : undefined;
}

/** GET `/api/:slug/products` — ro‘yxat query (handler `where` quradi) */
export type ProductsListQuery = {
  page: number;
  limit: number;
  search?: string;
  is_active?: boolean;
  is_equipment?: boolean;
  uncategorized: boolean;
  category_id?: number;
  product_group_id?: number;
  brand_id?: number;
  manufacturer_id?: number;
  segment_id?: number;
  ids?: number[];
  include_prices: boolean;
};

export function parseProductsListQuery(q: Record<string, string | undefined>): ProductsListQuery {
  const page = Math.max(1, Number.parseInt(q.page ?? "1", 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(q.limit ?? "20", 10) || 20));
  const search = q.search?.trim() || undefined;

  let is_active: boolean | undefined;
  if (q.is_active === "true") is_active = true;
  else if (q.is_active === "false") is_active = false;

  let is_equipment: boolean | undefined;
  if (q.is_equipment === "true") is_equipment = true;
  else if (q.is_equipment === "false") is_equipment = false;

  const uncategorized =
    q.uncategorized === "true" || q.uncategorized === "1" || q.uncategorized === "yes";

  return {
    page,
    limit,
    search,
    is_active,
    is_equipment,
    uncategorized,
    category_id: uncategorized ? undefined : parseFilterId(q.category_id),
    product_group_id: parseFilterId(q.product_group_id),
    brand_id: parseFilterId(q.brand_id),
    manufacturer_id: parseFilterId(q.manufacturer_id),
    segment_id: parseFilterId(q.segment_id),
    ids: parseFilterIds(q.ids),
    include_prices: q.include_prices === "1" || q.include_prices === "true"
  };
}

export const productsListQuerySchema = z
  .record(z.string(), z.union([z.string(), z.undefined()]).optional())
  .transform((q) => parseProductsListQuery(q as Record<string, string | undefined>));
