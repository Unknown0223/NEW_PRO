/**
 * Chiqish bosilmagan kunlar: kirish bor, rasmiy chiqish yo‘q.
 */
import { prisma } from "../../config/database";
import { toFio } from "../staff/staff.shared.helpers";
import { loadBranchLabelSources } from "../tenant-settings/tenant-settings.refs";
import {
  branchLabelLookup,
  branchVisibleName,
  expandBranchFilterKeys
} from "../tenant-settings/branch-display.pure";

const SKIP_STATUS = ["vacation", "sick", "holiday", "trip", "unpaid_leave"];

export type MissingCheckoutRow = {
  user_id: number;
  user_fio: string;
  user_role: string;
  user_branch: string | null;
  work_date_ymd: string;
  first_in_at: string;
};

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function listMissingCheckouts(
  tenantId: number,
  filters: { from?: string; to?: string; branch?: string }
): Promise<MissingCheckoutRow[]> {
  const workDate: { gte?: Date; lte?: Date } = {};
  if (filters.from && /^\d{4}-\d{2}-\d{2}$/.test(filters.from)) workDate.gte = new Date(`${filters.from}T00:00:00.000Z`);
  if (filters.to && /^\d{4}-\d{2}-\d{2}$/.test(filters.to)) workDate.lte = new Date(`${filters.to}T00:00:00.000Z`);

  const branchNames = (filters.branch ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const catalog = await loadBranchLabelSources(tenantId);
  const lookup = branchLabelLookup(catalog);
  const keys = expandBranchFilterKeys(branchNames, catalog);

  let userIds: number[] | undefined;
  if (keys.length > 0) {
    const users = await prisma.user.findMany({
      where: {
        tenant_id: tenantId,
        OR: keys.flatMap((name) => [
          { branch: { equals: name, mode: "insensitive" as const } },
          { branch_links: { some: { branch_code: { equals: name, mode: "insensitive" as const } } } }
        ])
      },
      select: { id: true }
    });
    userIds = users.map((u) => u.id);
    if (userIds.length === 0) return [];
  }

  const rows = await prisma.attendanceDayRecord.findMany({
    where: {
      tenant_id: tenantId,
      first_in_at: { not: null },
      last_out_at: null,
      status: { notIn: SKIP_STATUS },
      ...(workDate.gte || workDate.lte ? { work_date: workDate } : {}),
      ...(userIds ? { user_id: { in: userIds } } : {})
    },
    orderBy: [{ work_date: "desc" }, { user_id: "asc" }],
    take: 200
  });

  const ids = [...new Set(rows.map((r) => r.user_id))];
  const users = ids.length
    ? await prisma.user.findMany({
        where: { tenant_id: tenantId, id: { in: ids } },
        select: { id: true, name: true, first_name: true, last_name: true, middle_name: true, role: true, branch: true }
      })
    : [];
  const byId = new Map(users.map((u) => [u.id, u]));

  return rows.flatMap((r) => {
    if (!r.first_in_at) return [];
    const u = byId.get(r.user_id);
    return [
      {
        user_id: r.user_id,
        user_fio: u ? toFio(u) : `User #${r.user_id}`,
        user_role: u?.role ?? "—",
        user_branch: branchVisibleName(u?.branch ?? null, lookup),
        work_date_ymd: ymd(r.work_date),
        first_in_at: r.first_in_at.toISOString()
      }
    ];
  });
}
