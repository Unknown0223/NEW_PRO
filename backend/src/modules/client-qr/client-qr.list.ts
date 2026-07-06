import { randomBytes } from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { appendTenantAuditEvent } from "../../lib/tenant-audit";

import type { QrListQuery, QrListRow } from "./client-qr.types";
import { buildWhere, toCsv } from "./client-qr.helpers";

export async function listQrCodesForTenant(tenantId: number, q: QrListQuery) {
  const where = buildWhere(tenantId, q);
  const offset = (q.page - 1) * q.limit;
  const rows = await prisma.$queryRaw<QrListRow[]>(Prisma.sql`
    SELECT
      q.id,
      q.qr_code,
      q.status,
      q.created_at::text,
      q.printed_at::text,
      q.bound_at::text,
      q.detached_at::text,
      q.client_id,
      c.name AS client_name,
      c.zone,
      c.region,
      c.city,
      u1.name AS created_by_name,
      u2.name AS bound_by_name
    FROM client_qr_codes q
    LEFT JOIN clients c
      ON c.id = q.client_id AND c.tenant_id = q.tenant_id
    LEFT JOIN users u1
      ON u1.id = q.created_by_user_id AND u1.tenant_id = q.tenant_id
    LEFT JOIN users u2
      ON u2.id = q.bound_by_user_id AND u2.tenant_id = q.tenant_id
    WHERE ${where}
    ORDER BY q.created_at DESC, q.id DESC
    OFFSET ${offset}
    LIMIT ${q.limit}
  `);
  const countRows = await prisma.$queryRaw<Array<{ total: bigint }>>(Prisma.sql`
    SELECT COUNT(*)::bigint AS total
    FROM client_qr_codes q
    LEFT JOIN clients c
      ON c.id = q.client_id AND c.tenant_id = q.tenant_id
    LEFT JOIN users u1
      ON u1.id = q.created_by_user_id AND u1.tenant_id = q.tenant_id
    LEFT JOIN users u2
      ON u2.id = q.bound_by_user_id AND u2.tenant_id = q.tenant_id
    WHERE ${where}
  `);
  const total = Number(countRows[0]?.total ?? 0n);
  return { data: rows, total, page: q.page, limit: q.limit };
}

export async function exportQrCodesRows(tenantId: number, q: QrListQuery): Promise<QrListRow[]> {
  const where = buildWhere(tenantId, q);
  return prisma.$queryRaw<QrListRow[]>(Prisma.sql`
    SELECT
      q.id,
      q.qr_code,
      q.status,
      q.created_at::text,
      q.printed_at::text,
      q.bound_at::text,
      q.detached_at::text,
      q.client_id,
      c.name AS client_name,
      c.zone,
      c.region,
      c.city,
      u1.name AS created_by_name,
      u2.name AS bound_by_name
    FROM client_qr_codes q
    LEFT JOIN clients c
      ON c.id = q.client_id AND c.tenant_id = q.tenant_id
    LEFT JOIN users u1
      ON u1.id = q.created_by_user_id AND u1.tenant_id = q.tenant_id
    LEFT JOIN users u2
      ON u2.id = q.bound_by_user_id AND u2.tenant_id = q.tenant_id
    WHERE ${where}
    ORDER BY q.created_at DESC, q.id DESC
  `);
}

export async function exportQrCodesCsv(tenantId: number, q: QrListQuery): Promise<string> {
  const rows = await exportQrCodesRows(tenantId, q);
  return toCsv(rows);
}
