/**
 * Domain: Clients — photo reports management
 */
import { prisma } from "../../../config/database";
import { appendTenantAuditEvent, AuditEntityType } from "../../../lib/tenant-audit";

export type ClientPhotoReportRow = {
  id: number;
  client_id: number;
  category: string;
  photo_url: string;
  note: string | null;
  taken_at: string;
  taken_by_user_id: number | null;
  taken_by_user_name: string | null;
};

export type TenantPhotoReportRow = {
  id: number;
  client_id: number;
  client_name: string;
  category: string;
  photo_url: string;
  note: string | null;
  taken_at: string;
  taken_by_user_id: number | null;
  taken_by_user_name: string | null;
};

async function assertClient(tenantId: number, clientId: number): Promise<void> {
  const c = await prisma.client.findFirst({
    where: { id: clientId, tenant_id: tenantId, merged_into_client_id: null },
    select: { id: true }
  });
  if (!c) throw new Error("CLIENT_NOT_FOUND");
}

export async function listClientPhotoReports(
  tenantId: number,
  clientId: number,
  page: number,
  limit: number
): Promise<{ data: ClientPhotoReportRow[]; total: number }> {
  await assertClient(tenantId, clientId);

  const [total, rows] = await Promise.all([
    prisma.clientPhotoReport.count({ where: { tenant_id: tenantId, client_id: clientId } }),
    prisma.clientPhotoReport.findMany({
      where: { tenant_id: tenantId, client_id: clientId },
      orderBy: { taken_at: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: { taken_by_user: { select: { name: true } } }
    })
  ]);

  const data: ClientPhotoReportRow[] = rows.map((r) => ({
    id: r.id,
    client_id: r.client_id,
    category: r.category,
    photo_url: r.photo_url,
    note: r.note,
    taken_at: r.taken_at.toISOString(),
    taken_by_user_id: r.taken_by_user_id,
    taken_by_user_name: r.taken_by_user?.name ?? null
  }));

  return { data, total };
}

export async function createClientPhotoReportRow(
  tenantId: number,
  clientId: number,
  category: string,
  photoUrl: string,
  note: string | null,
  takenAt: Date,
  actorUserId: number | null
): Promise<number> {
  await assertClient(tenantId, clientId);

  const row = await prisma.clientPhotoReport.create({
    data: {
      tenant_id: tenantId,
      client_id: clientId,
      category,
      photo_url: photoUrl,
      note,
      taken_at: takenAt,
      taken_by_user_id: actorUserId
    }
  });

  await appendTenantAuditEvent({
    tenantId,
    actorUserId,
    entityType: AuditEntityType.client,
    entityId: String(clientId),
    action: "client.photo_report_add",
    payload: { photo_report_id: row.id, category }
  });

  return row.id;
}

export async function deleteClientPhotoReport(
  tenantId: number,
  clientId: number,
  photoReportId: number
): Promise<void> {
  await assertClient(tenantId, clientId);

  const existing = await prisma.clientPhotoReport.findFirst({
    where: { id: photoReportId, tenant_id: tenantId, client_id: clientId }
  });

  if (!existing) {
    throw new Error("NOT_FOUND");
  }

  await prisma.clientPhotoReport.delete({ where: { id: photoReportId } });
}