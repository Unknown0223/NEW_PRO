import {
  SHARE_HANDOFF_INCOMPLETE,
  SHARE_ORDER_ALREADY_LOCKED,
  SHARE_SENDER_CANNOT_ACT,
  ShareError
} from "./share-codes";

export type ShareLockRow = {
  orderId: number;
  locked: boolean;
  receiverUserId: number;
  senderUserId: number;
  status: string;
};

/** Zakaz qulfi ochiq (share jarayonda yoki faol). */
const LOCKED_STATUSES = new Set([
  "kutilmoqda",
  "korildi",
  "qisman_qabul",
  "qabul_qilindi",
  "yuk_kutilmoqda",
  "faol",
  "qaytarish_kutilmoqda"
]);

/**
 * create_share: any active lock → SHARE_ORDER_ALREADY_LOCKED
 * act: only receiver on `faol`; pending/handoff → SHARE_HANDOFF_INCOMPLETE;
 *      non-receiver on faol → SHARE_SENDER_CANNOT_ACT
 */
export function assertOrderShareActionAllowed(input: {
  orderId: number;
  actorUserId: number;
  locks: ShareLockRow[];
  mode?: "act" | "create_share";
}): void {
  const row = input.locks.find(
    (l) =>
      l.orderId === input.orderId &&
      l.locked &&
      LOCKED_STATUSES.has(l.status)
  );
  if (!row) return;

  if (input.mode === "create_share") {
    throw new ShareError(SHARE_ORDER_ALREADY_LOCKED);
  }

  if (row.status !== "faol") {
    throw new ShareError(SHARE_HANDOFF_INCOMPLETE);
  }

  if (input.actorUserId !== row.receiverUserId) {
    throw new ShareError(SHARE_SENDER_CANNOT_ACT);
  }
}
