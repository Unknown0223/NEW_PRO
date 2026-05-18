import { randomBytes } from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { appendTenantAuditEvent } from "../../lib/tenant-audit";

import type { ClientWithoutQrRow } from "./client-qr.types";
import { toClientsWithoutQrCsv } from "./client-qr.helpers";

export async function listClientsWithoutQr(
  tenantId: number,
  q: {
    page: number;
    limit: number;
    search?: string;
    zone?: string;
    region?: string;
    city?: string;
  }
) {
  const where: Prisma.Sql[] = [
    Prisma.sql`c.tenant_id = ${tenantId}`,
    Prisma.sql`c.is_active = TRUE`,
    Prisma.sql`NOT EXISTS (
      SELECT 1 FROM client_qr_codes q2
      WHERE q2.tenant_id = c.tenant_id
        AND q2.client_id = c.id
        AND q2.is_active = TRUE
    )`
  ];
  if (q.search?.trim()) {
    const p = `%${q.search.trim()}%`;
    where.push(
      Prisma.sql`(c.name ILIKE ${p} OR COALESCE(c.phone,'') ILIKE ${p} OR COALESCE(c.client_code,'') ILIKE ${p})`
    );
  }
  if (q.zone?.trim()) where.push(Prisma.sql`COALESCE(c.zone,'') = ${q.zone.trim()}`);
  if (q.region?.trim()) where.push(Prisma.sql`COALESCE(c.region,'') = ${q.region.trim()}`);
  if (q.city?.trim()) where.push(Prisma.sql`COALESCE(c.city,'') = ${q.city.trim()}`);
  const w = Prisma.join(where, " AND ");
  const offset = (q.page - 1) * q.limit;
  const rows = await prisma.$queryRaw<ClientWithoutQrRow[]>(Prisma.sql`
    SELECT c.id, c.name, c.zone, c.region, c.city, c.phone, c.agent_id
    FROM clients c
    WHERE ${w}
    ORDER BY c.name ASC
    OFFSET ${offset}
    LIMIT ${q.limit}
  `);
  const countRows = await prisma.$queryRaw<Array<{ total: bigint }>>(Prisma.sql`
    SELECT COUNT(*)::bigint AS total
    FROM clients c
    WHERE ${w}
  `);
  const total = Number(countRows[0]?.total ?? 0n);
  return { data: rows, total, page: q.page, limit: q.limit };
}

export async function exportClientsWithoutQrCsv(
  tenantId: number,
  q: {
    search?: string;
    zone?: string;
    region?: string;
    city?: string;
  }
): Promise<string> {
  const where: Prisma.Sql[] = [
    Prisma.sql`c.tenant_id = ${tenantId}`,
    Prisma.sql`c.is_active = TRUE`,
    Prisma.sql`NOT EXISTS (
      SELECT 1 FROM client_qr_codes q2
      WHERE q2.tenant_id = c.tenant_id
        AND q2.client_id = c.id
        AND q2.is_active = TRUE
    )`
  ];
  if (q.search?.trim()) {
    const p = `%${q.search.trim()}%`;
    where.push(
      Prisma.sql`(c.name ILIKE ${p} OR COALESCE(c.phone,'') ILIKE ${p} OR COALESCE(c.client_code,'') ILIKE ${p})`
    );
  }
  if (q.zone?.trim()) where.push(Prisma.sql`COALESCE(c.zone,'') = ${q.zone.trim()}`);
  if (q.region?.trim()) where.push(Prisma.sql`COALESCE(c.region,'') = ${q.region.trim()}`);
  if (q.city?.trim()) where.push(Prisma.sql`COALESCE(c.city,'') = ${q.city.trim()}`);
  const w = Prisma.join(where, " AND ");
  const rows = await prisma.$queryRaw<ClientWithoutQrRow[]>(Prisma.sql`
    SELECT c.id, c.name, c.zone, c.region, c.city, c.phone, c.agent_id
    FROM clients c
    WHERE ${w}
    ORDER BY c.name ASC
  `);
  return toClientsWithoutQrCsv(rows);
}
