import { randomBytes } from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { appendTenantAuditEvent } from "../../lib/tenant-audit";

import {
  MAX_QR_GENERATE_PER_REQUEST,
  QR_GENERATE_CHUNK,
  uniqueQrCodes
} from "./client-qr.helpers";

type Db = Pick<typeof prisma, "$queryRaw">;

async function assertClientHasNoOtherQr(
  db: Db,
  tenantId: number,
  clientId: number,
  excludeQrId: number
): Promise<void> {
  const rows = await db.$queryRaw<Array<{ id: number }>>(Prisma.sql`
    SELECT q.id
    FROM client_qr_codes q
    WHERE q.tenant_id = ${tenantId}
      AND q.client_id = ${clientId}
      AND q.is_active = TRUE
      AND q.id <> ${excludeQrId}
    LIMIT 1
  `);
  if (rows.length > 0) throw new Error("CLIENT_ALREADY_HAS_QR");
}

export async function generateQrCodes(input: {
  tenantId: number;
  actorUserId: number | null;
  count?: number;
  clientIds?: number[];
}) {
  const count = Math.max(0, Math.min(MAX_QR_GENERATE_PER_REQUEST, Number(input.count ?? 0)));
  const uniqueClientIds = Array.from(new Set((input.clientIds ?? []).filter((x) => Number.isFinite(x) && x > 0)));
  if (count < 1 && uniqueClientIds.length === 0) return { created: 0 };
  const now = new Date();
  let created = 0;
  await prisma.$transaction(
    async (tx) => {
      if (uniqueClientIds.length > 0) {
        const clients = await tx.$queryRaw<Array<{ id: number }>>(Prisma.sql`
          SELECT c.id
          FROM clients c
          WHERE c.tenant_id = ${input.tenantId}
            AND c.id IN (${Prisma.join(uniqueClientIds)})
            AND NOT EXISTS (
              SELECT 1 FROM client_qr_codes q2
              WHERE q2.tenant_id = c.tenant_id
                AND q2.client_id = c.id
                AND q2.is_active = TRUE
            )
        `);
        const codes = uniqueQrCodes(clients.length);
        for (let j = 0; j < clients.length; j += QR_GENERATE_CHUNK) {
          const part = clients.slice(j, j + QR_GENERATE_CHUNK);
          const partCodes = codes.slice(j, j + part.length);
          const valueRows = part.map((c, idx) =>
            Prisma.sql`(${input.tenantId}, ${partCodes[idx]!}, ${c.id}, 'attached', ${input.actorUserId}, ${now}, ${now}, TRUE, ${now}, ${input.actorUserId})`
          );
          await tx.$executeRaw(Prisma.sql`
            INSERT INTO client_qr_codes
              (tenant_id, qr_code, client_id, status, created_by_user_id, created_at, updated_at, is_active, bound_at, bound_by_user_id)
            VALUES ${Prisma.join(valueRows)}
          `);
          created += part.length;
        }
      }
      if (count > 0) {
        const codes = uniqueQrCodes(count);
        for (let i = 0; i < codes.length; i += QR_GENERATE_CHUNK) {
          const slice = codes.slice(i, i + QR_GENERATE_CHUNK);
          const valueRows = slice.map(
            (qr_code) =>
              Prisma.sql`(${input.tenantId}, ${qr_code}, 'new', ${input.actorUserId}, ${now}, ${now}, TRUE)`
          );
          await tx.$executeRaw(Prisma.sql`
            INSERT INTO client_qr_codes
              (tenant_id, qr_code, status, created_by_user_id, created_at, updated_at, is_active)
            VALUES ${Prisma.join(valueRows)}
          `);
          created += slice.length;
        }
      }
    },
    { maxWait: 10_000, timeout: 180_000 }
  );
  await appendTenantAuditEvent({
    tenantId: input.tenantId,
    actorUserId: input.actorUserId,
    entityType: "client_qr",
    entityId: "bulk",
    action: "client_qr.generate",
    payload: { created, count, client_ids: uniqueClientIds.length }
  });
  return { created };
}

export async function lookupQrByCode(tenantId: number, qrCode: string) {
  const code = qrCode.trim();
  if (!code) return null;
  const rows = await prisma.$queryRaw<
    Array<{ id: number; qr_code: string; client_id: number | null; status: string }>
  >(Prisma.sql`
    SELECT q.id, q.qr_code, q.client_id, q.status
    FROM client_qr_codes q
    WHERE q.tenant_id = ${tenantId}
      AND q.qr_code = ${code}
      AND q.is_active = TRUE
    LIMIT 1
  `);
  return rows[0] ?? null;
}

