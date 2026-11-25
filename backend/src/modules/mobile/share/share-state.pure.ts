import {
  SHARE_INVALID_TRANSITION,
  SHARE_SENDER_CANNOT_ACT,
  ShareError
} from "./share-codes";

export type ShareStatus =
  | "kutilmoqda"
  | "korildi"
  | "qisman_qabul"
  | "qabul_qilindi"
  | "yuk_kutilmoqda"
  | "faol"
  | "rad"
  | "bekor"
  | "qaytarish_kutilmoqda"
  | "qaytarildi"
  | "tugallandi";

export type ShareEvent =
  | "VIEW"
  | "ACCEPT_FULL"
  | "ACCEPT_PARTIAL"
  | "REJECT"
  | "CANCEL"
  | "START_HANDOFF"
  | "HANDOFF_OK"
  | "RETURN_REQUEST"
  | "RETURN_ACCEPT"
  | "EXPIRE";

export type ShareRole = "sender" | "receiver";

function fail(code: string): never {
  throw new ShareError(code);
}

/**
 * Pure Ulashish status transitions.
 * Ruling: START_HANDOFF bridges qabul_* → yuk_kutilmoqda (GPS/foto before faol).
 */
export function transitionShare(
  from: ShareStatus,
  event: ShareEvent,
  role: ShareRole
): ShareStatus {
  switch (event) {
    case "VIEW":
      if (role !== "receiver") fail(SHARE_SENDER_CANNOT_ACT);
      if (from !== "kutilmoqda") fail(SHARE_INVALID_TRANSITION);
      return "korildi";

    case "CANCEL":
      if (role !== "sender") fail(SHARE_INVALID_TRANSITION);
      if (from !== "kutilmoqda" && from !== "korildi") {
        fail(SHARE_INVALID_TRANSITION);
      }
      return "bekor";

    case "ACCEPT_FULL":
      if (role !== "receiver") fail(SHARE_SENDER_CANNOT_ACT);
      if (from !== "korildi" && from !== "kutilmoqda") {
        fail(SHARE_INVALID_TRANSITION);
      }
      return "qabul_qilindi";

    case "ACCEPT_PARTIAL":
      if (role !== "receiver") fail(SHARE_SENDER_CANNOT_ACT);
      if (from !== "korildi" && from !== "kutilmoqda") {
        fail(SHARE_INVALID_TRANSITION);
      }
      return "qisman_qabul";

    case "REJECT":
      if (role !== "receiver") fail(SHARE_SENDER_CANNOT_ACT);
      if (from !== "korildi" && from !== "kutilmoqda") {
        fail(SHARE_INVALID_TRANSITION);
      }
      return "rad";

    case "START_HANDOFF":
      if (from !== "qabul_qilindi" && from !== "qisman_qabul") {
        fail(SHARE_INVALID_TRANSITION);
      }
      return "yuk_kutilmoqda";

    case "HANDOFF_OK":
      if (from !== "yuk_kutilmoqda") fail(SHARE_INVALID_TRANSITION);
      return "faol";

    case "EXPIRE":
      if (from !== "kutilmoqda" && from !== "korildi") {
        fail(SHARE_INVALID_TRANSITION);
      }
      return "bekor";

    case "RETURN_REQUEST":
      if (from !== "faol") fail(SHARE_INVALID_TRANSITION);
      return "qaytarish_kutilmoqda";

    case "RETURN_ACCEPT":
      if (from !== "qaytarish_kutilmoqda") fail(SHARE_INVALID_TRANSITION);
      return "qaytarildi";

    default:
      fail(SHARE_INVALID_TRANSITION);
  }
}
