import type { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { withTransaction } from "../../lib/db-context";
import { appendTenantAuditEvent, AuditEntityType } from "../../lib/tenant-audit";
import { assertAdvanceWithinLimit } from "./payroll.advance-limits";
import { actorIdsOf, advanceToDto, loadAdvanceUsers, type AdvanceActor } from "./payroll.advances.shared";
import { notifyUsers } from "./payroll.notify";
import { PayrollError } from "./payroll.route-helpers";

export type ApprovalFilter = {
  statuses?: string[];
  branch?: string;
  role?: string;
  sent_by?: number;
  date_from?: Date;
  date_to?: Date;
  year?: number;
  month?: number;
  q?: string;
};

export async function listAdvanceApprovals(tenantId: number, f: ApprovalFilter) {
  const where: Prisma.PayrollAdvanceWhereInput = {
    tenant_id: tenantId,
    status: { in: f.statuses?.length ? f.statuses : ["sent"] }
  };
  if (f.branch) where.branch_snapshot = { equals: f.branch, mode: "insensitive" };
  if (f.sent_by) where.sent_by = f.sent_by;
  if (f.year) where.year = f.year;
  if (f.month) where.month = f.month;
  if (f.date_from || f.date_to) where.sent_at = { ...(f.date_from ? { gte: f.date_from } : {}), ...(f.date_to ? { lte: f.date_to } : {}) };
  const rows = await prisma.payrollAdvance.findMany({ where, orderBy: [{ sent_at: "asc" }, { id: "asc" }], take: 5000 });
  const users = await loadAdvanceUsers(tenantId, actorIdsOf(rows));
  const q = f.q?.trim().toLocaleLowerCase("ru");
  const data = rows
    .map((r) => advanceToDto(r, users))
    .filter((r) => (!f.role || r.role === f.role) && (!q || `${r.fio} ${r.code ?? ""}`.toLocaleLowerCase("ru").includes(q)));
  const branches = [...new Set(rows.map((r) => r.branch_snapshot).filter((x): x is string => Boolean(x)))].sort();
  const senders = [...new Set(rows.map((r) => r.sent_by).filter((x): x is number => x != null))].map((id) => ({
    id,
    fio: users.get(id)?.fio ?? `#${id}`
  }));
  return {
    rows: data,
    totals: { count: data.length, amount: Math.round(data.reduce((s, r) => s + r.amount, 0) * 100) / 100 },
    filters: { branches, senders }
  };
}

function groupBySender(rows: Array<{ sent_by: number | null; created_by: number | null }>): Map<number, number> {
  const m = new Map<number, number>();
  for (const r of rows) {
    const id = r.sent_by ?? r.created_by;
    if (id) m.set(id, (m.get(id) ?? 0) + 1);
  }
  return m;
}

/** Guruh yoki bittalab tasdiqlash: sent → approved (navbat kaliti = tasdiq vaqti). */
export async function approveAdvances(tenantId: number, actor: AdvanceActor, ids: number[]) {
  const rows = await prisma.payrollAdvance.findMany({ where: { tenant_id: tenantId, id: { in: ids } } });
  const users = await loadAdvanceUsers(tenantId, rows.map((r) => r.user_id));
  let approved = 0;
  const skipped: Array<{ id: number; reason: string; extras?: unknown }> = [];
  const done: typeof rows = [];
  for (const a of rows) {
    if (a.status !== "sent") {
      skipped.push({ id: a.id, reason: `status:${a.status}` });
      continue;
    }
    try {
      await withTransaction(async (tx) => {
        await assertAdvanceWithinLimit(tx, tenantId, { id: a.user_id, role: users.get(a.user_id)?.role ?? "" }, a.year, a.month, Number(a.amount), a.id);
        const now = new Date();
        const res = await tx.payrollAdvance.updateMany({
          where: { id: a.id, status: "sent" },
          data: { status: "approved", approved_by: actor.userId, approved_at: now, queue_key: now }
        });
        if (!res.count) throw new PayrollError("BAD_STATUS");
      });
      approved++;
      done.push(a);
    } catch (e) {
      const pe = e as PayrollError;
      skipped.push({ id: a.id, reason: pe.message, extras: pe.extras });
    }
  }
  if (approved) {
    await appendTenantAuditEvent({
      tenantId,
      actorUserId: actor.userId,
      entityType: AuditEntityType.payroll,
      entityId: ids.join(",").slice(0, 64),
      action: "payroll.advance.approve",
      payload: { ids: done.map((d) => d.id) }
    });
    for (const [uid, n] of groupBySender(done)) {
      await notifyUsers(tenantId, [uid], { title: "Авансы утверждены", body: `Утверждено: ${n}`, href: "/users/advances" });
    }
  }
  return { approved, skipped };
}

export async function rejectAdvances(tenantId: number, actor: AdvanceActor, ids: number[], reason: string) {
  const why = reason.trim();
  if (!why) throw new PayrollError("REASON_REQUIRED");
  const rows = await prisma.payrollAdvance.findMany({ where: { tenant_id: tenantId, id: { in: ids } } });
  const done: typeof rows = [];
  const skipped: Array<{ id: number; reason: string }> = [];
  for (const a of rows) {
    const res = await prisma.payrollAdvance.updateMany({
      where: { id: a.id, status: "sent" },
      data: { status: "rejected", rejected_by: actor.userId, rejected_at: new Date(), reject_reason: why.slice(0, 500) }
    });
    if (res.count) done.push(a);
    else skipped.push({ id: a.id, reason: `status:${a.status}` });
  }
  if (done.length) {
    await appendTenantAuditEvent({
      tenantId,
      actorUserId: actor.userId,
      entityType: AuditEntityType.payroll,
      entityId: ids.join(",").slice(0, 64),
      action: "payroll.advance.reject",
      payload: { ids: done.map((d) => d.id), reason: why }
    });
    for (const [uid, n] of groupBySender(done)) {
      await notifyUsers(tenantId, [uid], { title: "Авансы отклонены", body: `${n}: ${why}`, href: "/users/advances" });
    }
  }
  return { rejected: done.length, skipped };
}
