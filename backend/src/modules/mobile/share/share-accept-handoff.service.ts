import { prisma } from "../../../config/database";
import {
  SHARE_HANDOFF_INCOMPLETE,
  SHARE_SENDER_CANNOT_ACT,
  ShareError
} from "./share-codes";
import { applyPartialAccept } from "./share-accept.pure";
import { validateHandoffPair } from "./share-handoff.pure";
import { emitShareNotification } from "./share-notify";
import { transitionShare, type ShareStatus } from "./share-state.pure";

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

  const updated = await prisma.$transaction(async (tx) => {
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
  const code =
    plan.kind === "reject"
      ? "SHARE_REJECTED"
      : plan.kind === "partial"
        ? "SHARE_PARTIAL_DONE"
        : "SHARE_ACCEPTED";
  void emitShareNotification({
    tenantId: input.tenantId,
    userId: req.sender_user_id,
    code,
    requestId: req.id
  });
  if (plan.kind !== "reject") {
    void emitShareNotification({
      tenantId: input.tenantId,
      userId: req.sender_user_id,
      code: "SHARE_HANDOFF_NEEDED",
      requestId: req.id
    });
    void emitShareNotification({
      tenantId: input.tenantId,
      userId: req.receiver_user_id,
      code: "SHARE_HANDOFF_NEEDED",
      requestId: req.id
    });
  }
  return updated;
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
    const active = await prisma.expeditorShareRequest.update({
      where: { id: req.id },
      data: { status: next },
      include: { orders: true, handoffs: true }
    });
    void emitShareNotification({
      tenantId: input.tenantId,
      userId: req.sender_user_id,
      code: "SHARE_ACTIVE",
      requestId: req.id
    });
    void emitShareNotification({
      tenantId: input.tenantId,
      userId: req.receiver_user_id,
      code: "SHARE_ACTIVE",
      requestId: req.id
    });
    return active;
  }
  return refreshed;
}
