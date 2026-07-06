import type { FastifyRequest } from "fastify";
import type { Prisma } from "@prisma/client";
import { env } from "../../config/env";
import { assertExcelImportSize } from "../../lib/multipart-limits";

export type ProductListRow = {
  id: number;
  sku: string;
  name: string;
  unit: string;
  barcode: string | null;
  is_active: boolean;
  category_id: number | null;
  product_group_id: number | null;
  brand_id: number | null;
  manufacturer_id: number | null;
  segment_id: number | null;
  weight_kg: Prisma.Decimal | null;
  volume_m3: Prisma.Decimal | null;
  qty_per_block: number | null;
  dimension_unit: string | null;
  width_cm: Prisma.Decimal | null;
  height_cm: Prisma.Decimal | null;
  length_cm: Prisma.Decimal | null;
  ikpu_code: string | null;
  hs_code: string | null;
  sell_code: string | null;
  comment: string | null;
  sort_order: number | null;
  is_blocked: boolean;
  is_equipment: boolean;
  created_at: Date;
  category: { id: number; name: string } | null;
  product_group: { id: number; name: string } | null;
  brand: { id: number; name: string } | null;
  manufacturer: { id: number; name: string } | null;
  segment: { id: number; name: string } | null;
  prices?: { id: number; price_type: string; price: Prisma.Decimal; currency: string }[];
};

export async function readProductImportBuffer(
  request: FastifyRequest
): Promise<{ ok: true; buf: Buffer } | { ok: false; error: "NoFile" | "EmptyFile" }> {
  const file = await request.file({ limits: { fileSize: env.MULTIPART_EXCEL_MAX_BYTES } });
  if (!file) {
    return { ok: false, error: "NoFile" };
  }
  const buf = await file.toBuffer();
  if (buf.length === 0) {
    return { ok: false, error: "EmptyFile" };
  }
  assertExcelImportSize(buf.length);
  return { ok: true, buf };
}

export function mapProductToJson(r: ProductListRow) {
  const base = {
    id: r.id,
    sku: r.sku,
    name: r.name,
    unit: r.unit,
    barcode: r.barcode,
    is_active: r.is_active,
    category_id: r.category_id,
    product_group_id: r.product_group_id,
    brand_id: r.brand_id,
    manufacturer_id: r.manufacturer_id,
    segment_id: r.segment_id,
    weight_kg: r.weight_kg != null ? r.weight_kg.toString() : null,
    volume_m3: r.volume_m3 != null ? r.volume_m3.toString() : null,
    qty_per_block: r.qty_per_block,
    dimension_unit: r.dimension_unit,
    width_cm: r.width_cm != null ? r.width_cm.toString() : null,
    height_cm: r.height_cm != null ? r.height_cm.toString() : null,
    length_cm: r.length_cm != null ? r.length_cm.toString() : null,
    ikpu_code: r.ikpu_code,
    hs_code: r.hs_code,
    sell_code: r.sell_code,
    comment: r.comment,
    sort_order: r.sort_order,
    is_blocked: r.is_blocked,
    is_equipment: r.is_equipment,
    created_at: r.created_at.toISOString(),
    category: r.category ?? null,
    product_group: r.product_group ?? null,
    brand: r.brand ?? null,
    manufacturer: r.manufacturer ?? null,
    segment: r.segment ?? null
  };
  if (r.prices) {
    return {
      ...base,
      prices: r.prices.map((p) => ({
        id: p.id,
        price_type: p.price_type,
        price: p.price.toString(),
        currency: p.currency
      }))
    };
  }
  return base;
}