export async function bindQrByCode(input: {
  tenantId: number;
  actorUserId: number | null;
  qrCode: string;
  clientId: number;
}) {
  const row = await lookupQrByCode(input.tenantId, input.qrCode);
  if (!row) throw new Error("NOT_FOUND");
  await bindQrCode({
    tenantId: input.tenantId,
    actorUserId: input.actorUserId,
    qrId: row.id,
    clientId: input.clientId
  });
  return row;
}

export async function unbindQrByCode(input: {
  tenantId: number;
  actorUserId: number | null;
  qrCode: string;
}) {
  const row = await lookupQrByCode(input.tenantId, input.qrCode);
  if (!row) throw new Error("NOT_FOUND");
  await unbindQrCode({
    tenantId: input.tenantId,
    actorUserId: input.actorUserId,
    qrId: row.id
  });
  return row;
}

export async function bindQrCode(input: {
  tenantId: number;
  actorUserId: number | null;
  qrId: number;
  clientId: number;
}) {
  await assertClientHasNoOtherQr(prisma, input.tenantId, input.clientId, input.qrId);
  const now = new Date();
  const ok = await prisma.$executeRaw(Prisma.sql`
    UPDATE client_qr_codes q
    SET
      client_id = ${input.clientId},
      status = 'attached',
      bound_at = ${now},
      bound_by_user_id = ${input.actorUserId},
      detached_at = NULL,
      detached_by_user_id = NULL,
      updated_at = ${now}
    WHERE q.id = ${input.qrId}
      AND q.tenant_id = ${input.tenantId}
      AND q.is_active = TRUE
      AND EXISTS (
        SELECT 1 FROM clients c
        WHERE c.id = ${input.clientId}
          AND c.tenant_id = ${input.tenantId}
      )
  `);
  if (ok < 1) throw new Error("NOT_FOUND");
  await appendTenantAuditEvent({
    tenantId: input.tenantId,
    actorUserId: input.actorUserId,
    entityType: "client_qr",
    entityId: input.qrId,
    action: "client_qr.bind",
    payload: { client_id: input.clientId }
  });
}

export async function unbindQrCode(input: {
  tenantId: number;
  actorUserId: number | null;
  qrId: number;
}) {
  const now = new Date();
  const ok = await prisma.$executeRaw(Prisma.sql`
    UPDATE client_qr_codes q
    SET
      client_id = NULL,
      status = 'detached',
      detached_at = ${now},
      detached_by_user_id = ${input.actorUserId},
      updated_at = ${now}
    WHERE q.id = ${input.qrId}
      AND q.tenant_id = ${input.tenantId}
      AND q.is_active = TRUE
  `);
  if (ok < 1) throw new Error("NOT_FOUND");
  await appendTenantAuditEvent({
    tenantId: input.tenantId,
    actorUserId: input.actorUserId,
    entityType: "client_qr",
    entityId: input.qrId,
    action: "client_qr.unbind"
  });
}

export async function markQrCodesPrinted(input: {
  tenantId: number;
  actorUserId: number | null;
  qrIds: number[];
  qrSizeLabel?: string | null;
}) {
  const ids = Array.from(new Set(input.qrIds.filter((x) => Number.isFinite(x) && x > 0)));
  if (ids.length === 0) return { updated: 0 };
  const now = new Date();
  const updated = await prisma.$executeRaw(Prisma.sql`
    UPDATE client_qr_codes q
    SET
      printed_at = COALESCE(q.printed_at, ${now}),
      printed_by_user_id = COALESCE(q.printed_by_user_id, ${input.actorUserId}),
      status = CASE WHEN q.status = 'new' THEN 'printed' ELSE q.status END,
      updated_at = ${now}
    WHERE q.tenant_id = ${input.tenantId}
      AND q.is_active = TRUE
      AND q.id IN (${Prisma.join(ids)})
  `);
  await appendTenantAuditEvent({
    tenantId: input.tenantId,
    actorUserId: input.actorUserId,
    entityType: "client_qr",
    entityId: "bulk",
    action: "client_qr.print",
    payload: { count: updated, ids, qr_size_label: input.qrSizeLabel ?? null }
  });
  return { updated };
}
