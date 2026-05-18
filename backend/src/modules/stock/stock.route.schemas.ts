import type { FastifyRequest } from "fastify";
import { z } from "zod";
import {
  stockBalancesExportQuerySchema,
  stockBalancesQuerySchema
} from "../../contracts/stock.schemas";

export { stockBalancesExportQuerySchema, stockBalancesQuerySchema };

export const recommendedQuerySchema = z.object({
  date_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  date_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  warehouse_id: z.coerce.number().int().positive().optional(),
  category_id: z.coerce.number().int().positive().optional(),
  product_id: z.coerce.number().int().positive().optional(),
  qty_mode: z.enum(["all", "positive", "zero"]).optional().default("all"),
  q: z.string().optional().default(""),
  sort_by: z
    .enum(["sku", "category", "name", "stock", "avg", "coverage", "r6", "r10", "r30", "rme", "share"])
    .optional()
    .default("category"),
  sort_dir: z.enum(["asc", "desc"]).optional().default("asc"),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(200).optional().default(25)
});

export const recommendedExportQuerySchema = recommendedQuerySchema.omit({ page: true, limit: true });

export const stockByDateQuerySchema = z.object({
  date: z.string().min(10).max(25),
  warehouse_id: z.coerce.number().int().positive(),
  category_id: z.coerce.number().int().positive().optional(),
  product_id: z.coerce.number().int().positive().optional(),
  price_type: z.string().max(128).optional(),
  q: z.string().optional().default(""),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(200).optional().default(25)
});
export const stockByDateExportQuerySchema = stockByDateQuerySchema.omit({ page: true, limit: true });

export const materialReportQuerySchema = z.object({
  date_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  date_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  warehouse_id: z.coerce.number().int().positive().optional(),
  category_id: z.coerce.number().int().positive().optional(),
  product_id: z.coerce.number().int().positive().optional(),
  qty_mode: z.enum(["all", "positive", "zero"]).optional().default("all"),
  q: z.string().optional().default(""),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(200).optional().default(30)
});
export const materialReportExportQuerySchema = materialReportQuerySchema
  .omit({ page: true, limit: true })
  .extend({ mode: z.enum(["detailed", "summary"]).optional().default("detailed") });

export const stockReceiptsReportQuerySchema = z.object({
  date_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  date_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  warehouse_id: z.coerce.number().int().positive().optional(),
  category_id: z.coerce.number().int().positive().optional(),
  product_id: z.coerce.number().int().positive().optional(),
  supplier_id: z.coerce.number().int().positive().optional(),
  qty_mode: z.enum(["all", "positive", "zero"]).optional().default("all"),
  q: z.string().optional().default(""),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(200).optional().default(25)
});
export const stockReceiptsReportExportQuerySchema = stockReceiptsReportQuerySchema.omit({
  page: true,
  limit: true
});

export const receiptBody = z.object({
  warehouse_id: z.number().int().positive(),
  items: z
    .array(
      z.object({
        product_id: z.number().int().positive(),
        qty: z.number().positive()
      })
    )
    .min(1),
  note: z.string().max(2000).optional().nullable()
});

export const adjustmentBody = z.object({
  warehouse_id: z.number().int().positive(),
  product_id: z.number().int().positive(),
  delta: z.number().refine((n) => Number.isFinite(n) && n !== 0),
  note: z.string().max(500).optional().nullable()
});

export const correctionsQuerySchema = z.object({
  warehouse_id: z.coerce.number().int().positive().optional(),
  kind: z.enum(["correction"]).optional(),
  q: z.string().optional().default(""),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(200).optional().default(25)
});

/** Fastify: query ba'zan `string | string[]`; bo'sh `key=` → `""` — coerce `positive()` buziladi. */
function queryScalar(v: unknown): unknown {
  if (v === "" || v === null || v === undefined) return undefined;
  if (Array.isArray(v)) return v.length > 0 ? queryScalar(v[0]) : undefined;
  return v;
}

function requiredPositiveIntFromQuery(v: unknown): number {
  const s = queryScalar(v);
  if (s === undefined) return Number.NaN;
  const n = typeof s === "number" && Number.isFinite(s) ? s : Number(String(s).trim());
  if (!Number.isFinite(n)) return Number.NaN;
  const i = Math.trunc(n);
  if (i !== n || i <= 0) return Number.NaN;
  return i;
}

/** Noto'g'ri yoki bo'sh qiymat → `undefined` (ikkita scope maydoni uchun — `NaN` emas). */
function optionalPositiveIntFromQuery(v: unknown): number | undefined {
  const s = queryScalar(v);
  if (s === undefined) return undefined;
  const n = typeof s === "number" && Number.isFinite(s) ? s : Number(String(s).trim());
  if (!Number.isFinite(n)) return undefined;
  const i = Math.trunc(n);
  if (i !== n || i <= 0) return undefined;
  return i;
}

export const correctionWorkspaceQuerySchema = z
  .object({
    warehouse_id: z.preprocess(requiredPositiveIntFromQuery, z.number().int().positive()),
    catalog_group_id: z.preprocess(optionalPositiveIntFromQuery, z.number().int().positive().optional()),
    category_id: z.preprocess(optionalPositiveIntFromQuery, z.number().int().positive().optional()),
    price_type: z.preprocess(
      (v) => {
        const s = queryScalar(v);
        if (s === undefined) return undefined;
        const t = String(s).trim();
        return t === "" ? undefined : t;
      },
      z.string().max(128).optional()
    )
  })
  .transform((q) => {
    /** Ikkala scope kelganda (proxy / eski URL / xato klient) — kategoriya ustun. */
    if (q.category_id != null && q.catalog_group_id != null) {
      return { ...q, catalog_group_id: undefined };
    }
    return q;
  })
  .refine(
    (q) =>
      (q.catalog_group_id != null && q.category_id == null) ||
      (q.catalog_group_id == null && q.category_id != null),
    { message: "Exactly one of catalog_group_id or category_id is required" }
  );

type StockImportMultipartOk = {
  buf: Buffer;
  defaultWarehouseId?: number;
};

export async function parseStockImportMultipart(request: FastifyRequest): Promise<StockImportMultipartOk | null> {
  let buf: Buffer | null = null;
  let defaultWarehouseId: number | undefined;
  const parts = request.parts();
  for await (const part of parts) {
    if (part.type === "file") {
      buf = await part.toBuffer();
    } else if (part.type === "field" && part.fieldname === "warehouse_id") {
      const raw = String(part.value ?? "").trim();
      const n = Number.parseInt(raw, 10);
      if (Number.isFinite(n) && n > 0) defaultWarehouseId = n;
    }
  }
  if (!buf || buf.length === 0) {
    const file = await request.file();
    if (!file) {
      return null;
    }
    buf = await file.toBuffer();
  }
  if (!buf || buf.length === 0) {
    return null;
  }
  return { buf, defaultWarehouseId };
}

export const correctionBulkBodySchema = z.object({
  warehouse_id: z.number().int().positive(),
  kind: z.enum(["correction"]),
  price_type: z.string().max(128).optional().nullable(),
  occurred_at: z.string().max(64).optional().nullable(),
  comment: z.string().max(2000).optional().nullable(),
  items: z
    .array(
      z.object({
        product_id: z.number().int().positive(),
        delta: z.number().refine((n) => Number.isFinite(n) && n !== 0),
        price_unit: z.number().optional().nullable()
      })
    )
    .min(1)
    .max(500)
});
