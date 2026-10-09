import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import type { DbExecutor } from "../../lib/db-context";
import { appendTenantAuditEvent, AuditEntityType } from "../../lib/tenant-audit";
import { toFio } from "../staff/staff.shared.helpers";
import { PayrollError } from "./payroll.route-helpers";

export const ADVANCE_COUNTED_STATUSES = ["draft", "sent", "approved", "paid"];

export type AdvanceLimitDto = {
  id: number;
  scope: "global" | "role" | "user";
  scope_key: string;
  role: string | null;
  user_id: number | null;
  user_fio: string | null;
  max_amount: number;
  is_exception: boolean;
  comment: string | null;
  updated_at: string;
};

export type EffectiveLimit = { max: number; scope: "global" | "role" | "user"; is_exception: boolean } | null;

type LimitRow = { scope: string; role: string | null; user_id: number | null; max_amount: Prisma.Decimal; is_exception: boolean };

/** Xodim istisnosi → rol limiti → umumiy limit → cheksiz (null). */
export function pickEffectiveLimit(rows: LimitRow[], userId: number, role: string): EffectiveLimit {
  const u = rows.find((r) => r.scope === "user" && r.user_id === userId);
  if (u) return { max: Number(u.max_amount), scope: "user", is_exception: u.is_exception };
  const r = rows.find((x) => x.scope === "role" && x.role === role);
  if (r) return { max: Number(r.max_amount), scope: "role", is_exception: false };
  const g = rows.find((x) => x.scope === "global");
  if (g) return { max: Number(g.max_amount), scope: "global", is_exception: false };
  return null;
}

export async function loadLimitRows(db: DbExecutor, tenantId: number): Promise<LimitRow[]> {
  return db.payrollAdvanceLimit.findMany({
    where: { tenant_id: tenantId },
    select: { scope: true, role: true, user_id: true, max_amount: true, is_exception: true }
  });
}

export async function sumCountedAdvances(
  db: DbExecutor,
  tenantId: number,
  userId: number,
  year: number,
  month: number,
  excludeId?: number
): Promise<number> {
  const agg = await db.payrollAdvance.aggregate({
    where: {
      tenant_id: tenantId,
      user_id: userId,
      year,
      month,
      status: { in: ADVANCE_COUNTED_STATUSES },
      ...(excludeId ? { NOT: { id: excludeId } } : {})
    },
    _sum: { amount: true }
  });
  return Number(agg._sum.amount ?? 0);
}

/** `(tenant, xodim, oy)` bo'yicha tranzaksion advisory lock — parallel yozishga qarshi. */
export async function lockAdvanceUserMonth(tx: Prisma.TransactionClient, tenantId: number, userId: number, year: number, month: number) {
  await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`payroll_adv:${tenantId}:${userId}:${year}-${month}`}))`);
}

/** Yangi summa bilan oylik limit oshmaydimi (tranzaksiya ichida, lock bilan). */
export async function assertAdvanceWithinLimit(
  tx: Prisma.TransactionClient,
  tenantId: number,
  user: { id: number; role: string },
  year: number,
  month: number,
  amount: number,
  excludeId?: number
): Promise<{ limit: EffectiveLimit; used: number }> {
  await lockAdvanceUserMonth(tx, tenantId, user.id, year, month);
  const [rows, used] = await Promise.all([
    loadLimitRows(tx, tenantId),
    sumCountedAdvances(tx, tenantId, user.id, year, month, excludeId)
  ]);
  const limit = pickEffectiveLimit(rows, user.id, user.role);
  if (limit && used + amount > limit.max + 0.001) {
    throw new PayrollError("LIMIT_EXCEEDED", { limit: limit.max, used, requested: amount, remaining: Math.max(0, limit.max - used) });
  }
  return { limit, used };
}

export async function listAdvanceLimits(tenantId: number): Promise<AdvanceLimitDto[]> {
  const rows = await prisma.payrollAdvanceLimit.findMany({
    where: { tenant_id: tenantId },
    orderBy: [{ scope: "asc" }, { role: "asc" }, { user_id: "asc" }]
  });
  const uids = rows.map((r) => r.user_id).filter((x): x is number => x != null);
  const users = uids.length
    ? await prisma.user.findMany({
        where: { tenant_id: tenantId, id: { in: uids } },
        select: { id: true, name: true, first_name: true, last_name: true, middle_name: true }
      })
    : [];
  const fio = new Map(users.map((u) => [u.id, toFio(u)]));
  return rows.map((r) => ({
    id: r.id,
    scope: r.scope as AdvanceLimitDto["scope"],
    scope_key: r.scope_key,
    role: r.role,
    user_id: r.user_id,
    user_fio: r.user_id ? fio.get(r.user_id) ?? null : null,
    max_amount: Number(r.max_amount),
    is_exception: r.is_exception,
    comment: r.comment,
    updated_at: r.updated_at.toISOString()
  }));
}

export type AdvanceLimitInput = {
  scope: "global" | "role" | "user";
  role?: string | null;
  user_id?: number | null;
  max_amount: number;
  is_exception?: boolean;
  comment?: string | null;
};

export async function upsertAdvanceLimit(tenantId: number, input: AdvanceLimitInput, actorId: number | null) {
  if (!Number.isFinite(input.max_amount) || input.max_amount < 0) throw new PayrollError("BAD_AMOUNT");
  let key = "global";
  if (input.scope === "role") {
    const role = input.role?.trim();
    if (!role) throw new PayrollError("BAD_ROLE");
    key = `role:${role}`;
  } else if (input.scope === "user") {
    if (!input.user_id) throw new PayrollError("BAD_USER");
    const u = await prisma.user.findFirst({ where: { id: input.user_id, tenant_id: tenantId }, select: { id: true } });
    if (!u) throw new PayrollError("BAD_USER");
    key = `user:${input.user_id}`;
  }
  const prev = await prisma.payrollAdvanceLimit.findUnique({ where: { tenant_id_scope_key: { tenant_id: tenantId, scope_key: key } } });
  const data = {
    scope: input.scope,
    role: input.scope === "role" ? input.role!.trim() : null,
    user_id: input.scope === "user" ? input.user_id! : null,
    max_amount: input.max_amount,
    is_exception: input.scope === "user" ? input.is_exception ?? true : false,
    comment: input.comment?.trim().slice(0, 500) || null,
    created_by: actorId
  };
  const row = await prisma.payrollAdvanceLimit.upsert({
    where: { tenant_id_scope_key: { tenant_id: tenantId, scope_key: key } },
    create: { tenant_id: tenantId, scope_key: key, ...data },
    update: data
  });
  await appendTenantAuditEvent({
    tenantId,
    actorUserId: actorId,
    entityType: AuditEntityType.payroll,
    entityId: row.id,
    action: "payroll.advance_limit.upsert",
    payload: { scope_key: key, before: prev ? Number(prev.max_amount) : null, after: input.max_amount, is_exception: data.is_exception }
  });
  return row;
}

export async function deleteAdvanceLimit(tenantId: number, id: number, actorId: number | null) {
  const row = await prisma.payrollAdvanceLimit.findFirst({ where: { id, tenant_id: tenantId } });
  if (!row) throw new PayrollError("NOT_FOUND");
  await prisma.payrollAdvanceLimit.delete({ where: { id } });
  await appendTenantAuditEvent({
    tenantId,
    actorUserId: actorId,
    entityType: AuditEntityType.payroll,
    entityId: id,
    action: "payroll.advance_limit.delete",
    payload: { scope_key: row.scope_key, max_amount: Number(row.max_amount) }
  });
}
