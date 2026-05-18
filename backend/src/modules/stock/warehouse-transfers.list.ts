import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { invalidateStock } from "../../lib/redis-cache";
import { appendTenantAuditEvent, AuditEntityType } from "../../lib/tenant-audit";
import type { GetTransfersOptions, TransferListRow } from "./warehouse-transfers.types";

export async function getTransfers(
  tenantId: number,
  options: GetTransfersOptions
): Promise<{ data: TransferListRow[]; total: number }> {
  const page = options.page ?? 1;
  const limit = options.limit ?? 20;

  const status = options.status?.trim() ?? null;
  const srcWh = options.source_warehouse_id ?? null;
  const dstWh = options.destination_warehouse_id ?? null;

  // Build where clause safely
  const baseWhere = Prisma.sql`t.tenant_id = ${tenantId}`;
  const extraParts: Prisma.Sql[] = [];
  if (status) extraParts.push(Prisma.sql`t.status = ${status}`);
  if (srcWh != null) extraParts.push(Prisma.sql`t.source_warehouse_id = ${srcWh}`);
  if (dstWh != null) extraParts.push(Prisma.sql`t.destination_warehouse_id = ${dstWh}`);

  const whereClause =
    extraParts.length > 0
      ? Prisma.sql`${baseWhere} AND ${Prisma.join(extraParts, " AND ")}`
      : baseWhere;

  const totalCount = await prisma.$queryRaw<{ total: bigint }[]>(
    Prisma.sql`SELECT COUNT(*) AS total FROM warehouse_transfers t WHERE ${whereClause}`
  );
  const total = Number(totalCount[0].total);

  const rows = await prisma.$queryRaw<
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
      line_count: bigint;
      total_qty: Prisma.Decimal | null;
    }[]
  >(
    Prisma.sql`
      SELECT t.id, t.number, t.status,
             t.source_warehouse_id, t.destination_warehouse_id,
             t.comment, t.planned_date, t.started_at, t.received_at, t.created_at,
             t.created_by_user_id, t.received_by_user_id,
             sw.name as source_warehouse_name,
             dw.name as destination_warehouse_name,
             cr.name as created_by_name,
             cr.login as created_by_login,
             rv.name as received_by_name,
             rv.login as received_by_login,
             COALESCE(lc.cnt, 0) as line_count,
             COALESCE(lc.sum_qty, 0) as total_qty
      FROM warehouse_transfers t
      JOIN warehouses sw ON t.source_warehouse_id = sw.id
      JOIN warehouses dw ON t.destination_warehouse_id = dw.id
      LEFT JOIN users cr ON cr.id = t.created_by_user_id AND cr.tenant_id = t.tenant_id
      LEFT JOIN users rv ON rv.id = t.received_by_user_id AND rv.tenant_id = t.tenant_id
      LEFT JOIN (
        SELECT transfer_id,
               COUNT(*)::bigint as cnt,
               SUM(qty) as sum_qty
        FROM warehouse_transfer_lines
        GROUP BY transfer_id
      ) lc ON lc.transfer_id = t.id
      WHERE ${whereClause}
      ORDER BY t.created_at DESC
      LIMIT ${limit}
      OFFSET ${(page - 1) * limit}
    `
  );

  const data: TransferListRow[] = rows.map((r) => ({
    id: r.id,
    number: r.number,
    status: r.status,
    source_warehouse_id: r.source_warehouse_id,
    source_warehouse_name: r.source_warehouse_name,
    destination_warehouse_id: r.destination_warehouse_id,
    destination_warehouse_name: r.destination_warehouse_name,
    comment: r.comment,
    planned_date: r.planned_date?.toISOString() ?? null,
    started_at: r.started_at?.toISOString() ?? null,
    received_at: r.received_at?.toISOString() ?? null,
    created_at: r.created_at.toISOString(),
    created_by_user_id: r.created_by_user_id,
    created_by_name: r.created_by_name,
    created_by_login: r.created_by_login,
    received_by_user_id: r.received_by_user_id,
    received_by_name: r.received_by_name,
    received_by_login: r.received_by_login,
    line_count: Number(r.line_count),
    total_qty: (r.total_qty ?? new Prisma.Decimal(0)).toString(),
  }));

  return { data, total };
}

// ---------------------------------------------------------------------------
// 3. getTransferById
// ---------------------------------------------------------------------------
