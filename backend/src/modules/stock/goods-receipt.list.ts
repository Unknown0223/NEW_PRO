import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { appendTenantAuditEvent, AuditEntityType } from "../../lib/tenant-audit";
import { resolvePriceTypeKeyToLabel } from "../tenant-settings/finance-refs";
import { loadPriceTypeEntriesForResolve } from "../tenant-settings/tenant-settings.service";
import type { GoodsReceiptListRow } from "./goods-receipt.types";

export async function listGoodsReceipts(
  tenantId: number,
  q: {
    warehouse_id?: number;
    supplier_id?: number;
    status?: string;
    date_from?: string;
    date_to?: string;
    search?: string;
    page: number;
    limit: number;
    /** true — faqat arxiv */
    archive?: boolean;
  }
): Promise<{ data: GoodsReceiptListRow[]; total: number }> {
  const where: Prisma.GoodsReceiptWhereInput = { tenant_id: tenantId };
  if (q.archive) {
    where.deleted_at = { not: null };
  } else {
    where.deleted_at = null;
  }
  if (q.warehouse_id != null && q.warehouse_id > 0) where.warehouse_id = q.warehouse_id;
  if (q.supplier_id != null && q.supplier_id > 0) where.supplier_id = q.supplier_id;
  if (q.status?.trim()) where.status = q.status.trim();
  if (q.date_from?.trim() || q.date_to?.trim()) {
    const range: Prisma.DateTimeFilter = {};
    if (q.date_from?.trim()) range.gte = new Date(q.date_from.trim());
    if (q.date_to?.trim()) {
      const end = new Date(q.date_to.trim());
      end.setHours(23, 59, 59, 999);
      range.lte = end;
    }
    where.created_at = range;
  }
  if (q.search?.trim()) {
    const s = q.search.trim();
    where.OR = [
      { number: { contains: s, mode: "insensitive" } },
      { comment: { contains: s, mode: "insensitive" } },
      { external_ref: { contains: s, mode: "insensitive" } }
    ];
  }

  const [total, rows] = await prisma.$transaction([
    prisma.goodsReceipt.count({ where }),
    prisma.goodsReceipt.findMany({
      where,
      orderBy: { created_at: "desc" },
      skip: (q.page - 1) * q.limit,
      take: q.limit,
      include: {
        warehouse: { select: { id: true, name: true } },
        supplier: { select: { id: true, name: true } },
        deleted_by: { select: { id: true, name: true } }
      }
    })
  ]);

  // «Тип цены» ustuni: kalit (kod) o‘rniga spravochnikdagi nom
  const ptEntries = await loadPriceTypeEntriesForResolve(tenantId);

  const data: GoodsReceiptListRow[] = rows.map((r) => {
    const dbid = r.deleted_by_user_id ?? null;
    return {
      id: r.id,
      number: r.number,
      status: r.status,
      created_at: r.created_at.toISOString(),
      receipt_at: r.receipt_at?.toISOString() ?? null,
      total_qty: r.total_qty.toString(),
      total_sum: r.total_sum.toString(),
      total_volume_m3: r.total_volume_m3.toString(),
      total_weight_kg: r.total_weight_kg.toString(),
      comment: r.comment,
      price_type: resolvePriceTypeKeyToLabel(r.price_type, ptEntries) ?? r.price_type,
      external_ref: r.external_ref,
      warehouse_id: r.warehouse_id,
      warehouse_name: r.warehouse.name,
      supplier_id: r.supplier_id,
      supplier_name: r.supplier?.name ?? null,
      deleted_at: r.deleted_at ? r.deleted_at.toISOString() : null,
      deleted_by_user_id: dbid,
      deleted_by_name: r.deleted_by?.name ?? null,
      delete_reason_ref: r.delete_reason_ref?.trim() || null
    };
  });

  return { data, total };
}
