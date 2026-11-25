/** Ulashish API / domain error codes (spec Share* → SHARE_*). */
export const SHARE_SENDER_CANNOT_ACT = "SHARE_SENDER_CANNOT_ACT";
export const SHARE_INVALID_TRANSITION = "SHARE_INVALID_TRANSITION";
export const SHARE_NOT_SAME_WAREHOUSE = "SHARE_NOT_SAME_WAREHOUSE";
export const SHARE_ORDER_ALREADY_LOCKED = "SHARE_ORDER_ALREADY_LOCKED";
export const SHARE_ORDER_NOT_ELIGIBLE = "SHARE_ORDER_NOT_ELIGIBLE";
export const SHARE_NOT_ACCEPTED_YET = "SHARE_NOT_ACCEPTED_YET";
export const SHARE_PHOTO_REQUIRED = "SHARE_PHOTO_REQUIRED";
export const SHARE_NOT_SAME_LOCATION = "SHARE_NOT_SAME_LOCATION";
export const SHARE_HANDOFF_INCOMPLETE = "SHARE_HANDOFF_INCOMPLETE";
export const SHARE_RETURN_ONLY_REMAINING = "SHARE_RETURN_ONLY_REMAINING";
export const SHARE_RETURN_NEEDS_ACCEPT = "SHARE_RETURN_NEEDS_ACCEPT";
export const SHARE_REQUEST_EXPIRED = "SHARE_REQUEST_EXPIRED";

export class ShareError extends Error {
  readonly code: string;
  constructor(code: string, message?: string) {
    super(message ?? code);
    this.code = code;
    this.name = "ShareError";
  }
}
