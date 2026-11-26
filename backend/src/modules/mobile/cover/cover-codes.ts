/** Agent ↔ SVR cover domain codes. */
export const COVER_INVALID_TRANSITION = "COVER_INVALID_TRANSITION";
export const COVER_NOT_LINKED = "COVER_NOT_LINKED";
export const COVER_ALREADY_ACTIVE = "COVER_ALREADY_ACTIVE";
export const COVER_FACE_REQUIRED = "COVER_FACE_REQUIRED";
export const COVER_FORBIDDEN_ACTOR = "COVER_FORBIDDEN_ACTOR";
export const COVER_AGENT_BLOCKED = "COVER_AGENT_BLOCKED";

export class CoverError extends Error {
  readonly code: string;
  constructor(code: string, message?: string) {
    super(message ?? code);
    this.code = code;
    this.name = "CoverError";
  }
}
