import { randomBytes } from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { appendTenantAuditEvent } from "../../lib/tenant-audit";

import type { ClientQrStats } from "./client-qr.types";

type StatsRow = Omit<ClientQrStats, "attached_client_ids">;

export async function getClientQrStats(tenantId: number): Promise<ClientQrStats> {
  const [rows, attachedRows] = await Promise.all([
    prisma.$queryRaw<StatsRow[]>(Prisma.sql`
      SELECT
        COUNT(*)::int AS total_qr,
        COUNT(*) FILTER (WHERE q.client_id IS NOT NULL)::int AS attached_qr,
        COUNT(*) FILTER (WHERE q.client_id IS NULL)::int AS free_qr,
        COUNT(*) FILTER (WHERE q.status = 'new')::int AS status_new,
        COUNT(*) FILTER (WHERE q.status = 'printed')::int AS status_printed,
        COUNT(*) FILTER (WHERE q.status = 'attached')::int AS status_attached,
        COUNT(*) FILTER (WHERE q.status = 'detached')::int AS status_detached,
        (
          SELECT COUNT(*)::int
          FROM clients c
          WHERE c.tenant_id = ${tenantId}
            AND c.is_active = TRUE
            AND NOT EXISTS (
              SELECT 1 FROM client_qr_codes q2
              WHERE q2.tenant_id = c.tenant_id
                AND q2.client_id = c.id
                AND q2.is_active = TRUE
            )
        ) AS clients_without_qr
      FROM client_qr_codes q
      WHERE q.tenant_id = ${tenantId} AND q.is_active = TRUE
    `),
    prisma.$queryRaw<Array<{ client_id: number }>>(Prisma.sql`
      SELECT DISTINCT q.client_id
      FROM client_qr_codes q
      WHERE q.tenant_id = ${tenantId}
        AND q.is_active = TRUE
        AND q.client_id IS NOT NULL
      ORDER BY q.client_id
    `)
  ]);
  const base =
    rows[0] ?? {
      total_qr: 0,
      attached_qr: 0,
      free_qr: 0,
      status_new: 0,
      status_printed: 0,
      status_attached: 0,
      status_detached: 0,
      clients_without_qr: 0
    };
  return {
    ...base,
    attached_client_ids: attachedRows.map((r) => r.client_id)
  };
}
