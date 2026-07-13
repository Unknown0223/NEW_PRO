import type { FastifyRequest } from "fastify";
import { actorUserIdOrNull } from "./request-actor";
import { getAccessUser } from "../modules/auth/auth.prehandlers";
import type { DocumentEditLockSection } from "./document-edit-lock";
import {
  assertDocumentEditable,
  assertDocumentEditableById
} from "./document-edit-lock.assert";

export async function assertDocWritableById(
  request: FastifyRequest,
  section: DocumentEditLockSection,
  documentId: number,
  documentKind?: string | null
): Promise<void> {
  const user = getAccessUser(request);
  await assertDocumentEditableById({
    tenantId: request.tenant!.id,
    section,
    documentId,
    actorUserId: actorUserIdOrNull(request),
    actorRole: user.role,
    documentKind
  });
}

export async function assertDocWritableByDate(
  request: FastifyRequest,
  section: DocumentEditLockSection,
  documentDate: Date | null | undefined,
  documentId: number | null = null,
  documentKind?: string | null
): Promise<void> {
  const user = getAccessUser(request);
  await assertDocumentEditable({
    tenantId: request.tenant!.id,
    section,
    documentId,
    documentDate,
    actorUserId: actorUserIdOrNull(request),
    actorRole: user.role,
    documentKind
  });
}
