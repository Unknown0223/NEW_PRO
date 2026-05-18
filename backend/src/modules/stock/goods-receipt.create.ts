import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { appendTenantAuditEvent, AuditEntityType } from "../../lib/tenant-audit";
import { applyStockReceipt } from "./stock.service";

import type { UpsertGoodsReceiptInput } from "./goods-receipt.types";

export async function createGoodsReceipt(
  tenantId: number,
  input: UpsertGoodsReceiptInput,
  actorUserId: number | null
): Promise<{ id: number; number: string }> {
  if (!input.lines.length) throw new Error("EMPTY_LINES");

  const wh = await prisma.warehouse.findFirst({
    where: { id: input.warehouse_id, tenant_id: tenantId }
  });
  if (!wh) throw new Error("BAD_WAREHOUSE");

  if (input.supplier_id != null && input.supplier_id > 0) {
    const sup = await prisma.supplier.findFirst({
      where: { id: input.supplier_id, tenant_id: tenantId, is_active: true }
    });
    if (!sup) throw new Error("BAD_SUPPLIER");
  }

  const pt = input.price_type.trim();
  if (!pt) throw new Error("BAD_PRICE_TYPE");

  const productIds = [...new Set(input.lines.map((l) => l.product_id))];
  const products = await prisma.product.findMany({
    where: { tenant_id: tenantId, id: { in: productIds }, is_active: true },
    include: {
      prices: { where: { tenant_id: tenantId, price_type: pt }, take: 1 }
    }
  });
  const byId = new Map(products.map((p) => [p.id, p]));
  for (const l of input.lines) {
    if (!byId.has(l.product_id)) throw new Error("BAD_PRODUCT");
  }

  const lineCreates: Prisma.GoodsReceiptLineCreateWithoutReceiptInput[] = [];
  let totalQty = new Prisma.Decimal(0);
  let totalSum = new Prisma.Decimal(0);
  let totalVol = new Prisma.Decimal(0);
  let totalWt = new Prisma.Decimal(0);

  for (let i = 0; i < input.lines.length; i++) {
    const l = input.lines[i]!;
    const p = byId.get(l.product_id)!;
    const qty = new Prisma.Decimal(l.qty);
    if (qty.lte(0)) throw new Error("BAD_QTY");

    let unitPrice: Prisma.Decimal;
    if (l.unit_price != null && Number.isFinite(l.unit_price) && l.unit_price >= 0) {
      unitPrice = new Prisma.Decimal(l.unit_price);
    } else if (p.prices[0]) {
      unitPrice = new Prisma.Decimal(p.prices[0].price.toString());
    } else {
      unitPrice = new Prisma.Decimal(0);
    }

    const lineTotal = qty.mul(unitPrice);
    const defect =
      l.defect_qty != null && Number.isFinite(l.defect_qty) && l.defect_qty > 0
        ? new Prisma.Decimal(l.defect_qty)
        : null;

    let volLine: Prisma.Decimal | null = null;
    if (p.volume_m3 != null) {
      volLine = new Prisma.Decimal(p.volume_m3.toString()).mul(qty);
      totalVol = totalVol.add(volLine);
    }
    let wtLine: Prisma.Decimal | null = null;
    if (p.weight_kg != null) {
      wtLine = new Prisma.Decimal(p.weight_kg.toString()).mul(qty);
      totalWt = totalWt.add(wtLine);
    }

    lineCreates.push({
      product: { connect: { id: l.product_id } },
      qty,
      unit_price: unitPrice,
      line_total: lineTotal,
      defect_qty: defect,
      volume_m3: volLine,
      weight_kg: wtLine,
      sort_order: i
    });

    totalQty = totalQty.add(qty);
    totalSum = totalSum.add(lineTotal);
  }

  const status = input.status === "draft" ? "draft" : "posted";
  const tmp = `TMP-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  const rec = await prisma.goodsReceipt.create({
    data: {
      tenant_id: tenantId,
      number: tmp,
      warehouse_id: input.warehouse_id,
      supplier_id:
        input.supplier_id != null && input.supplier_id > 0 ? input.supplier_id : null,
      status,
      // Agar klient sana yubormasa — qabul qilish (yaratish) vaqti avtomatik yoziladi.
      receipt_at:
        input.receipt_at != null && String(input.receipt_at).trim() !== ""
          ? new Date(String(input.receipt_at).trim())
          : new Date(),
      comment: input.comment?.trim() || null,
      price_type: pt,
      external_ref: input.external_ref?.trim() || null,
      total_qty: totalQty,
      total_sum: totalSum,
      total_volume_m3: totalVol,
      total_weight_kg: totalWt,
      created_by_user_id: actorUserId ?? undefined,
      lines: { create: lineCreates }
    }
  });

  const number = `GR-${String(rec.id).padStart(6, "0")}`;
  await prisma.goodsReceipt.update({ where: { id: rec.id }, data: { number } });

  if (status === "posted") {
    await applyStockReceipt(
      tenantId,
      {
        warehouse_id: input.warehouse_id,
        items: input.lines.map((l) => ({ product_id: l.product_id, qty: Number(l.qty) })),
        note: `Поступление ${number}`
      },
      actorUserId,
      { skipAudit: true }
    );
  }

  await appendTenantAuditEvent({
    tenantId,
    actorUserId,
    entityType: AuditEntityType.goods_receipt,
    entityId: String(rec.id),
    action: "create",
    payload: { number, status, line_count: input.lines.length }
  });

  return { id: rec.id, number };
}

