import { createNotification } from "../../notifications/notifications.service";
import type { ShareNotificationCode } from "./share-notification-codes";

const TITLES: Record<ShareNotificationCode, string> = {
  SHARE_REQUEST_NEW: "Ulashish: yangi so‘rov",
  SHARE_VIEWED: "Ulashish: ko‘rildi",
  SHARE_ACCEPTED: "Ulashish: qabul qilindi",
  SHARE_REJECTED: "Ulashish: rad etildi",
  SHARE_CANCELLED: "Ulashish: bekor qilindi",
  SHARE_HANDOFF_NEEDED: "Ulashish: yuk/foto kerak",
  SHARE_PHOTO_MISSING: "Ulashish: foto yetishmayapti",
  SHARE_ACTIVE: "Ulashish: faol",
  SHARE_RETURN_REQUEST: "Ulashish: qaytarish so‘rovi",
  SHARE_RETURN_DONE: "Ulashish: qaytarildi",
  SHARE_LOCATION_MISMATCH: "Ulashish: joylashuv mos emas",
  SHARE_PARTIAL_DONE: "Ulashish: qisman qabul"
};

/** Best-effort in-app notify; xato yutib yuboriladi (asosiy oqim buzilmasin). */
export async function emitShareNotification(input: {
  tenantId: number;
  userId: number;
  code: ShareNotificationCode;
  body?: string;
  requestId: number;
}): Promise<void> {
  try {
    await createNotification({
      tenant_id: input.tenantId,
      user_id: input.userId,
      title: TITLES[input.code],
      body: input.body ?? input.code,
      link_href: `/exp-share/${input.requestId}`
    });
  } catch {
    // ignore notify failures
  }
}
