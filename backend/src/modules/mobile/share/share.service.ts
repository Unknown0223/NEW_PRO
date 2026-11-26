import { prisma } from "../../../config/database";
import {
  SHARE_INVALID_TRANSITION,
  SHARE_NOT_SAME_WAREHOUSE,
  SHARE_ORDER_ALREADY_LOCKED,
  SHARE_ORDER_NOT_ELIGIBLE,
  SHARE_REQUEST_EXPIRED,
  ShareError
} from "./share-codes";
import {
  assertOrderShareActionAllowed,
  type ShareLockRow
} from "./share-lock.pure";
import { sharePersonDisplayName } from "./share-display.pure";
import { eligibleRecipients } from "./share-partner-eligibility.pure";
import { emitShareNotification } from "./share-notify";
import { transitionShare, type ShareStatus } from "./share-state.pure";

export async function locksForOrders(
  tenantId: number,
  orderIds: number[]
): Promise<ShareLockRow[]> {
  if (orderIds.length === 0) return [];
  const rows = await prisma.expeditorShareOrder.findMany({
    where: { tenant_id: tenantId, order_id: { in: orderIds }, locked: true },
    include: { request: true }
  });
  return rows.map((r) => ({
    orderId: r.order_id,
    locked: r.locked,
    receiverUserId: r.request.receiver_user_id,
    senderUserId: r.request.sender_user_id,
    status: r.request.status
  }));
}

/** End of local calendar day (tenant TZ later — UTC day for Wave 2). */
export function defaultShareExpiresAt(now = new Date()): Date {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999)
  );
}

async function assertReceiverEligible(
  tenantId: number,
  senderUserId: number,
  receiverUserId: number
): Promise<void> {
  const sender = await prisma.user.findFirst({
    where: { tenant_id: tenantId, id: senderUserId, role: "expeditor" },
    select: { warehouse_id: true }
  });
  const receiver = await prisma.user.findFirst({
    where: {
      tenant_id: tenantId,
      id: receiverUserId,
      role: "expeditor",
      is_active: true
    },
    select: { id: true, warehouse_id: true }
  });
  if (!sender || !receiver) throw new ShareError(SHARE_ORDER_NOT_ELIGIBLE);

  const partners = await prisma.expeditorSharePartner.findMany({
    where: { tenant_id: tenantId, owner_expeditor_user_id: senderUserId },
    select: { partner_expeditor_user_id: true }
  });
  const ownWh = sender.warehouse_id != null ? [sender.warehouse_id] : [];
  const eligible = eligibleRecipients(
    ownWh,
    partners.map((p) => ({ userId: p.partner_expeditor_user_id })),
    [
      {
        userId: receiver.id,
        warehouseIds: receiver.warehouse_id != null ? [receiver.warehouse_id] : []
      }
    ]
  );
  if (eligible.length === 0) {
    throw new ShareError(SHARE_NOT_SAME_WAREHOUSE);
  }
}

export async function expireShareIfNeeded(req: {
  id: number;
  status: string;
  expires_at: Date | null;
}): Promise<void> {
  if (req.status !== "kutilmoqda" && req.status !== "korildi") return;
  if (!req.expires_at || req.expires_at.getTime() >= Date.now()) return;
  const next = transitionShare(req.status as ShareStatus, "EXPIRE", "sender");
  await prisma.$transaction(async (tx) => {
    await tx.expeditorShareRequest.update({
      where: { id: req.id },
      data: { status: next }
    });
    await tx.expeditorShareOrder.updateMany({
      where: { request_id: req.id },
      data: { locked: false }
    });
  });
  throw new ShareError(SHARE_REQUEST_EXPIRED);
}

export async function createShareRequest(input: {
  tenantId: number;
  senderUserId: number;
  receiverUserId: number;
  orderIds: number[];
}) {
  const { tenantId, senderUserId, receiverUserId, orderIds } = input;
  if (receiverUserId === senderUserId) {
    throw new ShareError(SHARE_ORDER_NOT_ELIGIBLE, "Same user");
  }
  if (orderIds.length === 0) {
    throw new ShareError(SHARE_ORDER_NOT_ELIGIBLE, "No orders");
  }

  await assertReceiverEligible(tenantId, senderUserId, receiverUserId);

  const owned = await prisma.order.findMany({
    where: {
      tenant_id: tenantId,
      id: { in: orderIds },
      expeditor_user_id: senderUserId
    },
    select: { id: true }
  });
  if (owned.length !== orderIds.length) {
    throw new ShareError(SHARE_ORDER_NOT_ELIGIBLE);
  }

  return prisma.$transaction(async (tx) => {
    const locks = await locksForOrders(tenantId, orderIds);
    for (const oid of orderIds) {
      assertOrderShareActionAllowed({
        orderId: oid,
        actorUserId: senderUserId,
        locks,
        mode: "create_share"
      });
    }
    const req = await tx.expeditorShareRequest.create({
      data: {
        tenant_id: tenantId,
        sender_user_id: senderUserId,
        receiver_user_id: receiverUserId,
        status: "kutilmoqda",
        expires_at: defaultShareExpiresAt()
      }
    });
    await tx.expeditorShareOrder.createMany({
      data: orderIds.map((order_id) => ({
        tenant_id: tenantId,
        request_id: req.id,
        order_id,
        accepted: false,
        locked: true
      }))
    });
    void emitShareNotification({
      tenantId,
      userId: receiverUserId,
      code: "SHARE_REQUEST_NEW",
      requestId: req.id,
      body: `${orderIds.length} buyurtma`
    });
    return req;
  });
}

