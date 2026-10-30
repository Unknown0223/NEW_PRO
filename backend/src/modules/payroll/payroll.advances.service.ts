import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { withTransaction } from "../../lib/db-context";
import { appendTenantAuditEvent, AuditEntityType } from "../../lib/tenant-audit";
import { resolveUserBySmartCodeForMonth } from "../work-slots/work-slots.holder-at-month";
import { assertAdvanceWithinLimit, loadLimitRows, pickEffectiveLimit, sumCountedAdvances } from "./payroll.advance-limits";
import {
  actorIdsOf,
  advanceScopeUserIds,
  advanceToDto,
  assertInScope,
  loadAdvanceUsers,
  type AdvanceActor
} from "./payroll.advances.shared";
import { notifyPermissionHolders } from "./payroll.notify";
import { PayrollError } from "./payroll.route-helpers";
import { isPayrollEnabled } from "./payroll.settings";

const ymKey = (y: number, m: number) => `${y}-${String(m).padStart(2, "0")}`;

async function audit(tenantId: number, actorId: number | null, id: number | string, action: string, payload: unknown) {
  await appendTenantAuditEvent({ tenantId, actorUserId: actorId, entityType: AuditEntityType.payroll, entityId: id, action, payload });
}

async function assertEnabled(tenantId: number) {
  if (!(await isPayrollEnabled(tenantId))) throw new PayrollError("PAYROLL_DISABLED");
}

async function assertOpenMonth(tenantId: number, year: number, month: number) {
  const p = await prisma.payrollPeriod.findUnique({
    where: { tenant_id_year_month: { tenant_id: tenantId, year, month } },
    select: { status: true }
  });
  if (p?.status === "closed") throw new PayrollError("PERIOD_CLOSED");
}

export type AdvanceListFilter = { year: number; month: number; statuses?: string[]; q?: string; user_ids?: number[] };

export async function listManagerAdvances(tenantId: number, actor: AdvanceActor, f: AdvanceListFilter) {
  const scope = await advanceScopeUserIds(tenantId, actor);
  const where: Prisma.PayrollAdvanceWhereInput = { tenant_id: tenantId, year: f.year, month: f.month };
  if (f.statuses?.length) where.status = { in: f.statuses };
  const ids = f.user_ids?.length ? f.user_ids.filter((id) => !scope || scope.has(id)) : scope ? [...scope] : null;
  if (ids) where.user_id = { in: ids };
  const rows = await prisma.payrollAdvance.findMany({ where, orderBy: [{ created_at: "desc" }], take: 5000 });
  const users = await loadAdvanceUsers(tenantId, actorIdsOf(rows));
  const q = f.q?.trim().toLocaleLowerCase("ru");
  const limitRows = await loadLimitRows(prisma, tenantId);
  const usedBy = new Map<number, number>();
  for (const r of rows) {
    if (["draft", "sent", "approved", "paid"].includes(r.status)) usedBy.set(r.user_id, (usedBy.get(r.user_id) ?? 0) + Number(r.amount));
  }
  return rows
    .map((r) => {
      const dto = advanceToDto(r, users);
      const lim = pickEffectiveLimit(limitRows, r.user_id, dto.role ?? "");
      const used = usedBy.get(r.user_id) ?? 0;
      return { ...dto, limit: lim ? { max: lim.max, scope: lim.scope, used, remaining: Math.max(0, lim.max - used) } : null };
    })
    .filter((r) => !q || `${r.fio} ${r.code ?? ""}`.toLocaleLowerCase("ru").includes(q));
}

/** Rahbarning xodimlari (avans berish uchun) + oylik limit qoldig'i. */
export async function listAdvanceEmployees(tenantId: number, actor: AdvanceActor, f: { year: number; month: number; q?: string }) {
  const scope = await advanceScopeUserIds(tenantId, actor);
  const users = await prisma.user.findMany({
    where: {
      tenant_id: tenantId,
      is_active: true,
      NOT: { role: "admin" },
      ...(scope ? { id: { in: [...scope] } } : {})
    },
    select: { id: true },
    take: 3000
  });
  const info = await loadAdvanceUsers(tenantId, users.map((u) => u.id));
  const [limitRows, used] = await Promise.all([
    loadLimitRows(prisma, tenantId),
    prisma.payrollAdvance.groupBy({
      by: ["user_id"],
      where: { tenant_id: tenantId, year: f.year, month: f.month, status: { in: ["draft", "sent", "approved", "paid"] } },
      _sum: { amount: true }
    })
  ]);
  const usedBy = new Map(used.map((u) => [u.user_id, Number(u._sum.amount ?? 0)]));
  const q = f.q?.trim().toLocaleLowerCase("ru");
  return [...info.values()]
    .filter((u) => !q || `${u.fio} ${u.code ?? ""}`.toLocaleLowerCase("ru").includes(q))
    .sort((a, b) => a.fio.localeCompare(b.fio, "ru"))
    .map((u) => {
      const lim = pickEffectiveLimit(limitRows, u.id, u.role);
      const usedAmt = usedBy.get(u.id) ?? 0;
      return { ...u, used: usedAmt, limit: lim?.max ?? null, remaining: lim ? Math.max(0, lim.max - usedAmt) : null };
    });
}

