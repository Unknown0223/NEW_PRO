import { prisma } from "../../config/database";
import { appendTenantAuditEvent, AuditEntityType } from "../../lib/tenant-audit";
import {
  isDocumentEditLockSection,
  type DocumentEditLockSection
} from "../../lib/document-edit-lock";
import { createNotification } from "../notifications/notifications.service";

export type DocumentEditGrantRow = {
  id: number;
  section: DocumentEditLockSection;
  document_id: number;
  document_kind: string | null;
  access_user_id: number;
  access_user_name: string;
  duration_minutes: number;
  expires_at: string;
  status: string;
  created_by_user_id: number | null;
  created_by_name: string | null;
  created_at: string;
  comment: string | null;
};

const SECTION_LABEL: Record<DocumentEditLockSection, string> = {
  payments: "To‘lov",
  orders: "Buyurtma",
  returns: "Qaytarish",
  stock: "Ombor",
  expenses: "Xarajat",
  opening_balances: "Ochilish qoldig‘i"
};

export async function listActiveDocumentEditGrants(
  tenantId: number
): Promise<DocumentEditGrantRow[]> {
  const now = new Date();
  const rows = await prisma.documentEditGrant.findMany({
    where: {
      tenant_id: tenantId,
      status: "active",
      expires_at: { gt: now },
      revoked_at: null
    },
    orderBy: { expires_at: "asc" },
    take: 200,
    include: {
      access_user: { select: { id: true, name: true, login: true } },
      created_by: { select: { id: true, name: true, login: true } }
    }
  });

  return rows.map((r) => ({
    id: r.id,
    section: r.section as DocumentEditLockSection,
    document_id: r.document_id,
    document_kind: r.document_kind,
    access_user_id: r.access_user_id,
    access_user_name: r.access_user.name?.trim() || r.access_user.login,
    duration_minutes: r.duration_minutes,
    expires_at: r.expires_at.toISOString(),
    status: r.status,
    created_by_user_id: r.created_by_user_id,
    created_by_name: r.created_by
      ? r.created_by.name?.trim() || r.created_by.login
      : null,
    created_at: r.created_at.toISOString(),
    comment: r.comment
  }));
}

export type BatchGrantItem = {
  section: DocumentEditLockSection;
  document_id: number;
  document_kind?: string | null;
};

export async function batchCreateDocumentEditGrants(input: {
  tenantId: number;
  actorUserId: number | null;
  items: BatchGrantItem[];
  userIds: number[];
  durationMinutes: number;
  comment?: string | null;
}): Promise<{ created: number; grants: DocumentEditGrantRow[] }> {
  const minutes = Math.min(24 * 60, Math.max(1, Math.floor(input.durationMinutes)));
  const expiresAt = new Date(Date.now() + minutes * 60_000);
  const userIds = [...new Set(input.userIds.filter((id) => Number.isInteger(id) && id > 0))];
  const items = input.items.filter(
    (it) =>
      isDocumentEditLockSection(it.section) &&
      Number.isInteger(it.document_id) &&
      it.document_id > 0
  );

  if (userIds.length === 0) throw new Error("NO_USERS");
  if (items.length === 0) throw new Error("NO_ITEMS");
  if (items.length * userIds.length > 500) throw new Error("TOO_MANY");

  const users = await prisma.user.findMany({
    where: { tenant_id: input.tenantId, id: { in: userIds } },
    select: { id: true }
  });
  if (users.length !== userIds.length) throw new Error("BAD_USER");

  const createdIds: number[] = [];
  await prisma.$transaction(async (tx) => {
    for (const item of items) {
      for (const userId of userIds) {
        const row = await tx.documentEditGrant.create({
          data: {
            tenant_id: input.tenantId,
            section: item.section,
            document_id: item.document_id,
            document_kind: item.document_kind?.trim() || null,
            access_user_id: userId,
            duration_minutes: minutes,
            expires_at: expiresAt,
            status: "active",
            comment: input.comment?.trim().slice(0, 2000) || null,
            created_by_user_id: input.actorUserId
          },
          select: { id: true }
        });
        createdIds.push(row.id);
      }
    }
  });

  await appendTenantAuditEvent({
    tenantId: input.tenantId,
    actorUserId: input.actorUserId,
    entityType: AuditEntityType.tenant_settings,
    entityId: "document_edit_lock",
    action: "document_edit_grant.create",
    payload: {
      count: createdIds.length,
      duration_minutes: minutes,
      expires_at: expiresAt.toISOString(),
      items: items.slice(0, 100),
      user_ids: userIds
    }
  });

  const labelBits = items
    .slice(0, 5)
    .map((it) => `${SECTION_LABEL[it.section]} #${it.document_id}`)
    .join(", ");
  const more = items.length > 5 ? ` (+${items.length - 5})` : "";
  for (const userId of userIds) {
    await createNotification({
      tenant_id: input.tenantId,
      user_id: userId,
      title: "Davr ochildi (vaqtinchalik)",
      body: `${labelBits}${more} — ${minutes} daqiqa`,
      link_href: "/settings/document-edit-lock"
    });
  }

  const grants = await listActiveDocumentEditGrants(input.tenantId);
  return { created: createdIds.length, grants };
}

export async function revokeDocumentEditGrant(input: {
  tenantId: number;
  grantId: number;
  actorUserId: number | null;
}): Promise<void> {
  const row = await prisma.documentEditGrant.findFirst({
    where: { id: input.grantId, tenant_id: input.tenantId }
  });
  if (!row) throw new Error("NOT_FOUND");
  if (row.status !== "active") throw new Error("NOT_ACTIVE");

  const now = new Date();
  await prisma.documentEditGrant.update({
    where: { id: row.id },
    data: { status: "revoked", revoked_at: now }
  });

  await appendTenantAuditEvent({
    tenantId: input.tenantId,
    actorUserId: input.actorUserId,
    entityType: AuditEntityType.tenant_settings,
    entityId: "document_edit_lock",
    action: "document_edit_grant.revoke",
    payload: {
      grant_id: row.id,
      section: row.section,
      document_id: row.document_id,
      document_kind: row.document_kind,
      access_user_id: row.access_user_id
    }
  });
}
