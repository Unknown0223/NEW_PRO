import type { FastifyRequest } from "fastify";
import { prisma } from "../config/database";
import { getAccessUser } from "../modules/auth/auth.prehandlers";
import { evaluateDocumentEditLockPure, type DocumentEditLockSection } from "./document-edit-lock";
import {
  assertDocumentEditable,
  assertDocumentEditableById,
  DocumentEditPeriodLockedError,
  loadDocumentEditLockSettings,
  resolveDocumentDateForLock
} from "./document-edit-lock.assert";
import { actorUserIdOrNull } from "./request-actor";

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

/** Guruh yozuvlari: bitta settings + bitta findMany (har id uchun alohida SELECT emas). */
export async function assertDocsWritableByIds(
  request: FastifyRequest,
  section: DocumentEditLockSection,
  documentIds: number[],
  documentKind?: string | null
): Promise<void> {
  const ids = [...new Set(documentIds.filter((id) => Number.isFinite(id) && id > 0))];
  if (ids.length === 0) return;
  if (ids.length === 1) {
    await assertDocWritableById(request, section, ids[0]!, documentKind);
    return;
  }

  const user = getAccessUser(request);
  const tenantId = request.tenant!.id;
  const actorUserId = actorUserIdOrNull(request);
  const settings = await loadDocumentEditLockSettings(tenantId);
  const now = new Date();

  let dateById = new Map<number, Date | null>();
  if (section === "orders") {
    const rows = await prisma.order.findMany({
      where: { id: { in: ids }, tenant_id: tenantId },
      select: { id: true, created_at: true }
    });
    dateById = new Map(rows.map((r) => [r.id, r.created_at]));
  } else {
    for (const id of ids) {
      dateById.set(
        id,
        await resolveDocumentDateForLock(tenantId, section, id, documentKind)
      );
    }
  }

  let grantIds: Set<number> | null = null;
  if (actorUserId != null && actorUserId > 0) {
    const grants = await prisma.documentEditGrant.findMany({
      where: {
        tenant_id: tenantId,
        section,
        document_id: { in: ids },
        access_user_id: actorUserId,
        status: "active",
        expires_at: { gt: now },
        revoked_at: null,
        ...(documentKind
          ? { OR: [{ document_kind: documentKind }, { document_kind: null }] }
          : {})
      },
      select: { document_id: true }
    });
    grantIds = new Set(grants.map((g) => g.document_id));
  }

  for (const id of ids) {
    const documentDate = dateById.get(id) ?? null;
    const verdict = evaluateDocumentEditLockPure({
      settings,
      section,
      documentDate,
      actorRole: user.role,
      now
    });
    if (verdict === "allow") continue;
    if (grantIds?.has(id)) continue;
    throw new DocumentEditPeriodLockedError();
  }
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
