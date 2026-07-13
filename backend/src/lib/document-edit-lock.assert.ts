import { prisma } from "../config/database";
import {
  DOCUMENT_EDIT_PERIOD_LOCKED,
  DOCUMENT_EDIT_PERIOD_LOCKED_MESSAGE,
  evaluateDocumentEditLockPure,
  normalizeDocumentEditLockSettings,
  type DocumentEditLockSection,
  type DocumentEditLockSettings
} from "./document-edit-lock";
import { asRecord } from "../modules/tenant-settings/tenant-settings.shared";

export { DOCUMENT_EDIT_PERIOD_LOCKED, DOCUMENT_EDIT_PERIOD_LOCKED_MESSAGE };

export class DocumentEditPeriodLockedError extends Error {
  readonly userMessage: string;
  constructor(userMessage = DOCUMENT_EDIT_PERIOD_LOCKED_MESSAGE) {
    super(DOCUMENT_EDIT_PERIOD_LOCKED);
    this.name = "DocumentEditPeriodLockedError";
    this.userMessage = userMessage;
  }
}

export async function loadDocumentEditLockSettings(
  tenantId: number
): Promise<DocumentEditLockSettings> {
  const row = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { settings: true }
  });
  const st = asRecord(row?.settings);
  return normalizeDocumentEditLockSettings(st.document_edit_lock);
}

export async function saveDocumentEditLockSettings(
  tenantId: number,
  next: DocumentEditLockSettings
): Promise<DocumentEditLockSettings> {
  const normalized = normalizeDocumentEditLockSettings(next);
  const row = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { settings: true }
  });
  if (!row) throw new Error("NOT_FOUND");
  const settings = { ...asRecord(row.settings), document_edit_lock: normalized };
  await prisma.tenant.update({
    where: { id: tenantId },
    data: { settings }
  });
  return normalized;
}

export async function hasActiveDocumentEditGrant(input: {
  tenantId: number;
  section: DocumentEditLockSection;
  documentId: number;
  userId: number;
  documentKind?: string | null;
  now?: Date;
}): Promise<boolean> {
  const now = input.now ?? new Date();
  const row = await prisma.documentEditGrant.findFirst({
    where: {
      tenant_id: input.tenantId,
      section: input.section,
      document_id: input.documentId,
      access_user_id: input.userId,
      status: "active",
      expires_at: { gt: now },
      revoked_at: null,
      ...(input.documentKind
        ? { OR: [{ document_kind: input.documentKind }, { document_kind: null }] }
        : {})
    },
    select: { id: true }
  });
  return row != null;
}

/** Hujjat sanasi + actor: yozishga ruxsat yoki throw DOCUMENT_EDIT_PERIOD_LOCKED. */
export async function assertDocumentEditable(input: {
  tenantId: number;
  section: DocumentEditLockSection;
  documentId: number | null;
  documentDate: Date | null | undefined;
  actorUserId: number | null;
  actorRole: string | null | undefined;
  documentKind?: string | null;
  settings?: DocumentEditLockSettings;
  now?: Date;
}): Promise<void> {
  const settings = input.settings ?? (await loadDocumentEditLockSettings(input.tenantId));
  const verdict = evaluateDocumentEditLockPure({
    settings,
    section: input.section,
    documentDate: input.documentDate,
    actorRole: input.actorRole,
    now: input.now
  });
  if (verdict === "allow") return;

  if (
    input.documentId != null &&
    input.documentId > 0 &&
    input.actorUserId != null &&
    input.actorUserId > 0
  ) {
    const ok = await hasActiveDocumentEditGrant({
      tenantId: input.tenantId,
      section: input.section,
      documentId: input.documentId,
      userId: input.actorUserId,
      documentKind: input.documentKind,
      now: input.now
    });
    if (ok) return;
  }

  throw new DocumentEditPeriodLockedError();
}

export type StockDocumentKind = "goods_receipt" | "transfer" | "correction" | "stock_take";

export async function resolveDocumentDateForLock(
  tenantId: number,
  section: DocumentEditLockSection,
  documentId: number,
  documentKind?: string | null
): Promise<Date | null> {
  switch (section) {
    case "payments": {
      const r = await prisma.payment.findFirst({
        where: { id: documentId, tenant_id: tenantId },
        select: { paid_at: true, created_at: true }
      });
      return r ? (r.paid_at ?? r.created_at) : null;
    }
    case "orders": {
      const r = await prisma.order.findFirst({
        where: { id: documentId, tenant_id: tenantId },
        select: { created_at: true }
      });
      return r?.created_at ?? null;
    }
    case "returns": {
      const r = await prisma.salesReturn.findFirst({
        where: { id: documentId, tenant_id: tenantId },
        select: { created_at: true }
      });
      return r?.created_at ?? null;
    }
    case "stock": {
      const kind = documentKind as StockDocumentKind | null | undefined;
      if (!kind || kind === "goods_receipt") {
        const receipt = await prisma.goodsReceipt.findFirst({
          where: { id: documentId, tenant_id: tenantId },
          select: { created_at: true }
        });
        if (receipt) return receipt.created_at;
        if (kind === "goods_receipt") return null;
      }
      if (!kind || kind === "transfer") {
        const transferRows = await prisma.$queryRaw<Array<{ created_at: Date }>>`
          SELECT created_at FROM warehouse_transfers
          WHERE id = ${documentId} AND tenant_id = ${tenantId}
          LIMIT 1
        `;
        if (transferRows[0]?.created_at) return transferRows[0].created_at;
        if (kind === "transfer") return null;
      }
      if (!kind || kind === "correction") {
        const correction = await prisma.warehouseCorrection.findFirst({
          where: { id: documentId, tenant_id: tenantId },
          select: { occurred_at: true, created_at: true }
        });
        if (correction) return correction.occurred_at ?? correction.created_at;
        if (kind === "correction") return null;
      }
      if (!kind || kind === "stock_take") {
        const take = await prisma.stockTake.findFirst({
          where: { id: documentId, tenant_id: tenantId },
          select: { created_at: true }
        });
        return take?.created_at ?? null;
      }
      return null;
    }
    case "expenses": {
      const r = await prisma.expense.findFirst({
        where: { id: documentId, tenant_id: tenantId },
        select: { expense_date: true, created_at: true }
      });
      return r ? (r.expense_date ?? r.created_at) : null;
    }
    case "opening_balances": {
      const r = await prisma.clientOpeningBalanceEntry.findFirst({
        where: { id: documentId, tenant_id: tenantId },
        select: { paid_at: true, created_at: true }
      });
      return r ? (r.paid_at ?? r.created_at) : null;
    }
    default:
      return null;
  }
}

export async function assertDocumentEditableById(input: {
  tenantId: number;
  section: DocumentEditLockSection;
  documentId: number;
  actorUserId: number | null;
  actorRole: string | null | undefined;
  documentKind?: string | null;
}): Promise<void> {
  const documentDate = await resolveDocumentDateForLock(
    input.tenantId,
    input.section,
    input.documentId,
    input.documentKind
  );
  await assertDocumentEditable({
    ...input,
    documentDate
  });
}
