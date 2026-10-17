import type { FastifyReply, FastifyRequest } from "fastify";
import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { sendApiError } from "../../lib/api-error";
import { withTransaction } from "../../lib/db-context";
import { isPayrollEnabled } from "../payroll/payroll.settings";

export const PAYROLL_EXPENSE_TYPES = { advance: "payroll_advance", salary: "payroll_salary" } as const;

const PAYROLL_CATEGORY_ENTRIES = [
  { id: "sys-payroll-salary", code: PAYROLL_EXPENSE_TYPES.salary, name: "Зарплата", sort_order: 9000 },
  { id: "sys-payroll-advance", code: PAYROLL_EXPENSE_TYPES.advance, name: "Аванс", sort_order: 9001 }
];

const PAYROLL_TYPE_WORDS = new Set(["зарплата", "аванс", "oylik", "avans", "maosh", "ish haqi"]);

export function isPayrollExpenseType(type: string | null | undefined): boolean {
  const t = (type ?? "").trim().toLocaleLowerCase("ru");
  return t === PAYROLL_EXPENSE_TYPES.advance || t === PAYROLL_EXPENSE_TYPES.salary || PAYROLL_TYPE_WORDS.has(t);
}

/** Payroll yoqilgan tenantda «Зарплата/Аванс» qo'lda xarajat sifatida yaratilmaydi. */
export async function assertManualExpenseTypeAllowed(tenantId: number, type: string | null | undefined): Promise<void> {
  if (!isPayrollExpenseType(type)) return;
  if (await isPayrollEnabled(tenantId)) throw new Error("PAYROLL_MANAGED_EXPENSE");
}

export function assertNotPayrollExpense(existing: { source_type?: string | null }): void {
  if (existing.source_type && existing.source_type !== "manual") throw new Error("PAYROLL_EXPENSE_READONLY");
}

export function sendExpensePayrollError(reply: FastifyReply, request: FastifyRequest, e: unknown): boolean {
  const msg = e instanceof Error ? e.message : "";
  if (msg === "PAYROLL_MANAGED_EXPENSE") {
    void sendApiError(reply, request, 409, "PayrollManagedExpense", "Зарплата и аванс выдаются через раздел «Зарплата»");
    return true;
  }
  if (msg === "PAYROLL_EXPENSE_READONLY") {
    void sendApiError(reply, request, 409, "PayrollExpenseReadonly", "Запись создана выплатой зарплаты/аванса — изменяется только там");
    return true;
  }
  return false;
}

/** Tizim moliya kategoriyalari («Зарплата», «Аванс») — mavjud bo'lmasa qo'shiladi. */
export async function ensurePayrollFinanceCategories(tenantId: number): Promise<void> {
  await withTransaction(async (tx) => {
    const rows = await tx.$queryRaw<Array<{ settings: Prisma.JsonValue }>>(
      Prisma.sql`SELECT settings FROM tenants WHERE id = ${tenantId} FOR UPDATE`
    );
    const root = (rows[0]?.settings ?? {}) as Record<string, unknown>;
    const refs = (root.references && typeof root.references === "object" ? root.references : {}) as Record<string, unknown>;
    const cur = Array.isArray(refs.finance_category_entries) ? (refs.finance_category_entries as Array<Record<string, unknown>>) : [];
    const codes = new Set(cur.map((e) => String(e.code ?? "").toLowerCase()));
    const missing = PAYROLL_CATEGORY_ENTRIES.filter((e) => !codes.has(e.code));
    if (!missing.length) return;
    const next = [
      ...cur,
      ...missing.map((e) => ({ ...e, comment: "Системная категория (Зарплата)", active: true, color: null }))
    ];
    await tx.tenant.update({
      where: { id: tenantId },
      data: { settings: { ...root, references: { ...refs, finance_category_entries: next } } as Prisma.InputJsonValue }
    });
  });
}

export async function loadExpenseSource(tenantId: number, expenseId: number) {
  return prisma.expense.findFirst({ where: { id: expenseId, tenant_id: tenantId }, select: { source_type: true } });
}
