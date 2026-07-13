import ExcelJS from "exceljs";
import XLSX from "xlsx";
import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { getRedisForApp, invalidateStock } from "../../lib/redis-cache";
import { appendTenantAuditEvent, AuditEntityType } from "../../lib/tenant-audit";

export type StockReceiptInput = {
  warehouse_id: number;
  items: { product_id: number; qty: number }[];
  note?: string | null;
};

/**
 * Prihod: omborga kirim (atomik upsert + increment).
 */
export async function applyStockReceipt(
  tenantId: number,
  input: StockReceiptInput,
  actorUserId: number | null = null,
  options?: { skipAudit?: boolean }
): Promise<void> {
  const wh = await prisma.warehouse.findFirst({
    where: { id: input.warehouse_id, tenant_id: tenantId }
  });
  if (!wh) {
    throw new Error("BAD_WAREHOUSE");
  }
  if (!input.items.length) {
    throw new Error("EMPTY_ITEMS");
  }

  await prisma.$transaction(async (tx) => {
    for (const line of input.items) {
      if (!Number.isFinite(line.qty) || line.qty <= 0) {
        throw new Error("BAD_QTY");
      }
      const p = await tx.product.findFirst({
        where: { id: line.product_id, tenant_id: tenantId }
      });
      if (!p) {
        throw new Error("BAD_PRODUCT");
      }
      const delta = new Prisma.Decimal(line.qty);
      await tx.stock.upsert({
        where: {
          tenant_id_warehouse_id_product_id: {
            tenant_id: tenantId,
            warehouse_id: input.warehouse_id,
            product_id: line.product_id
          }
        },
        create: {
          tenant_id: tenantId,
          warehouse_id: input.warehouse_id,
          product_id: line.product_id,
          qty: delta
        },
        update: {
          qty: { increment: delta }
        }
      });
    }
  });

  void invalidateStock(tenantId, input.warehouse_id);

  if (!options?.skipAudit) {
    await appendTenantAuditEvent({
      tenantId,
      actorUserId,
      entityType: AuditEntityType.stock,
      entityId: input.warehouse_id,
      action: "receipt",
      payload: {
        line_count: input.items.length,
        note: input.note ?? null,
        product_ids: input.items.map((i) => i.product_id)
      }
    });
  }
}

export type StockAdjustmentInput = {
  warehouse_id: number;
  product_id: number;
  delta: number;
  note?: string | null;
};

/**
 * Bir tranzaksiya ichida qoldiqni o‘zgartirish (hujjat + bir nechta qator uchun).
 * Manfiy jami yoki rezervdan past qoldiq taqiqlanadi.
 */
export async function applyStockAdjustmentInTx(
  tx: Prisma.TransactionClient,
  tenantId: number,
  input: StockAdjustmentInput
): Promise<{ qty_before: string; qty_after: string }> {
  if (!Number.isFinite(input.delta) || input.delta === 0) {
    throw new Error("BAD_DELTA");
  }
  const delta = new Prisma.Decimal(input.delta);

  const wh = await tx.warehouse.findFirst({
    where: { id: input.warehouse_id, tenant_id: tenantId }
  });
  if (!wh) throw new Error("BAD_WAREHOUSE");
  const p = await tx.product.findFirst({
    where: { id: input.product_id, tenant_id: tenantId }
  });
  if (!p) throw new Error("BAD_PRODUCT");

  const row = await tx.stock.findUnique({
    where: {
      tenant_id_warehouse_id_product_id: {
        tenant_id: tenantId,
        warehouse_id: input.warehouse_id,
        product_id: input.product_id
      }
    }
  });
  const before = row?.qty ?? new Prisma.Decimal(0);
  const reserved = row?.reserved_qty ?? new Prisma.Decimal(0);
  const after = before.add(delta);
  if (after.lt(0)) throw new Error("NEGATIVE_QTY");
  if (after.lt(reserved)) throw new Error("BELOW_RESERVED");

  await tx.stock.upsert({
    where: {
      tenant_id_warehouse_id_product_id: {
        tenant_id: tenantId,
        warehouse_id: input.warehouse_id,
        product_id: input.product_id
      }
    },
    create: {
      tenant_id: tenantId,
      warehouse_id: input.warehouse_id,
      product_id: input.product_id,
      qty: after,
      reserved_qty: new Prisma.Decimal(0)
    },
    update: { qty: after }
  });

  return { qty_before: before.toString(), qty_after: after.toString() };
}

/**
 * Inventarsiz qoldiq tuzatish: `qty += delta`. Manfiy jami yoki rezervdan past qoldiq taqiqlanadi.
 */
export async function applyStockAdjustment(
  tenantId: number,
  input: StockAdjustmentInput,
  actorUserId: number | null = null
): Promise<{ qty_before: string; qty_after: string }> {
  if (!Number.isFinite(input.delta) || input.delta === 0) {
    throw new Error("BAD_DELTA");
  }
  const delta = new Prisma.Decimal(input.delta);

  const { qty_before, qty_after } = await prisma.$transaction(async (tx) =>
    applyStockAdjustmentInTx(tx, tenantId, input)
  );

  await appendTenantAuditEvent({
    tenantId,
    actorUserId,
    entityType: AuditEntityType.stock,
    entityId: `${input.warehouse_id}:${input.product_id}`,
    action: "adjustment",
    payload: {
      warehouse_id: input.warehouse_id,
      product_id: input.product_id,
      delta: delta.toString(),
      qty_before,
      qty_after,
      note: input.note ?? null
    }
  });

  void invalidateStock(tenantId, input.warehouse_id);

  return { qty_before, qty_after };
}