export async function listShareRequests(input: {
  tenantId: number;
  userId: number;
  box: "inbox" | "outbox";
}) {
  const where =
    input.box === "inbox"
      ? { tenant_id: input.tenantId, receiver_user_id: input.userId }
      : { tenant_id: input.tenantId, sender_user_id: input.userId };
  const rows = await prisma.expeditorShareRequest.findMany({
    where,
    include: { orders: true },
    orderBy: { created_at: "desc" },
    take: 100
  });
  if (rows.length === 0) return [];
  const ids = Array.from(
    new Set(rows.flatMap((r) => [r.sender_user_id, r.receiver_user_id]))
  );
  const users = await prisma.user.findMany({
    where: { tenant_id: input.tenantId, id: { in: ids } },
    select: { id: true, name: true, first_name: true, last_name: true }
  });
  const byId = new Map(users.map((u) => [u.id, u]));
  return rows.map((r) => ({
    ...r,
    sender_name: sharePersonDisplayName(byId.get(r.sender_user_id)),
    receiver_name: sharePersonDisplayName(byId.get(r.receiver_user_id))
  }));
}

/** Ulashish qabulchilari — faqat nom (picker-labels). */
export async function listEligibleShareRecipients(input: {
  tenantId: number;
  senderUserId: number;
}): Promise<Array<{ user_id: number; name: string }>> {
  const sender = await prisma.user.findFirst({
    where: {
      tenant_id: input.tenantId,
      id: input.senderUserId,
      role: "expeditor"
    },
    select: { warehouse_id: true }
  });
  if (!sender) return [];

  const partners = await prisma.expeditorSharePartner.findMany({
    where: {
      tenant_id: input.tenantId,
      owner_expeditor_user_id: input.senderUserId
    },
    select: { partner_expeditor_user_id: true }
  });

  const candidates = await prisma.user.findMany({
    where: {
      tenant_id: input.tenantId,
      role: "expeditor",
      is_active: true,
      NOT: { id: input.senderUserId }
    },
    select: {
      id: true,
      warehouse_id: true,
      name: true,
      first_name: true,
      last_name: true
    }
  });

  const ownWh = sender.warehouse_id != null ? [sender.warehouse_id] : [];
  const eligible = eligibleRecipients(
    ownWh,
    partners.map((p) => ({ userId: p.partner_expeditor_user_id })),
    candidates.map((c) => ({
      userId: c.id,
      warehouseIds: c.warehouse_id != null ? [c.warehouse_id] : []
    }))
  );
  const allowed = new Set(eligible.map((e) => e.userId));
  return candidates
    .filter((c) => allowed.has(c.id))
    .map((c) => ({
      user_id: c.id,
      name: sharePersonDisplayName(c)
    }))
    .filter((r) => r.name.length > 0)
    .sort((a, b) => a.name.localeCompare(b.name, "uz"));
}

export async function getShareRequest(input: {
  tenantId: number;
  userId: number;
  requestId: number;
}) {
  const req = await prisma.expeditorShareRequest.findFirst({
    where: { tenant_id: input.tenantId, id: input.requestId },
    include: { orders: true, handoffs: true }
  });
  if (!req) throw new ShareError("NOT_FOUND");
  if (
    req.sender_user_id !== input.userId &&
    req.receiver_user_id !== input.userId
  ) {
    throw new ShareError("NOT_FOUND");
  }
  await expireShareIfNeeded(req);

  if (
    req.receiver_user_id === input.userId &&
    req.status === "kutilmoqda"
  ) {
    const next = transitionShare("kutilmoqda", "VIEW", "receiver");
    return prisma.expeditorShareRequest.update({
      where: { id: req.id },
      data: { status: next },
      include: { orders: true, handoffs: true }
    });
  }
  return req;
}

export async function cancelShareRequest(input: {
  tenantId: number;
  userId: number;
  requestId: number;
}) {
  const req = await prisma.expeditorShareRequest.findFirst({
    where: { tenant_id: input.tenantId, id: input.requestId },
    include: { orders: true }
  });
  if (!req) throw new ShareError("NOT_FOUND");
  if (req.sender_user_id !== input.userId) {
    throw new ShareError(SHARE_INVALID_TRANSITION);
  }
  const next = transitionShare(
    req.status as Parameters<typeof transitionShare>[0],
    "CANCEL",
    "sender"
  );
  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.expeditorShareRequest.update({
      where: { id: req.id },
      data: { status: next }
    });
    await tx.expeditorShareOrder.updateMany({
      where: { request_id: req.id },
      data: { locked: false }
    });
    return row;
  });
  void emitShareNotification({
    tenantId: input.tenantId,
    userId: req.receiver_user_id,
    code: "SHARE_CANCELLED",
    requestId: req.id
  });
  return updated;
}

export { assertOrderShareActionAllowed, SHARE_ORDER_ALREADY_LOCKED };
export {
  acceptShareRequest,
  rejectShareRequest,
  upsertShareHandoff
} from "./share-accept-handoff.service";
