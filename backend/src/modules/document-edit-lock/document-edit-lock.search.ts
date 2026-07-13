import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import type { DocumentEditLockSection } from "../../lib/document-edit-lock";

export type DocumentSearchHit = {
  section: DocumentEditLockSection;
  document_id: number;
  document_kind: string | null;
  label: string;
  document_date: string;
};

function parseYmdStart(iso: string): Date {
  return new Date(`${iso.trim()}T00:00:00.000Z`);
}

function parseYmdEnd(iso: string): Date {
  return new Date(`${iso.trim()}T23:59:59.999Z`);
}

const LIMIT = 50;

export async function searchDocumentsForEditLock(input: {
  tenantId: number;
  section: DocumentEditLockSection;
  documentId?: number;
  dateFrom?: string;
  dateTo?: string;
}): Promise<DocumentSearchHit[]> {
  const dateFrom = input.dateFrom?.trim() ? parseYmdStart(input.dateFrom) : undefined;
  const dateTo = input.dateTo?.trim() ? parseYmdEnd(input.dateTo) : undefined;
  const id = input.documentId != null && input.documentId > 0 ? input.documentId : undefined;

  switch (input.section) {
    case "payments": {
      const where: Prisma.PaymentWhereInput = {
        tenant_id: input.tenantId,
        ...(id ? { id } : {}),
        ...(dateFrom || dateTo
          ? {
              OR: [
                {
                  paid_at: {
                    ...(dateFrom ? { gte: dateFrom } : {}),
                    ...(dateTo ? { lte: dateTo } : {})
                  }
                },
                {
                  AND: [
                    { paid_at: null },
                    {
                      created_at: {
                        ...(dateFrom ? { gte: dateFrom } : {}),
                        ...(dateTo ? { lte: dateTo } : {})
                      }
                    }
                  ]
                }
              ]
            }
          : {})
      };
      const rows = await prisma.payment.findMany({
        where,
        orderBy: [{ paid_at: "desc" }, { created_at: "desc" }],
        take: LIMIT,
        select: {
          id: true,
          paid_at: true,
          created_at: true,
          amount: true,
          client: { select: { name: true } }
        }
      });
      return rows.map((r) => {
        const d = r.paid_at ?? r.created_at;
        return {
          section: "payments" as const,
          document_id: r.id,
          document_kind: null,
          label: `#${r.id} · ${r.client?.name ?? "—"} · ${String(r.amount)}`,
          document_date: d.toISOString()
        };
      });
    }
    case "orders": {
      const where: Prisma.OrderWhereInput = {
        tenant_id: input.tenantId,
        ...(id ? { id } : {}),
        ...(dateFrom || dateTo
          ? {
              created_at: {
                ...(dateFrom ? { gte: dateFrom } : {}),
                ...(dateTo ? { lte: dateTo } : {})
              }
            }
          : {})
      };
      const rows = await prisma.order.findMany({
        where,
        orderBy: { created_at: "desc" },
        take: LIMIT,
        select: {
          id: true,
          number: true,
          created_at: true,
          status: true,
          client: { select: { name: true } }
        }
      });
      return rows.map((r) => ({
        section: "orders" as const,
        document_id: r.id,
        document_kind: null,
        label: `${r.number} · ${r.client?.name ?? "—"} · ${r.status}`,
        document_date: r.created_at.toISOString()
      }));
    }
    case "returns": {
      const where: Prisma.SalesReturnWhereInput = {
        tenant_id: input.tenantId,
        ...(id ? { id } : {}),
        ...(dateFrom || dateTo
          ? {
              created_at: {
                ...(dateFrom ? { gte: dateFrom } : {}),
                ...(dateTo ? { lte: dateTo } : {})
              }
            }
          : {})
      };
      const rows = await prisma.salesReturn.findMany({
        where,
        orderBy: { created_at: "desc" },
        take: LIMIT,
        select: { id: true, number: true, created_at: true, status: true }
      });
      return rows.map((r) => ({
        section: "returns" as const,
        document_id: r.id,
        document_kind: null,
        label: `${r.number} · ${r.status}`,
        document_date: r.created_at.toISOString()
      }));
    }
    case "expenses": {
      const where: Prisma.ExpenseWhereInput = {
        tenant_id: input.tenantId,
        ...(id ? { id } : {}),
        ...(dateFrom || dateTo
          ? {
              expense_date: {
                ...(dateFrom ? { gte: dateFrom } : {}),
                ...(dateTo ? { lte: dateTo } : {})
              }
            }
          : {})
      };
      const rows = await prisma.expense.findMany({
        where,
        orderBy: { expense_date: "desc" },
        take: LIMIT,
        select: { id: true, expense_type: true, amount: true, expense_date: true, status: true }
      });
      return rows.map((r) => ({
        section: "expenses" as const,
        document_id: r.id,
        document_kind: null,
        label: `#${r.id} · ${r.expense_type} · ${String(r.amount)} · ${r.status}`,
        document_date: r.expense_date.toISOString()
      }));
    }
    case "opening_balances": {
      const where: Prisma.ClientOpeningBalanceEntryWhereInput = {
        tenant_id: input.tenantId,
        ...(id ? { id } : {}),
        ...(dateFrom || dateTo
          ? {
              OR: [
                {
                  paid_at: {
                    ...(dateFrom ? { gte: dateFrom } : {}),
                    ...(dateTo ? { lte: dateTo } : {})
                  }
                },
                {
                  AND: [
                    { paid_at: null },
                    {
                      created_at: {
                        ...(dateFrom ? { gte: dateFrom } : {}),
                        ...(dateTo ? { lte: dateTo } : {})
                      }
                    }
                  ]
                }
              ]
            }
          : {})
      };
      const rows = await prisma.clientOpeningBalanceEntry.findMany({
        where,
        orderBy: { created_at: "desc" },
        take: LIMIT,
        select: {
          id: true,
          amount: true,
          paid_at: true,
          created_at: true,
          client: { select: { name: true } }
        }
      });
      return rows.map((r) => {
        const d = r.paid_at ?? r.created_at;
        return {
          section: "opening_balances" as const,
          document_id: r.id,
          document_kind: null,
          label: `#${r.id} · ${r.client?.name ?? "—"} · ${String(r.amount)}`,
          document_date: d.toISOString()
        };
      });
    }
    case "stock": {
      const hits: DocumentSearchHit[] = [];
      const receiptWhere: Prisma.GoodsReceiptWhereInput = {
        tenant_id: input.tenantId,
        ...(id ? { id } : {}),
        ...(dateFrom || dateTo
          ? {
              created_at: {
                ...(dateFrom ? { gte: dateFrom } : {}),
                ...(dateTo ? { lte: dateTo } : {})
              }
            }
          : {})
      };
      const receipts = await prisma.goodsReceipt.findMany({
        where: receiptWhere,
        orderBy: { created_at: "desc" },
        take: LIMIT,
        select: { id: true, number: true, created_at: true, status: true }
      });
      for (const r of receipts) {
        hits.push({
          section: "stock",
          document_id: r.id,
          document_kind: "goods_receipt",
          label: `Kirim ${r.number} · ${r.status}`,
          document_date: r.created_at.toISOString()
        });
      }

      const transferSql =
        id != null
          ? Prisma.sql`
              SELECT id, created_at, status
              FROM warehouse_transfers
              WHERE tenant_id = ${input.tenantId} AND id = ${id}
              LIMIT ${LIMIT}
            `
          : dateFrom || dateTo
            ? Prisma.sql`
                SELECT id, created_at, status
                FROM warehouse_transfers
                WHERE tenant_id = ${input.tenantId}
                  AND created_at >= ${dateFrom ?? new Date(0)}
                  AND created_at <= ${dateTo ?? new Date("9999-12-31")}
                ORDER BY created_at DESC
                LIMIT ${LIMIT}
              `
            : Prisma.sql`
                SELECT id, created_at, status
                FROM warehouse_transfers
                WHERE tenant_id = ${input.tenantId}
                ORDER BY created_at DESC
                LIMIT ${LIMIT}
              `;
      const transfers = await prisma.$queryRaw<
        Array<{ id: number; created_at: Date; status: string }>
      >(transferSql);
      for (const r of transfers) {
        hits.push({
          section: "stock",
          document_id: r.id,
          document_kind: "transfer",
          label: `Transfer #${r.id} · ${r.status}`,
          document_date: new Date(r.created_at).toISOString()
        });
      }

      const corrWhere: Prisma.WarehouseCorrectionWhereInput = {
        tenant_id: input.tenantId,
        ...(id ? { id } : {}),
        ...(dateFrom || dateTo
          ? {
              occurred_at: {
                ...(dateFrom ? { gte: dateFrom } : {}),
                ...(dateTo ? { lte: dateTo } : {})
              }
            }
          : {})
      };
      const corrections = await prisma.warehouseCorrection.findMany({
        where: corrWhere,
        orderBy: { occurred_at: "desc" },
        take: LIMIT,
        select: { id: true, kind: true, occurred_at: true }
      });
      for (const r of corrections) {
        hits.push({
          section: "stock",
          document_id: r.id,
          document_kind: "correction",
          label: `Korrektirovka #${r.id} · ${r.kind}`,
          document_date: r.occurred_at.toISOString()
        });
      }

      hits.sort((a, b) => (a.document_date < b.document_date ? 1 : -1));
      return hits.slice(0, LIMIT);
    }
    default:
      return [];
  }
}