export type AdvanceInput = { user_id: number; year: number; month: number; amount: number; comment?: string | null };

export async function createAdvance(tenantId: number, actor: AdvanceActor, input: AdvanceInput, source: "manual" | "excel" = "manual", batch?: string) {
  await assertEnabled(tenantId);
  await assertOpenMonth(tenantId, input.year, input.month);
  if (!Number.isFinite(input.amount) || input.amount <= 0) throw new PayrollError("BAD_AMOUNT");
  const scope = await advanceScopeUserIds(tenantId, actor);
  assertInScope(scope, input.user_id);
  const user = await prisma.user.findFirst({ where: { id: input.user_id, tenant_id: tenantId }, select: { id: true, role: true } });
  if (!user || user.role === "admin") throw new PayrollError("BAD_USER");
  const row = await withTransaction(async (tx) => {
    const { limit } = await assertAdvanceWithinLimit(tx, tenantId, user, input.year, input.month, input.amount);
    return tx.payrollAdvance.create({
      data: {
        tenant_id: tenantId,
        user_id: user.id,
        year: input.year,
        month: input.month,
        amount: input.amount,
        status: "draft",
        created_by: actor.userId,
        source,
        import_batch_id: batch ?? null,
        limit_exception_used: limit?.is_exception ?? false,
        comment: input.comment?.trim().slice(0, 500) || null
      }
    });
  });
  await audit(tenantId, actor.userId, row.id, "payroll.advance.create", { user_id: user.id, amount: input.amount, month: ymKey(input.year, input.month), source });
  return row;
}

async function loadOwned(tenantId: number, actor: AdvanceActor, id: number) {
  const a = await prisma.payrollAdvance.findFirst({ where: { id, tenant_id: tenantId } });
  if (!a) throw new PayrollError("NOT_FOUND");
  assertInScope(await advanceScopeUserIds(tenantId, actor), a.user_id);
  return a;
}

export async function updateAdvance(
  tenantId: number,
  actor: AdvanceActor,
  id: number,
  input: { amount?: number; comment?: string | null; year?: number; month?: number }
) {
  const a = await loadOwned(tenantId, actor, id);
  if (!["draft", "rejected"].includes(a.status)) throw new PayrollError("BAD_STATUS");
  const amount = input.amount ?? Number(a.amount);
  const year = input.year ?? a.year;
  const month = input.month ?? a.month;
  if (!Number.isFinite(amount) || amount <= 0) throw new PayrollError("BAD_AMOUNT");
  await assertOpenMonth(tenantId, year, month);
  const user = await prisma.user.findFirstOrThrow({ where: { id: a.user_id }, select: { id: true, role: true } });
  const row = await withTransaction(async (tx) => {
    const { limit } = await assertAdvanceWithinLimit(tx, tenantId, user, year, month, amount, a.id);
    return tx.payrollAdvance.update({
      where: { id },
      data: {
        amount,
        year,
        month,
        status: "draft",
        limit_exception_used: limit?.is_exception ?? false,
        ...(input.comment !== undefined ? { comment: input.comment?.trim().slice(0, 500) || null } : {})
      }
    });
  });
  await audit(tenantId, actor.userId, id, "payroll.advance.update", { before: Number(a.amount), after: amount });
  return row;
}

export async function deleteAdvance(tenantId: number, actor: AdvanceActor, id: number) {
  const a = await loadOwned(tenantId, actor, id);
  if (a.status !== "draft") throw new PayrollError("BAD_STATUS");
  await prisma.payrollAdvance.delete({ where: { id } });
  await audit(tenantId, actor.userId, id, "payroll.advance.delete", { user_id: a.user_id, amount: Number(a.amount) });
}

/** Отправить: draft/rejected → sent. Limit qayta tekshiriladi, filial snapshot yoziladi. */
export async function sendAdvances(tenantId: number, actor: AdvanceActor, ids: number[]) {
  await assertEnabled(tenantId);
  const scope = await advanceScopeUserIds(tenantId, actor);
  const rows = await prisma.payrollAdvance.findMany({ where: { tenant_id: tenantId, id: { in: ids } } });
  const users = await loadAdvanceUsers(tenantId, rows.map((r) => r.user_id));
  const skipped: Array<{ id: number; reason: string; extras?: unknown }> = [];
  let sent = 0;
  for (const a of rows) {
    if (scope && !scope.has(a.user_id)) {
      skipped.push({ id: a.id, reason: "not_in_scope" });
      continue;
    }
    if (!["draft", "rejected"].includes(a.status)) {
      skipped.push({ id: a.id, reason: `status:${a.status}` });
      continue;
    }
    const u = users.get(a.user_id);
    try {
      await withTransaction(async (tx) => {
        await assertAdvanceWithinLimit(tx, tenantId, { id: a.user_id, role: u?.role ?? "" }, a.year, a.month, Number(a.amount), a.id);
        await tx.payrollAdvance.update({
          where: { id: a.id },
          data: { status: "sent", sent_by: actor.userId, sent_at: new Date(), branch_snapshot: u?.branch ?? null, reject_reason: null }
        });
      });
      sent++;
    } catch (e) {
      const pe = e as PayrollError;
      skipped.push({ id: a.id, reason: pe.message, extras: pe.extras });
    }
  }
  if (sent) {
    await audit(tenantId, actor.userId, ids.join(",").slice(0, 64), "payroll.advance.send", { ids, sent });
    notifyPermissionHolders(
      tenantId,
      ["finance.avans.approve"],
      { title: "Авансы на утверждение", body: `Отправлено: ${sent}`, href: "/finance/advances/approval" },
      actor.userId
    );
  }
  return { sent, skipped };
}

