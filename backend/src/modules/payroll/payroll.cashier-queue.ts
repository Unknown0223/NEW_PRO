import { prisma } from "../../config/database";
import { appendTenantAuditEvent, AuditEntityType } from "../../lib/tenant-audit";
import { branchCashDeskIds } from "../tenant-settings/tenant-settings.types";
import { loadLedgerRefs } from "../cash-desks/cash-desk-ledger";
import {
  branchMatches,
  cashierDeskIds,
  loadAdvanceUsers,
  loadTenantBranches,
  type AdvanceActor
} from "./payroll.advances.shared";
import { PayrollError } from "./payroll.route-helpers";

export type QueueRow = {
  kind: "advance" | "salary";
  id: number;
  position: number;
  user_id: number;
  fio: string;
  code: string | null;
  role: string | null;
  branch: string | null;
  year: number;
  month: number;
  amount: number;
  currency: string;
  approved_at: string | null;
  queue_key: string | null;
  skip_count: number;
  desk_ids: number[];
  no_cashier: boolean;
};

/**
 * Filial kassiri navbati: tasdiqlangan avanslar (`queue_key` bo'yicha) va tasdiqlangan oyliklar
 * (qoldig'i > 0). Kassir faqat o'z kassalari biriktirilgan filiallarni ko'radi.
 */
export async function listCashierQueue(tenantId: number, actor: AdvanceActor, opts: { q?: string; kind?: string } = {}) {
  const [deskIds, branches, settings, refs] = await Promise.all([
    cashierDeskIds(tenantId, actor),
    loadTenantBranches(tenantId),
    prisma.payrollSettings.findUnique({ where: { tenant_id: tenantId } }),
    loadLedgerRefs(prisma, tenantId)
  ]);
  const visibleBranches = deskIds == null ? branches : branches.filter((b) => branchCashDeskIds(b).some((d) => deskIds.includes(d)));
  const branchFor = (value: string | null) => branches.find((b) => branchMatches(b, value)) ?? null;
  const allowed = (value: string | null) => deskIds == null || visibleBranches.some((b) => branchMatches(b, value));

  const [advances, records] = await Promise.all([
    opts.kind === "salary"
      ? Promise.resolve([])
      : prisma.payrollAdvance.findMany({
          where: { tenant_id: tenantId, status: "approved" },
          orderBy: [{ queue_key: "asc" }, { id: "asc" }],
          take: 3000
        }),
    opts.kind === "advance" || settings?.salary_queue_enabled === false
      ? Promise.resolve([])
      : prisma.payrollRecord.findMany({
          where: { tenant_id: tenantId, status: "confirmed", balance: { gt: 0 } },
          orderBy: [{ confirmed_at: "asc" }, { id: "asc" }],
          take: 3000
        })
  ]);
  const users = await loadAdvanceUsers(tenantId, [...advances.map((a) => a.user_id), ...records.map((r) => r.user_id)]);
  const desksOf = (branch: string | null) => {
    const b = branchFor(branch);
    const all = b ? branchCashDeskIds(b) : [];
    return deskIds == null ? all : all.filter((d) => deskIds.includes(d));
  };
  const rows: QueueRow[] = [];
  for (const a of advances) {
    const branch = a.branch_snapshot ?? users.get(a.user_id)?.branch ?? null;
    if (!allowed(branch)) continue;
    const u = users.get(a.user_id);
    const desks = desksOf(branch);
    rows.push({
      kind: "advance",
      id: a.id,
      position: 0,
      user_id: a.user_id,
      fio: u?.fio ?? `#${a.user_id}`,
      code: u?.code ?? null,
      role: u?.role ?? null,
      branch,
      year: a.year,
      month: a.month,
      amount: Number(a.amount),
      currency: a.currency,
      approved_at: a.approved_at?.toISOString() ?? null,
      queue_key: (a.queue_key ?? a.approved_at)?.toISOString() ?? null,
      skip_count: a.skip_count,
      desk_ids: desks,
      no_cashier: !(branchFor(branch) && branchCashDeskIds(branchFor(branch)!).length)
    });
  }
  for (const r of records) {
    const u = users.get(r.user_id);
    const branch = r.branch ?? u?.branch ?? null;
    if (!allowed(branch)) continue;
    rows.push({
      kind: "salary",
      id: r.id,
      position: 0,
      user_id: r.user_id,
      fio: u?.fio ?? `#${r.user_id}`,
      code: u?.code ?? null,
      role: r.role ?? u?.role ?? null,
      branch,
      year: r.year,
      month: r.month,
      amount: Number(r.balance),
      currency: r.currency,
      approved_at: r.confirmed_at?.toISOString() ?? null,
      queue_key: r.confirmed_at?.toISOString() ?? null,
      skip_count: 0,
      desk_ids: desksOf(branch),
      no_cashier: !(branchFor(branch) && branchCashDeskIds(branchFor(branch)!).length)
    });
  }
  rows.sort((a, b) => (a.queue_key ?? "").localeCompare(b.queue_key ?? "") || a.id - b.id);
  rows.forEach((r, i) => (r.position = i + 1));
  const q = opts.q?.trim().toLocaleLowerCase("ru");
  const filtered = q ? rows.filter((r) => `${r.fio} ${r.code ?? ""}`.toLocaleLowerCase("ru").includes(q)) : rows;

  const deskFilter = deskIds == null ? {} : { id: { in: deskIds } };
  const desks = await prisma.cashDesk.findMany({
    where: { tenant_id: tenantId, is_active: true, ...deskFilter },
    select: { id: true, name: true },
    orderBy: [{ sort_order: "asc" }, { name: "asc" }]
  });
  return {
    rows: filtered,
    desks,
    payment_methods: refs.methods
      .filter((m) => m.active !== false)
      .map((m) => ({ id: m.id, ref: m.code || m.name, name: m.name, currency: m.currency_code })),
    default_currency: refs.defaultCurrency,
    totals: { count: filtered.length, amount: Math.round(filtered.reduce((s, r) => s + r.amount, 0) * 100) / 100 }
  };
}

