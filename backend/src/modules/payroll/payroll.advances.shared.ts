import type { PayrollAdvance } from "@prisma/client";
import { prisma } from "../../config/database";
import { enrichScopedReportActor } from "../access/access-agent-scope";
import { toFio } from "../staff/staff.shared.helpers";
import { branchesFromUnknown } from "../tenant-settings/tenant-settings.refs";
import { branchCashDeskIds, type BranchDto } from "../tenant-settings/tenant-settings.types";
import { PayrollError } from "./payroll.route-helpers";

export type AdvanceActor = { userId: number | null; role: string };

/** `null` — cheklovsiz (admin); aks holda ko'rinadigan xodimlar to'plami. */
export async function advanceScopeUserIds(tenantId: number, actor: AdvanceActor): Promise<Set<number> | null> {
  if (actor.role === "admin") return null;
  const s = await enrichScopedReportActor(tenantId, actor);
  return new Set(s.bound_staff_ids ?? []);
}

export function assertInScope(scope: Set<number> | null, userId: number) {
  if (scope && !scope.has(userId)) throw new PayrollError("NOT_IN_SCOPE");
}

export type AdvanceUserInfo = { id: number; fio: string; code: string | null; role: string; branch: string | null; is_active: boolean };

export async function loadAdvanceUsers(tenantId: number, ids: number[]): Promise<Map<number, AdvanceUserInfo>> {
  if (!ids.length) return new Map();
  const rows = await prisma.user.findMany({
    where: { tenant_id: tenantId, id: { in: [...new Set(ids)] } },
    select: {
      id: true,
      name: true,
      first_name: true,
      last_name: true,
      middle_name: true,
      code: true,
      role: true,
      branch: true,
      is_active: true,
      branch_links: { select: { branch_code: true }, take: 1 }
    }
  });
  return new Map(
    rows.map((u) => [
      u.id,
      {
        id: u.id,
        fio: toFio(u),
        code: u.code,
        role: u.role,
        branch: u.branch?.trim() || u.branch_links[0]?.branch_code?.trim() || null,
        is_active: u.is_active
      }
    ])
  );
}

export function advanceToDto(a: PayrollAdvance, users: Map<number, AdvanceUserInfo>) {
  const u = users.get(a.user_id);
  const who = (id: number | null) => (id != null ? users.get(id)?.fio ?? `#${id}` : null);
  return {
    id: a.id,
    user_id: a.user_id,
    fio: u?.fio ?? `#${a.user_id}`,
    code: u?.code ?? null,
    role: u?.role ?? null,
    branch: a.branch_snapshot ?? u?.branch ?? null,
    year: a.year,
    month: a.month,
    amount: Number(a.amount),
    currency: a.currency,
    status: a.status,
    source: a.source,
    comment: a.comment,
    created_at: a.created_at.toISOString(),
    created_by: who(a.created_by),
    sent_at: a.sent_at?.toISOString() ?? null,
    sent_by: who(a.sent_by),
    approved_at: a.approved_at?.toISOString() ?? null,
    approved_by: who(a.approved_by),
    rejected_at: a.rejected_at?.toISOString() ?? null,
    rejected_by: who(a.rejected_by),
    reject_reason: a.reject_reason,
    queue_key: a.queue_key?.toISOString() ?? null,
    skip_count: a.skip_count,
    last_skipped_at: a.last_skipped_at?.toISOString() ?? null,
    payout_id: a.payout_id,
    limit_exception_used: a.limit_exception_used
  };
}

export function actorIdsOf(rows: PayrollAdvance[]): number[] {
  const out: number[] = [];
  for (const a of rows) {
    out.push(a.user_id);
    for (const id of [a.created_by, a.sent_by, a.approved_by, a.rejected_by]) if (id != null) out.push(id);
  }
  return out;
}

export async function loadTenantBranches(tenantId: number): Promise<BranchDto[]> {
  const t = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { settings: true } });
  const refs = ((t?.settings as Record<string, unknown> | null)?.references ?? {}) as Record<string, unknown>;
  return branchesFromUnknown(refs.branches);
}

const norm = (s: string | null | undefined) => (s ?? "").trim().toLocaleLowerCase("ru");

export function branchMatches(b: BranchDto, value: string | null | undefined): boolean {
  const v = norm(value);
  if (!v) return false;
  return [b.id, b.code ?? "", b.name].some((x) => norm(x) === v);
}

/** Xodim filiali → filial kassalari. */
export function cashDesksForBranch(branches: BranchDto[], branch: string | null | undefined): number[] {
  const b = branches.find((x) => branchMatches(x, branch));
  return b ? branchCashDeskIds(b) : [];
}

/** Kassirning (link_role=cashier) kassalari + Dostup kassalari. */
export async function cashierDeskIds(tenantId: number, actor: AdvanceActor): Promise<number[] | null> {
  if (actor.role === "admin") return null;
  if (!actor.userId) return [];
  const [links, scope] = await Promise.all([
    prisma.cashDeskUserLink.findMany({
      where: { user_id: actor.userId, link_role: "cashier", cash_desk: { tenant_id: tenantId, is_active: true } },
      select: { cash_desk_id: true }
    }),
    enrichScopedReportActor(tenantId, actor)
  ]);
  return [...new Set([...links.map((l) => l.cash_desk_id), ...(scope.cash_desk_ids ?? [])])];
}
