import {
  COVER_FACE_REQUIRED,
  COVER_FORBIDDEN_ACTOR,
  COVER_INVALID_TRANSITION,
  CoverError
} from "./cover-codes";

export type CoverStatus = "kutilmoqda" | "faol" | "tugallandi" | "rad" | "bekor";

export type CoverEvent = "ACCEPT" | "REJECT" | "CANCEL" | "END";

export type CoverActor = "agent" | "svr" | "requester" | "counterparty";

function fail(code: string): never {
  throw new CoverError(code);
}

/**
 * MVP: so‘rov `kutilmoqda` → qarshi tomon ACCEPT (+ ikkala face) → `faol`.
 * END faqat `faol` dan.
 */
export function transitionCover(
  from: CoverStatus,
  event: CoverEvent,
  actor: CoverActor
): CoverStatus {
  switch (event) {
    case "CANCEL":
      if (actor !== "requester" && actor !== "agent" && actor !== "svr") {
        fail(COVER_FORBIDDEN_ACTOR);
      }
      if (from !== "kutilmoqda") fail(COVER_INVALID_TRANSITION);
      return "bekor";

    case "REJECT":
      if (actor !== "counterparty" && actor !== "agent" && actor !== "svr") {
        fail(COVER_FORBIDDEN_ACTOR);
      }
      if (from !== "kutilmoqda") fail(COVER_INVALID_TRANSITION);
      return "rad";

    case "ACCEPT":
      if (actor !== "counterparty" && actor !== "agent" && actor !== "svr") {
        fail(COVER_FORBIDDEN_ACTOR);
      }
      if (from !== "kutilmoqda") fail(COVER_INVALID_TRANSITION);
      return "faol";

    case "END":
      if (from !== "faol") fail(COVER_INVALID_TRANSITION);
      return "tugallandi";

    default:
      fail(COVER_INVALID_TRANSITION);
  }
}

export function assertFacesForAccept(agentFaceOk: boolean, svrFaceOk: boolean): void {
  if (!agentFaceOk || !svrFaceOk) {
    throw new CoverError(COVER_FACE_REQUIRED);
  }
}