/** «Пропустить / сдвинуть»: xodim navbat oxiriga o'tadi. */
export async function skipQueueAdvance(tenantId: number, actor: AdvanceActor, id: number) {
  const a = await prisma.payrollAdvance.findFirst({ where: { id, tenant_id: tenantId } });
  if (!a) throw new PayrollError("NOT_FOUND");
  if (a.status !== "approved") throw new PayrollError("BAD_STATUS");
  const deskIds = await cashierDeskIds(tenantId, actor);
  if (deskIds) {
    const branches = await loadTenantBranches(tenantId);
    const b = branches.find((x) => branchMatches(x, a.branch_snapshot));
    if (!b || !branchCashDeskIds(b).some((d) => deskIds.includes(d))) throw new PayrollError("NOT_CASHIER_DESK");
  }
  const now = new Date();
  await prisma.payrollAdvance.update({
    where: { id },
    data: { queue_key: now, skip_count: { increment: 1 }, last_skipped_at: now, last_skipped_by: actor.userId }
  });
  await appendTenantAuditEvent({
    tenantId,
    actorUserId: actor.userId,
    entityType: AuditEntityType.payroll,
    entityId: id,
    action: "payroll.advance.skip",
    payload: { skip_count: a.skip_count + 1 }
  });
}

export async function listPayouts(
  tenantId: number,
  actor: AdvanceActor,
  f: { year?: number; month?: number; user_id?: number; cash_desk_id?: number; kind?: string; limit?: number }
) {
  const deskIds = await cashierDeskIds(tenantId, actor);
  const rows = await prisma.payrollPayout.findMany({
    where: {
      tenant_id: tenantId,
      ...(f.year ? { year: f.year } : {}),
      ...(f.month ? { month: f.month } : {}),
      ...(f.user_id ? { user_id: f.user_id } : {}),
      ...(f.kind ? { kind: f.kind } : {}),
      ...(f.cash_desk_id ? { cash_desk_id: f.cash_desk_id } : deskIds ? { cash_desk_id: { in: deskIds } } : {})
    },
    orderBy: { paid_at: "desc" },
    take: Math.min(f.limit ?? 200, 1000)
  });
  const users = await loadAdvanceUsers(tenantId, rows.flatMap((r) => [r.user_id, ...(r.paid_by ? [r.paid_by] : [])]));
  const desks = new Map(
    (await prisma.cashDesk.findMany({ where: { tenant_id: tenantId }, select: { id: true, name: true } })).map((d) => [d.id, d.name])
  );
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    user_id: r.user_id,
    fio: users.get(r.user_id)?.fio ?? `#${r.user_id}`,
    year: r.year,
    month: r.month,
    amount: Number(r.amount),
    currency: r.currency,
    amount_uzs: Number(r.amount_uzs),
    rate: Number(r.rate),
    cash_desk_id: r.cash_desk_id,
    cash_desk_name: desks.get(r.cash_desk_id) ?? null,
    payment_method_ref: r.payment_method_ref,
    paid_at: r.paid_at.toISOString(),
    paid_by: r.paid_by ? users.get(r.paid_by)?.fio ?? `#${r.paid_by}` : null,
    status: r.status,
    reverse_reason: r.reverse_reason,
    expense_id: r.expense_id
  }));
}
