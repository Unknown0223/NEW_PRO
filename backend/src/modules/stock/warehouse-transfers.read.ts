import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { invalidateStock } from "../../lib/redis-cache";
import { appendTenantAuditEvent, AuditEntityType } from "../../lib/tenant-audit";
import { buildTransferPdf } from "./warehouse-transfers-pdf";
import type { TransferDetail, TransferLineRow, TransferPdfResult } from "./warehouse-transfers.types";

export async function getTransferById(
  tenantId: number,
  id: number
): Promise<TransferDetail | null> {
  const transfers = await prisma.$queryRaw<
    {
      id: number;
      number: string;
      status: string;
      source_warehouse_id: number;
      source_warehouse_name: string;
      destination_warehouse_id: number;
      destination_warehouse_name: string;
      comment: string | null;
      planned_date: Date | null;
      started_at: Date | null;
      received_at: Date | null;
      created_at: Date;
      created_by_user_id: number | null;
      received_by_user_id: number | null;
      created_by_name: string | null;
      created_by_login: string | null;
      received_by_name: string | null;
      received_by_login: string | null;
    }[]
  >(
    Prisma.sql`
      SELECT t.*,
             sw.name as source_warehouse_name,
             dw.name as destination_warehouse_name,
             cr.name as created_by_name,
             cr.login as created_by_login,
             rv.name as received_by_name,
             rv.login as received_by_login
      FROM warehouse_transfers t
      JOIN warehouses sw ON t.source_warehouse_id = sw.id
      JOIN warehouses dw ON t.destination_warehouse_id = dw.id
      LEFT JOIN users cr ON cr.id = t.created_by_user_id AND cr.tenant_id = t.tenant_id
      LEFT JOIN users rv ON rv.id = t.received_by_user_id AND rv.tenant_id = t.tenant_id
      WHERE t.id = ${id} AND t.tenant_id = ${tenantId}
    `
  );

  if (!transfers[0]) return null;
  const t = transfers[0];

  const linesRaw = await prisma.$queryRaw<
    {
      id: number;
      product_id: number;
      product_sku: string;
      product_name: string;
      qty: Prisma.Decimal;
      received_qty: Prisma.Decimal | null;
      batch_no: string | null;
      comment: string | null;
      sort_order: number;
    }[]
  >(
    Prisma.sql`
      SELECT l.id, l.product_id, l.qty, l.received_qty,
             l.batch_no, l.comment, l.sort_order,
             p.sku as product_sku, p.name as product_name
      FROM warehouse_transfer_lines l
      JOIN products p ON l.product_id = p.id
      WHERE l.transfer_id = ${t.id}
      ORDER BY l.sort_order ASC
    `
  );

  const lines: TransferLineRow[] = linesRaw.map((l) => ({
    id: l.id,
    product_id: l.product_id,
    product_sku: l.product_sku,
    product_name: l.product_name,
    qty: l.qty.toString(),
    received_qty: l.received_qty?.toString() ?? null,
    batch_no: l.batch_no,
    comment: l.comment,
    sort_order: l.sort_order,
  }));

  return {
    id: t.id,
    number: t.number,
    status: t.status,
    source_warehouse_id: t.source_warehouse_id,
    source_warehouse_name: t.source_warehouse_name,
    destination_warehouse_id: t.destination_warehouse_id,
    destination_warehouse_name: t.destination_warehouse_name,
    comment: t.comment,
    planned_date: t.planned_date?.toISOString() ?? null,
    started_at: t.started_at?.toISOString() ?? null,
    received_at: t.received_at?.toISOString() ?? null,
    created_at: t.created_at.toISOString(),
    created_by_user_id: t.created_by_user_id,
    created_by_name: t.created_by_name,
    created_by_login: t.created_by_login,
    received_by_user_id: t.received_by_user_id,
    received_by_name: t.received_by_name,
    received_by_login: t.received_by_login,
    lines,
  };
}

export async function getTransferPdfById(
  tenantId: number,
  id: number
): Promise<TransferPdfResult> {
  const detail = await getTransferById(tenantId, id);
  if (!detail) throw new Error("NOT_FOUND");
  const buffer = await buildTransferPdf(detail);
  const day = new Date().toISOString().slice(0, 10);
  return {
    buffer,
    filename: `warehouse_transfer_${detail.number}_${day}.pdf`.replace(/\s+/g, "_"),
  };
}
