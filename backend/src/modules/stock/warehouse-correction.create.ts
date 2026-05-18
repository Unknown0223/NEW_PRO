import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { invalidateStock } from "../../lib/redis-cache";
import { logger } from "../../config/logger";
import { appendTenantAuditEvent, AuditEntityType } from "../../lib/tenant-audit";
import { applyStockAdjustmentInTx, type StockAdjustmentInput } from "./stock.service";
import {
  parseOccurredAt,
  type WarehouseCorrectionKind
} from "./warehouse-correction.list";

const wcLog = logger.child({ module: "warehouse_correction" });

const CORRECTION_KINDS = ["correction"] as const;
export type CreateWarehouseCorrectionBulkInput = {
  warehouse_id: number;
  kind: WarehouseCorrectionKind;
  price_type?: string | null;
  occurred_at?: string | null;
  comment?: string | null;
  items: { product_id: number; delta: number; price_unit?: number | null }[];
};

/**
 * Bir hujjat + bir nechta qator: barcha qoldiq o‘zgarishlari bitta tranzaksiyada.
 */
export async function createWarehouseCorrectionBulk(
  tenantId: number,
  input: CreateWarehouseCorrectionBulkInput,
  actorUserId: number | null
): Promise<{ id: number }> {
  if (!input.items.length) throw new Error("EMPTY_ITEMS");
  if (input.items.length > 500) throw new Error("TOO_MANY_LINES");

  const wh = await prisma.warehouse.findFirst({
    where: { id: input.warehouse_id, tenant_id: tenantId }
  });
  if (!wh) throw new Error("BAD_WAREHOUSE");

  if (!CORRECTION_KINDS.includes(input.kind)) throw new Error("BAD_KIND");

  wcLog.info(
    {
      op: "bulk_start",
      tenantId,
      warehouse_id: input.warehouse_id,
      warehouseName: wh.name,
      kind: input.kind,
      line_count: input.items.length,
      price_type: input.price_type ?? null,
      actorUserId,
      has_comment: Boolean(input.comment?.trim())
    },
    "warehouse_correction bulk transaction start"
  );

  const occurredAt = parseOccurredAt(input.occurred_at ?? undefined);

  const docId = await prisma.$transaction(async (tx) => {
    let totalQtyDelta = new Prisma.Decimal(0);
    let totalVol = new Prisma.Decimal(0);
    let totalAmt = new Prisma.Decimal(0);
    const currencyDefault = "UZS";

    const lineCreates: {
      product_id: number;
      qty_before: Prisma.Decimal;
      qty_delta: Prisma.Decimal;
      price_unit: Prisma.Decimal | null;
      line_amount: Prisma.Decimal | null;
      volume_m3: Prisma.Decimal | null;
    }[] = [];

    for (const item of input.items) {
      if (!Number.isFinite(item.delta) || item.delta === 0) {
        throw new Error("BAD_DELTA");
      }

      const adjInput: StockAdjustmentInput = {
        warehouse_id: input.warehouse_id,
        product_id: item.product_id,
        delta: item.delta
      };
      const { qty_before, qty_after } = await applyStockAdjustmentInTx(tx, tenantId, adjInput);

      const product = await tx.product.findFirst({
        where: { id: item.product_id, tenant_id: tenantId },
        select: { volume_m3: true }
      });
      if (!product) throw new Error("BAD_PRODUCT");

      const deltaDec = new Prisma.Decimal(item.delta);
      totalQtyDelta = totalQtyDelta.add(deltaDec);

      let volLine: Prisma.Decimal | null = null;
      if (product.volume_m3 != null) {
        const v = product.volume_m3.mul(deltaDec);
        volLine = v;
        totalVol = totalVol.add(v);
      }

      let priceUnit: Prisma.Decimal | null = null;
      let lineAmount: Prisma.Decimal | null = null;
      if (item.price_unit != null && Number.isFinite(item.price_unit)) {
        priceUnit = new Prisma.Decimal(item.price_unit);
        lineAmount = priceUnit.mul(deltaDec);
        totalAmt = totalAmt.add(lineAmount);
      }

      lineCreates.push({
        product_id: item.product_id,
        qty_before: new Prisma.Decimal(qty_before),
        qty_delta: deltaDec,
        price_unit: priceUnit,
        line_amount: lineAmount,
        volume_m3: volLine
      });
    }

    const doc = await tx.warehouseCorrection.create({
      data: {
        tenant_id: tenantId,
        warehouse_id: input.warehouse_id,
        created_by_user_id:
          actorUserId != null && Number.isFinite(actorUserId) && actorUserId > 0
            ? Math.floor(actorUserId)
            : null,
        kind: input.kind,
        price_type: input.price_type?.trim() || null,
        occurred_at: occurredAt,
        comment: input.comment?.trim() || null,
        total_qty_delta: totalQtyDelta,
        total_volume_m3: totalVol,
        total_amount: totalAmt,
        currency: currencyDefault,
        line_count: lineCreates.length,
        lines: { create: lineCreates }
      },
      select: { id: true }
    });

    return doc.id;
  });

  const summary = await prisma.warehouseCorrection.findUnique({
    where: { id: docId },
    select: {
      total_qty_delta: true,
      total_volume_m3: true,
      total_amount: true,
      line_count: true,
      currency: true
    }
  });
  wcLog.info(
    {
      op: "bulk_committed",
      tenantId,
      documentId: docId,
      warehouse_id: input.warehouse_id,
      kind: input.kind,
      line_count: summary?.line_count ?? input.items.length,
      total_qty_delta: summary?.total_qty_delta?.toString() ?? null,
      total_volume_m3: summary?.total_volume_m3?.toString() ?? null,
      total_amount: summary?.total_amount?.toString() ?? null,
      currency: summary?.currency ?? null,
      actorUserId
    },
    "warehouse_correction bulk committed"
  );

  await appendTenantAuditEvent({
    tenantId,
    actorUserId,
    entityType: AuditEntityType.stock,
    entityId: docId,
    action: "warehouse_correction.bulk",
    payload: {
      warehouse_id: input.warehouse_id,
      kind: input.kind,
      line_count: input.items.length,
      price_type: input.price_type ?? null
    }
  });

  void invalidateStock(tenantId, input.warehouse_id);

  return { id: docId };
}
