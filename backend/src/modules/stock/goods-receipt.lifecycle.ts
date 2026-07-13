import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { appendTenantAuditEvent, AuditEntityType } from "../../lib/tenant-audit";
import { applyStockReceipt } from "./stock.service";

export async function deleteGoodsReceiptDraft(
  tenantId: number,
  id: number,
  actorUserId: number | null,
  reasonRef?: string | null
): Promise<void> {
  const r = await prisma.goodsReceipt.findFirst({ where: { id, tenant_id: tenantId } });
  if (!r) throw new Error("NOT_FOUND");
  if (r.deleted_at != null) throw new Error("ALREADY_VOIDED");
  if (r.status !== "draft") throw new Error("NOT_DRAFT");
  const note =
    reasonRef != null && String(reasonRef).trim() ? String(reasonRef).trim().slice(0, 128) : null;
  const uid =
    actorUserId != null && Number.isFinite(actorUserId) && actorUserId > 0 ? actorUserId : null;
  const now = new Date();
  await prisma.goodsReceipt.update({
    where: { id },
    data: {
      deleted_at: now,
      deleted_by_user_id: uid,
      delete_reason_ref: note
    }
  });
  await appendTenantAuditEvent({
    tenantId,
    actorUserId: uid,
    entityType: AuditEntityType.goods_receipt,
    entityId: String(id),
    action: "void",
    payload: { number: r.number, soft: true, draft: true, ...(note ? { reason: note } : {}) }
  });
}

export async function restoreGoodsReceiptDraft(
  tenantId: number,
  id: number,
  actorUserId: number | null
): Promise<void> {
  const r = await prisma.goodsReceipt.findFirst({ where: { id, tenant_id: tenantId } });
  if (!r) throw new Error("NOT_FOUND");
  if (r.deleted_at == null) throw new Error("NOT_VOIDED");
  if (r.status !== "draft") throw new Error("NOT_DRAFT");
  await prisma.goodsReceipt.update({
    where: { id },
    data: { deleted_at: null, deleted_by_user_id: null, delete_reason_ref: null }
  });
  await appendTenantAuditEvent({
    tenantId,
    actorUserId,
    entityType: AuditEntityType.goods_receipt,
    entityId: String(id),
    action: "restore",
    payload: { number: r.number, draft: true }
  });
}

export async function getGoodsReceiptDetail(tenantId: number, id: number) {
  const r = await prisma.goodsReceipt.findFirst({
    where: { id, tenant_id: tenantId },
    include: {
      warehouse: { select: { id: true, name: true } },
      supplier: { select: { id: true, name: true } },
      deleted_by: { select: { id: true, name: true } },
      lines: {
        orderBy: { sort_order: "asc" },
        include: { product: { select: { id: true, sku: true, name: true, category_id: true } } }
      }
    }
  });
  if (!r) return null;
  const dbid = r.deleted_by_user_id ?? null;
  return {
    id: r.id,
    number: r.number,
    status: r.status,
    created_at: r.created_at.toISOString(),
    receipt_at: r.receipt_at?.toISOString() ?? null,
    comment: r.comment,
    price_type: r.price_type,
    external_ref: r.external_ref,
    total_qty: r.total_qty.toString(),
    total_sum: r.total_sum.toString(),
    total_volume_m3: r.total_volume_m3.toString(),
    total_weight_kg: r.total_weight_kg.toString(),
    deleted_at: r.deleted_at ? r.deleted_at.toISOString() : null,
    deleted_by_user_id: dbid,
    deleted_by_name: r.deleted_by?.name ?? null,
    delete_reason_ref: r.delete_reason_ref?.trim() || null,
    warehouse: r.warehouse,
    supplier: r.supplier,
    lines: r.lines.map((ln) => ({
      id: ln.id,
      product_id: ln.product_id,
      category_id: ln.product.category_id,
      sku: ln.product.sku,
      product_name: ln.product.name,
      qty: ln.qty.toString(),
      unit_price: ln.unit_price.toString(),
      line_total: ln.line_total.toString(),
      defect_qty: ln.defect_qty?.toString() ?? null,
      volume_m3: ln.volume_m3?.toString() ?? null,
      weight_kg: ln.weight_kg?.toString() ?? null
    }))
  };
}

export async function updateGoodsReceiptStatus(
  tenantId: number,
  id: number,
  status: "draft" | "editing" | "posted" | "cancelled",
  actorUserId: number | null
): Promise<{ id: number; number: string; status: string }> {
  const rec = await prisma.goodsReceipt.findFirst({
    where: { id, tenant_id: tenantId, deleted_at: null },
    include: { lines: { select: { product_id: true, qty: true } } }
  });
  if (!rec) throw new Error("NOT_FOUND");
  if (rec.status === status) {
    return { id: rec.id, number: rec.number, status: rec.status };
  }

  const from = rec.status;
  const allowedTransitions: Record<string, Set<string>> = {
    draft: new Set(["draft", "editing", "posted", "cancelled"]),
    editing: new Set(["draft", "editing", "posted", "cancelled"]),
    posted: new Set(["posted", "cancelled"]),
    cancelled: new Set(["cancelled"])
  };
  const allowed = allowedTransitions[from];
  if (!allowed || !allowed.has(status)) {
    if (from === "cancelled") throw new Error("CANCELLED_IMMUTABLE");
    if (from === "posted") throw new Error("POSTED_IMMUTABLE");
    throw new Error("INVALID_TRANSITION");
  }

  if ((from === "draft" || from === "editing") && status === "posted") {
    await applyStockReceipt(
      tenantId,
      {
        warehouse_id: rec.warehouse_id,
        items: rec.lines.map((l) => ({ product_id: l.product_id, qty: Number(l.qty) })),
        note: `Поступление ${rec.number}`
      },
      actorUserId,
      { skipAudit: true }
    );
  }

  const updated = await prisma.goodsReceipt.update({
    where: { id: rec.id },
    data: { status }
  });

  await appendTenantAuditEvent({
    tenantId,
    actorUserId,
    entityType: AuditEntityType.goods_receipt,
    entityId: String(rec.id),
    action: "status_change",
    payload: { number: rec.number, from, to: status }
  });

  return { id: updated.id, number: updated.number, status: updated.status };
}
