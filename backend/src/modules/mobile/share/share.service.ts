import { prisma } from "../../../config/database";
import {
  SHARE_HANDOFF_INCOMPLETE,
  SHARE_INVALID_TRANSITION,
  SHARE_NOT_SAME_WAREHOUSE,
  SHARE_ORDER_ALREADY_LOCKED,
  SHARE_ORDER_NOT_ELIGIBLE,
  SHARE_REQUEST_EXPIRED,
  SHARE_SENDER_CANNOT_ACT,
  ShareError
} from "./share-codes";
import { applyPartialAccept } from "./share-accept.pure";
import { validateHandoffPair } from "./share-handoff.pure";
import {
  assertOrderShareActionAllowed,
  type ShareLockRow
} from "./share-lock.pure";
import { eligibleRecipients } from "./share-partner-eligibility.pure";
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
  return prisma.expeditorShareRequest.findMany({
    where,
    include: { orders: true },
    orderBy: { created_at: "desc" },
    take: 100
  });
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
  return prisma.$transaction(async (tx) => {
    const updated = await tx.expeditorShareRequest.update({
      where: { id: req.id },
      data: { status: next }
    });
    await tx.expeditorShareOrder.updateMany({
      where: { request_id: req.id },
      data: { locked: false }
    });
    return updated;
  });
}

export async function acceptShareRequest(input: {
  tenantId: number;
  userId: number;
  requestId: number;
  acceptedOrderIds: number[];
}) {
  const req = await prisma.expeditorShareRequest.findFirst({
    where: { tenant_id: input.tenantId, id: input.requestId },
    include: { orders: true }
  });
  if (!req) throw new ShareError("NOT_FOUND");
  if (req.receiver_user_id !== input.userId) {
    throw new ShareError(SHARE_SENDER_CANNOT_ACT);
  }
  const orderIds = req.orders.map((o) => o.order_id);
  const plan = applyPartialAccept({
    orderIds,
    acceptedIds: input.acceptedOrderIds
  });

  let next: ShareStatus;
  if (plan.kind === "reject") {
    next = transitionShare(req.status as ShareStatus, "REJECT", "receiver");
  } else if (plan.kind === "partial") {
    next = transitionShare(req.status as ShareStatus, "ACCEPT_PARTIAL", "receiver");
    next = transitionShare(next, "START_HANDOFF", "receiver");
  } else {
    next = transitionShare(req.status as ShareStatus, "ACCEPT_FULL", "receiver");
    next = transitionShare(next, "START_HANDOFF", "receiver");
  }

  return prisma.$transaction(async (tx) => {
    for (const oid of plan.accepted) {
      await tx.expeditorShareOrder.updateMany({
        where: { request_id: req.id, order_id: oid },
        data: { accepted: true, locked: true }
      });
    }
    for (const oid of plan.rejectedUnlock) {
      await tx.expeditorShareOrder.updateMany({
        where: { request_id: req.id, order_id: oid },
        data: { accepted: false, locked: false }
      });
    }
    if (plan.kind === "reject") {
      await tx.expeditorShareOrder.updateMany({
        where: { request_id: req.id },
        data: { locked: false }
      });
    }
    return tx.expeditorShareRequest.update({
      where: { id: req.id },
      data: { status: next },
      include: { orders: true }
    });
  });
}

export async function rejectShareRequest(input: {
  tenantId: number;
  userId: number;
  requestId: number;
}) {
  return acceptShareRequest({
    ...input,
    acceptedOrderIds: []
  });
}

export async function upsertShareHandoff(input: {
  tenantId: number;
  userId: number;
  requestId: number;
  lat: number;
  lng: number;
  photoKey: string;
}) {
  const req = await prisma.expeditorShareRequest.findFirst({
    where: { tenant_id: input.tenantId, id: input.requestId },
    include: { handoffs: true }
  });
  if (!req) throw new ShareError("NOT_FOUND");
  const party =
    req.sender_user_id === input.userId
      ? "sender"
      : req.receiver_user_id === input.userId
        ? "receiver"
        : null;
  if (!party) throw new ShareError("NOT_FOUND");
  if (req.status !== "yuk_kutilmoqda") {
    throw new ShareError(SHARE_HANDOFF_INCOMPLETE);
  }

  await prisma.expeditorShareHandoff.upsert({
    where: {
      tenant_id_request_id_party: {
        tenant_id: input.tenantId,
        request_id: req.id,
        party
      }
    },
    create: {
      tenant_id: input.tenantId,
      request_id: req.id,
      party,
      lat: input.lat,
      lng: input.lng,
      photo_key: input.photoKey
    },
    update: {
      lat: input.lat,
      lng: input.lng,
      photo_key: input.photoKey
    }
  });

  const refreshed = await prisma.expeditorShareRequest.findFirstOrThrow({
    where: { id: req.id },
    include: { handoffs: true }
  });
  const sender = refreshed.handoffs.find((h) => h.party === "sender");
  const receiver = refreshed.handoffs.find((h) => h.party === "receiver");
  if (
    sender?.lat != null &&
    sender.lng != null &&
    sender.photo_key &&
    receiver?.lat != null &&
    receiver.lng != null &&
    receiver.photo_key
  ) {
    validateHandoffPair(
      { lat: sender.lat, lng: sender.lng, photo_key: sender.photo_key },
      { lat: receiver.lat, lng: receiver.lng, photo_key: receiver.photo_key }
    );
    const next = transitionShare("yuk_kutilmoqda", "HANDOFF_OK", party);
    return prisma.expeditorShareRequest.update({
      where: { id: req.id },
      data: { status: next },
      include: { orders: true, handoffs: true }
    });
  }
  return refreshed;
}

export { assertOrderShareActionAllowed, SHARE_ORDER_ALREADY_LOCKED };