/** Rahbar bekor qiladi: draft/sent/approved (to'lanmagan) → cancelled. */
export async function cancelAdvances(tenantId: number, actor: AdvanceActor, ids: number[], opts: { skipScope?: boolean } = {}) {
  const scope = opts.skipScope ? null : await advanceScopeUserIds(tenantId, actor);
  const rows = await prisma.payrollAdvance.findMany({ where: { tenant_id: tenantId, id: { in: ids } } });
  let cancelled = 0;
  const skipped: Array<{ id: number; reason: string }> = [];
  for (const a of rows) {
    if (scope && !scope.has(a.user_id)) {
      skipped.push({ id: a.id, reason: "not_in_scope" });
      continue;
    }
    if (!["draft", "sent", "approved", "rejected"].includes(a.status)) {
      skipped.push({ id: a.id, reason: `status:${a.status}` });
      continue;
    }
    const res = await prisma.payrollAdvance.updateMany({
      where: { id: a.id, status: a.status },
      data: { status: "cancelled", cancelled_by: actor.userId, cancelled_at: new Date() }
    });
    if (res.count) cancelled++;
    else skipped.push({ id: a.id, reason: "race" });
  }
  if (cancelled) await audit(tenantId, actor.userId, ids.join(",").slice(0, 64), "payroll.advance.cancel", { ids, cancelled });
  return { cancelled, skipped };
}

export type AdvanceImportRow = { code: string; amount: number; comment?: string | null };

export async function importAdvances(
  tenantId: number,
  actor: AdvanceActor,
  input: { year: number; month: number; rows: AdvanceImportRow[]; apply: boolean }
) {
  await assertEnabled(tenantId);
  await assertOpenMonth(tenantId, input.year, input.month);
  const scope = await advanceScopeUserIds(tenantId, actor);
  const limitRows = await loadLimitRows(prisma, tenantId);
  const pending = new Map<number, number>();
  const batch = randomUUID();
  const out: Array<{ row: number; code: string; amount: number; status: string; user_id?: number; fio?: string; remaining?: number | null; id?: number }> = [];
  for (let i = 0; i < input.rows.length; i++) {
    const r = input.rows[i]!;
    const base = { row: i + 1, code: r.code, amount: r.amount };
    if (!Number.isFinite(r.amount) || r.amount <= 0) {
      out.push({ ...base, status: "bad_amount" });
      continue;
    }
    const hit = await resolveUserBySmartCodeForMonth(tenantId, r.code, { year: input.year, month: input.month });
    if (!hit) {
      out.push({ ...base, status: "not_found" });
      continue;
    }
    if (scope && !scope.has(hit.userId)) {
      out.push({ ...base, status: "not_in_scope", user_id: hit.userId });
      continue;
    }
    const info = (await loadAdvanceUsers(tenantId, [hit.userId])).get(hit.userId);
    const used = (await sumCountedAdvances(prisma, tenantId, hit.userId, input.year, input.month)) + (pending.get(hit.userId) ?? 0);
    const lim = pickEffectiveLimit(limitRows, hit.userId, info?.role ?? "");
    const remaining = lim ? Math.max(0, lim.max - used) : null;
    if (lim && used + r.amount > lim.max + 0.001) {
      out.push({ ...base, status: "limit_exceeded", user_id: hit.userId, fio: info?.fio, remaining });
      continue;
    }
    pending.set(hit.userId, (pending.get(hit.userId) ?? 0) + r.amount);
    if (!input.apply) {
      out.push({ ...base, status: "ok", user_id: hit.userId, fio: info?.fio, remaining });
      continue;
    }
    try {
      const row = await createAdvance(
        tenantId,
        actor,
        { user_id: hit.userId, year: input.year, month: input.month, amount: r.amount, comment: r.comment },
        "excel",
        batch
      );
      out.push({ ...base, status: "created", user_id: hit.userId, fio: info?.fio, id: row.id });
    } catch (e) {
      out.push({ ...base, status: (e as Error).message.toLowerCase(), user_id: hit.userId, fio: info?.fio });
    }
  }
  return { batch_id: input.apply ? batch : null, rows: out };
}
