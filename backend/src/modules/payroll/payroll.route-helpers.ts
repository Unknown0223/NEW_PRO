import type { FastifyReply, FastifyRequest } from "fastify";
import type { ZodError } from "zod";
import { sendApiError, zodValidationExtras } from "../../lib/api-error";
import { ensureTenantContext } from "../../lib/tenant-context";
import { actorUserIdOrNull } from "../../lib/request-actor";
import { getAccessUser, jwtAccessVerify, requireAnyPermission } from "../auth/auth.prehandlers";

/** `jwtAccessVerify` + ruxsatlardan biri (admin — bypass). */
export function perm(...keys: string[]) {
  return { preHandler: [jwtAccessVerify, requireAnyPermission(keys)] };
}

export type PayrollCtx = { tenantId: number; actorId: number | null; role: string; userId: number };

export function payrollCtx(request: FastifyRequest, reply: FastifyReply): PayrollCtx | null {
  if (!ensureTenantContext(request, reply)) return null;
  const u = getAccessUser(request);
  return {
    tenantId: request.tenant!.id,
    actorId: actorUserIdOrNull(request),
    role: String(u.role ?? ""),
    userId: Number(u.sub)
  };
}

export function sendZod(reply: FastifyReply, request: FastifyRequest, err: ZodError) {
  return sendApiError(reply, request, 400, "ValidationError", undefined, zodValidationExtras(err));
}

const ERROR_MAP: Record<string, [number, string]> = {
  NOT_FOUND: [404, "NotFound"],
  BAD_MONTH: [400, "BadMonth"],
  BAD_ROLE: [400, "BadRole"],
  BAD_USER: [400, "BadUser"],
  BAD_CASH_DESK: [400, "BadCashDesk"],
  BAD_ITEM: [400, "BadItem"],
  DUPLICATE_NAME: [409, "DuplicateName"],
  SYSTEM_ITEM: [409, "SystemItemLocked"],
  ITEM_IN_USE: [409, "ItemInUse"],
  FORMULA_INVALID: [400, "FormulaInvalid"],
  PERIOD_CLOSED: [409, "PayrollPeriodClosed"],
  RECORD_FROZEN: [409, "PayrollRecordFrozen"],
  BAD_STATUS: [409, "BadStatus"],
  LIMIT_EXCEEDED: [409, "AdvanceLimitExceeded"],
  NOT_IN_SCOPE: [403, "EmployeeNotInScope"],
  INSUFFICIENT_CASH: [409, "InsufficientCash"],
  NOT_CASHIER_DESK: [403, "NotCashierDesk"],
  PAYROLL_DISABLED: [409, "PayrollDisabled"],
  REASON_REQUIRED: [400, "ReasonRequired"],
  AMOUNT_EXCEEDS_BALANCE: [409, "AmountExceedsBalance"],
  BAD_AMOUNT: [400, "BadAmount"],
  ADMIN_ONLY: [403, "AdminOnly"],
  NO_RATE: [409, "NoExchangeRate"],
  FORMULA_IN_USE: [409, "FormulaInUse"],
  NO_RECORDS: [409, "NoRecords"],
  HAS_UNCONFIRMED: [409, "HasUnconfirmedRecords"],
  QUEUE_DISABLED: [409, "SalaryQueueDisabled"]
};

/** Servis `Error(message)` → API javobi. `true` — javob yuborildi. */
export function mapPayrollError(reply: FastifyReply, request: FastifyRequest, e: unknown): boolean {
  const msg = e instanceof Error ? e.message : "";
  const hit = ERROR_MAP[msg];
  if (!hit) return false;
  const extras = (e as { extras?: Record<string, unknown> }).extras;
  void sendApiError(reply, request, hit[0], hit[1], undefined, extras);
  return true;
}

/** Servis chaqiruvi: `PayrollError` → API javobi, qolganlari yuqoriga. */
export async function runPayroll<T>(reply: FastifyReply, request: FastifyRequest, fn: () => Promise<T>): Promise<T | FastifyReply> {
  try {
    return await fn();
  } catch (e) {
    if (mapPayrollError(reply, request, e)) return reply;
    throw e;
  }
}

export class PayrollError extends Error {
  constructor(
    code: string,
    public extras?: Record<string, unknown>
  ) {
    super(code);
  }
}

export function parseYm(q: Record<string, unknown>): { year: number; month: number } | null {
  const year = Number(q.year);
  const month = Number(q.month);
  if (!Number.isInteger(year) || year < 2000 || year > 2100) return null;
  if (!Number.isInteger(month) || month < 1 || month > 12) return null;
  return { year, month };
}

export function csvList(raw: unknown): string[] {
  if (raw == null) return [];
  const arr = Array.isArray(raw) ? raw : [raw];
  return [...new Set(arr.flatMap((x) => String(x).split(",")).map((s) => s.trim()).filter(Boolean))];
}
