import ExcelJS from "exceljs";
import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { env } from "../../config/env";
import { appendTenantAuditEvent, AuditEntityType } from "../../lib/tenant-audit";

export const productListInclude = {
  category: { select: { id: true, name: true } },
  product_group: { select: { id: true, name: true } },
  brand: { select: { id: true, name: true } },
  manufacturer: { select: { id: true, name: true } },
  segment: { select: { id: true, name: true } }
} as const;

export function decOpt(v: number | string | null | undefined): Prisma.Decimal | null | undefined {
  if (v === undefined) return undefined;
  if (v === null || v === "") return null;
  const n = typeof v === "number" ? v : Number.parseFloat(String(v).replace(",", "."));
  if (!Number.isFinite(n)) return null;
  return new Prisma.Decimal(String(n));
}

export async function assertProductCatalogFks(
  tenantId: number,
  input: {
    category_id?: number | null;
    product_group_id?: number | null;
    brand_id?: number | null;
    manufacturer_id?: number | null;
    segment_id?: number | null;
    segment_ids?: number[];
    trade_direction_ids?: number[];
  }
) {
  if (input.category_id != null) {
    const cat = await prisma.productCategory.findFirst({
      where: { id: input.category_id, tenant_id: tenantId }
    });
    if (!cat) throw new Error("BAD_CATEGORY");
  }
  if (input.product_group_id != null) {
    const x = await prisma.productCatalogGroup.findFirst({
      where: { id: input.product_group_id, tenant_id: tenantId }
    });
    if (!x) throw new Error("BAD_REF");
  }
  if (input.brand_id != null) {
    const x = await prisma.productBrand.findFirst({ where: { id: input.brand_id, tenant_id: tenantId } });
    if (!x) throw new Error("BAD_REF");
  }
  if (input.manufacturer_id != null) {
    const x = await prisma.productManufacturer.findFirst({
      where: { id: input.manufacturer_id, tenant_id: tenantId }
    });
    if (!x) throw new Error("BAD_REF");
  }
  if (input.segment_id != null) {
    const x = await prisma.productSegment.findFirst({ where: { id: input.segment_id, tenant_id: tenantId } });
    if (!x) throw new Error("BAD_REF");
  }
  const segmentIds = [...new Set(input.segment_ids ?? [])];
  if (segmentIds.length) {
    const count = await prisma.productSegment.count({
      where: { tenant_id: tenantId, id: { in: segmentIds } }
    });
    if (count !== segmentIds.length) throw new Error("BAD_REF");
  }
  const tradeIds = [...new Set(input.trade_direction_ids ?? [])];
  if (tradeIds.length) {
    const count = await prisma.tradeDirection.count({
      where: { tenant_id: tenantId, id: { in: tradeIds } }
    });
    if (count !== tradeIds.length) throw new Error("BAD_REF");
  }
}
