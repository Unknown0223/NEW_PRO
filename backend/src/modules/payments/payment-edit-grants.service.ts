import type { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";

export type GrantDisplayStatus = "completed" | "deleted" | "active" | "restored";

export type PaymentEditGrantListRow = {
  id: number;
  payment_id: number;
  created_at: string;
  expires_at: string;
  completed_at: string | null;
  status: GrantDisplayStatus;
  access_user_id: number;
  access_user_name: string;
  cancel_reason_ref: string | null;
  created_by_user_id: number | null;
  created_by_name: string | null;
  comment: string | null;
  can_restore_payment: boolean;
};

export type PaymentEditGrantListQuery = {
  page: number;
  limit: number;
  date_from?: string;
  date_to?: string;
  status?: "completed" | "deleted" | "restored";
  access_user_id?: number;
  cancel_reason_ref?: string;
  search?: string;
};

function parseYmdStart(iso: string): Date {
  return new Date(`${iso.trim()}T00:00:00.000Z`);
}

function parseYmdEnd(iso: string): Date {
  return new Date(`${iso.trim()}T23:59:59.999Z`);
}

export function resolveGrantDisplayStatus(
  grant: { status: string; completed_at: Date | null; expires_at: Date },
  paymentDeletedAt: Date | null | undefined
): GrantDisplayStatus {
  if (grant.status === "restored") return "restored";
  if (grant.status === "deleted" || paymentDeletedAt != null) return "deleted";
  if (grant.status === "completed" || grant.completed_at != null) return "completed";
  if (grant.status === "active" && grant.expires_at.getTime() < Date.now()) return "completed";
  return "active";
}

export async function completeActivePaymentEditGrantsInTx(
  tx: Prisma.TransactionClient,
  tenantId: number,
  paymentId: number
): Promise<void> {
  const now = new Date();
  await tx.paymentEditGrant.updateMany({
    where: { tenant_id: tenantId, payment_id: paymentId, status: "active" },
    data: { status: "completed", completed_at: now }
  });
}

type RestoreGrantMeta = {
  restoredAt: Date;
  restoreComment: string | null;
};

export async function restorePaymentEditGrantsInTx(
  tx: Prisma.TransactionClient,
  tenantId: number,
  paymentId: number,
  meta: RestoreGrantMeta
): Promise<void> {
  const commentText = (meta.restoreComment ?? "").trim();
  await tx.paymentEditGrant.updateMany({
    where: { tenant_id: tenantId, payment_id: paymentId, status: "deleted" },
    data: {
      status: "restored",
      completed_at: meta.restoredAt,
      comment: commentText
    }
  });
}

type VoidGrantMeta = {
  voidedAt: Date;
  cancelReasonRef: string | null;
  actorUserId: number | null;
  expeditorUserId: number | null;
};

export async function voidPaymentEditGrantsInTx(
  tx: Prisma.TransactionClient,
  tenantId: number,
  paymentId: number,
  meta: VoidGrantMeta
): Promise<void> {
  const { voidedAt, cancelReasonRef, actorUserId, expeditorUserId } = meta;

  const updated = await tx.paymentEditGrant.updateMany({
    where: { tenant_id: tenantId, payment_id: paymentId, status: { not: "deleted" } },
    data: {
      status: "deleted",
      completed_at: voidedAt,
      cancel_reason_ref: cancelReasonRef ?? undefined
    }
  });

  if (updated.count > 0) return;

  const accessUserId =
    expeditorUserId ??
    (actorUserId != null && Number.isFinite(actorUserId) && actorUserId > 0 ? actorUserId : null);
  if (accessUserId == null) return;

  await tx.paymentEditGrant.create({
    data: {
      tenant_id: tenantId,
      payment_id: paymentId,
      access_user_id: accessUserId,
      duration_minutes: 1,
      expires_at: voidedAt,
      status: "deleted",
      completed_at: voidedAt,
      cancel_reason_ref: cancelReasonRef,
      created_by_user_id: actorUserId,
      created_at: voidedAt
    }
  });
}

/** Avval o‘chirilgan, lekin grant yozuvi yo‘q to‘lovlar uchun bir martalik to‘ldirish. */
export async function backfillDeletedPaymentEditGrants(tenantId: number): Promise<void> {
  const voidedPayments = await prisma.payment.findMany({
    where: {
      tenant_id: tenantId,
      deleted_at: { not: null },
      edit_grants: { none: {} }
    },
    select: {
      id: true,
      deleted_at: true,
      delete_reason_ref: true,
      expeditor_user_id: true,
      deleted_by_user_id: true
    }
  });

  for (const payment of voidedPayments) {
    if (payment.deleted_at == null) continue;
    const accessUserId =
      payment.expeditor_user_id ??
      payment.deleted_by_user_id ??
      null;
    if (accessUserId == null) continue;

    await prisma.paymentEditGrant.create({
      data: {
        tenant_id: tenantId,
        payment_id: payment.id,
        access_user_id: accessUserId,
        duration_minutes: 1,
        expires_at: payment.deleted_at,
        status: "deleted",
        completed_at: payment.deleted_at,
        cancel_reason_ref: payment.delete_reason_ref,
        created_by_user_id: payment.deleted_by_user_id,
        created_at: payment.deleted_at
      }
    });
  }
}

function statusFilterWhere(status: "completed" | "deleted" | "restored"): object {
  const now = new Date();
  if (status === "restored") {
    return { status: "restored" };
  }
  if (status === "deleted") {
    return {
      OR: [{ status: "deleted" }, { payment: { deleted_at: { not: null } } }]
    };
  }
  return {
    AND: [
      {
        OR: [
          { status: "completed" },
          { completed_at: { not: null } },
          { AND: [{ status: "active" }, { expires_at: { lt: now } }] }
        ]
      },
      { status: { not: "deleted" } },
      { payment: { deleted_at: null } }
    ]
  };
}

export async function createPaymentEditGrant(
  tenantId: number,
  paymentId: number,
  actorUserId: number | null,
  body: {
    duration_minutes: number;
    access_user_id: number;
    cancel_reason_ref?: string | null;
    comment?: string | null;
  }
): Promise<{ id: number }> {
  const payment = await prisma.payment.findFirst({
    where: { id: paymentId, tenant_id: tenantId, deleted_at: null },
    select: { id: true }
  });
  if (!payment) throw new Error("NOT_FOUND");

  const accessUser = await prisma.user.findFirst({
    where: { id: body.access_user_id, tenant_id: tenantId, is_active: true },
    select: { id: true }
  });
  if (!accessUser) throw new Error("BAD_ACCESS_USER");

  const minutes = body.duration_minutes;
  if (!Number.isFinite(minutes) || minutes < 1 || minutes > 60 * 24 * 30) {
    throw new Error("BAD_DURATION");
  }

  const expiresAt = new Date(Date.now() + minutes * 60_000);

  const row = await prisma.paymentEditGrant.create({
    data: {
      tenant_id: tenantId,
      payment_id: paymentId,
      access_user_id: body.access_user_id,
      duration_minutes: minutes,
      expires_at: expiresAt,
      status: "active",
      cancel_reason_ref: body.cancel_reason_ref?.trim() || null,
      comment: body.comment?.trim() || null,
      created_by_user_id: actorUserId
    },
    select: { id: true }
  });

  return { id: row.id };
}

export async function listPaymentEditGrants(
  tenantId: number,
  q: PaymentEditGrantListQuery
): Promise<{ data: PaymentEditGrantListRow[]; total: number; page: number; limit: number }> {
  const missingDeletedGrants = await prisma.payment.count({
    where: {
      tenant_id: tenantId,
      deleted_at: { not: null },
      edit_grants: { none: {} }
    }
  });
  if (missingDeletedGrants > 0) {
    await backfillDeletedPaymentEditGrants(tenantId);
  }

  const page = Math.max(1, q.page);
  const limit = Math.min(200, Math.max(1, q.limit));
  const skip = (page - 1) * limit;

  const andParts: object[] = [{ tenant_id: tenantId }];
  if (q.date_from?.trim()) {
    andParts.push({ created_at: { gte: parseYmdStart(q.date_from) } });
  }
  if (q.date_to?.trim()) {
    andParts.push({ created_at: { lte: parseYmdEnd(q.date_to) } });
  }
  if (q.status) andParts.push(statusFilterWhere(q.status));
  if (q.access_user_id != null && q.access_user_id > 0) {
    andParts.push({ access_user_id: q.access_user_id });
  }
  if (q.cancel_reason_ref?.trim()) {
    andParts.push({ cancel_reason_ref: q.cancel_reason_ref.trim() });
  }
  if (q.search?.trim()) {
    const s = q.search.trim();
    const idNum = Number.parseInt(s, 10);
    const orParts: object[] = [];
    if (Number.isFinite(idNum) && idNum > 0) {
      orParts.push({ payment_id: idNum }, { id: idNum });
    }
    orParts.push(
      { comment: { contains: s, mode: "insensitive" as const } },
      { cancel_reason_ref: { contains: s, mode: "insensitive" as const } },
      {
        access_user: {
          OR: [
            { name: { contains: s, mode: "insensitive" as const } },
            { login: { contains: s, mode: "insensitive" as const } }
          ]
        }
      },
      {
        created_by: {
          OR: [
            { name: { contains: s, mode: "insensitive" as const } },
            { login: { contains: s, mode: "insensitive" as const } }
          ]
        }
      }
    );
    andParts.push({ OR: orParts });
  }

  const where = { AND: andParts };

  const [rows, total] = await Promise.all([
    prisma.paymentEditGrant.findMany({
      where,
      orderBy: { created_at: "desc" },
      skip,
      take: limit,
      include: {
        payment: { select: { deleted_at: true } },
        access_user: { select: { id: true, name: true, login: true } },
        created_by: { select: { id: true, name: true, login: true } }
      }
    }),
    prisma.paymentEditGrant.count({ where })
  ]);

  const data: PaymentEditGrantListRow[] = rows.map((r) => ({
    id: r.id,
    payment_id: r.payment_id,
    created_at: r.created_at.toISOString(),
    expires_at: r.expires_at.toISOString(),
    completed_at: r.completed_at?.toISOString() ?? null,
    status: resolveGrantDisplayStatus(r, r.payment.deleted_at),
    access_user_id: r.access_user_id,
    access_user_name: r.access_user.name?.trim() || r.access_user.login || `#${r.access_user_id}`,
    cancel_reason_ref: r.cancel_reason_ref?.trim() || null,
    created_by_user_id: r.created_by_user_id,
    created_by_name: r.created_by
      ? r.created_by.name?.trim() || r.created_by.login || `#${r.created_by_user_id}`
      : null,
    comment: r.comment?.trim() || null,
    can_restore_payment: r.payment.deleted_at != null
  }));

  return { data, total, page, limit };
}
