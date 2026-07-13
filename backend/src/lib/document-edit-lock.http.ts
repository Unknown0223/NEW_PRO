import type { FastifyReply, FastifyRequest } from "fastify";
import { sendApiError } from "./api-error";
import {
  DOCUMENT_EDIT_PERIOD_LOCKED,
  DOCUMENT_EDIT_PERIOD_LOCKED_MESSAGE,
  DocumentEditPeriodLockedError
} from "./document-edit-lock.assert";

export function isDocumentEditPeriodLockedError(e: unknown): boolean {
  if (e instanceof DocumentEditPeriodLockedError) return true;
  return e instanceof Error && e.message === DOCUMENT_EDIT_PERIOD_LOCKED;
}

export function sendDocumentEditPeriodLocked(
  reply: FastifyReply,
  request: FastifyRequest
) {
  return sendApiError(
    reply,
    request,
    403,
    DOCUMENT_EDIT_PERIOD_LOCKED,
    DOCUMENT_EDIT_PERIOD_LOCKED_MESSAGE
  );
}
