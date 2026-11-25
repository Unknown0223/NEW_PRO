/** Push / in-app event codes for Ulashish (mapper only). */
export const SHARE_NOTIFICATION_CODES = [
  "SHARE_REQUEST_NEW",
  "SHARE_VIEWED",
  "SHARE_ACCEPTED",
  "SHARE_REJECTED",
  "SHARE_CANCELLED",
  "SHARE_HANDOFF_NEEDED",
  "SHARE_PHOTO_MISSING",
  "SHARE_ACTIVE",
  "SHARE_RETURN_REQUEST",
  "SHARE_RETURN_DONE",
  "SHARE_LOCATION_MISMATCH",
  "SHARE_PARTIAL_DONE"
] as const;

export type ShareNotificationCode = (typeof SHARE_NOTIFICATION_CODES)[number];

export function isShareNotificationCode(code: string): boolean {
  return (SHARE_NOTIFICATION_CODES as readonly string[]).includes(code);
}
