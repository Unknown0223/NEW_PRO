import { prisma } from "../../../config/database";
import {
  SHARE_INVALID_TRANSITION,
  SHARE_SENDER_CANNOT_ACT,
  ShareError
} from "./share-codes";
import { emitShareNotification } from "./share-notify";
import { transitionShare, type ShareStatus } from "./share-state.pure";

/** Faol ulashishdan qaytarish so‘rovi — faqat receiver. */
export async function requestShareReturn(input: {
  tenantId: number;
  userId: number;
  requestId: number;
}) {
  const req = await prisma.expeditorShareRequest.findFirst({
    where: { tenant_id: input.tenantId, id: input.requestId },
    include: { orders: true }
  });
  if (!req) throw new ShareError("NOT_FOUND");
  if (req.receiver_user_id !== input.userId) {
    throw new ShareError(SHARE_SENDER_CANNOT_ACT);
  }
  const next = transitionShare(req.status as ShareStatus, "RETURN_REQUEST", "receiver");
  const updated = await prisma.expeditorShareRequest.update({
    where: { id: req.id },
    data: { status: next },
    include: { orders: true }
  });
  void emitShareNotification({
    tenantId: input.tenantId,
    userId: req.sender_user_id,
    code: "SHARE_RETURN_REQUEST",
    requestId: req.id,
    body: `So‘rov #${req.id}`
  });
  return updated;
}

/** Qaytarishni yuboruvchi qabul qiladi — zakazlar qulfi ochiladi. */
export async function acceptShareReturn(input: {
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
  const next = transitionShare(req.status as ShareStatus, "RETURN_ACCEPT", "sender");
  const updated = await prisma.$transaction(async (tx) => {
    await tx.expeditorShareOrder.updateMany({
      where: { request_id: req.id },
      data: { locked: false }
    });
    return tx.expeditorShareRequest.update({
      where: { id: req.id },
      data: { status: next },
      include: { orders: true }
    });
  });
  void emitShareNotification({
    tenantId: input.tenantId,
    userId: req.receiver_user_id,
    code: "SHARE_RETURN_DONE",
    requestId: req.id,
    body: `So‘rov #${req.id}`
  });
  return updated;
}
