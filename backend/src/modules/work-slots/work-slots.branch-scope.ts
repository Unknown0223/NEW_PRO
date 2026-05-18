import { prisma } from "../../config/database";

/** Maydon rollari — bitta filialda yozish (reja Q-06). */
export const FIELD_STAFF_SINGLE_BRANCH_ROLES = [
  "agent",
  "collector",
  "expeditor",
  "skladchik"
] as const;

export type FieldStaffSingleBranchRole = (typeof FIELD_STAFF_SINGLE_BRANCH_ROLES)[number];

export function isFieldStaffSingleBranchRole(role: string): role is FieldStaffSingleBranchRole {
  return (FIELD_STAFF_SINGLE_BRANCH_ROLES as readonly string[]).includes(role);
}

export function normalizeBranchCode(branch: string | null | undefined): string | null {
  const t = branch?.trim();
  return t && t.length > 0 ? t.toLowerCase() : null;
}

/** Viewer maydon xodimi bo‘lsa, resurs filiali viewer filiali bilan mos bo‘lishi kerak. */
export function assertFieldStaffBranchScope(
  viewerRole: string | undefined,
  viewerBranch: string | null | undefined,
  resourceBranch: string | null | undefined
): void {
  if (!viewerRole || !isFieldStaffSingleBranchRole(viewerRole)) return;
  const vb = normalizeBranchCode(viewerBranch);
  const rb = normalizeBranchCode(resourceBranch);
  if (!vb || !rb) return;
  if (vb !== rb) throw new Error("BRANCH_SCOPE_VIOLATION");
}

type ViewerBranchCtx = { role: string; branch: string | null };

/** Aktiv foydalanuvchi filiali — maydon xodimi uchun to‘lov/zakaz cheklovi (Q-06). */
export async function loadViewerBranchContext(
  tenantId: number,
  actorUserId: number | null | undefined
): Promise<ViewerBranchCtx | null> {
  if (actorUserId == null || !Number.isFinite(actorUserId) || actorUserId < 1) return null;
  const u = await prisma.user.findFirst({
    where: { id: actorUserId, tenant_id: tenantId, is_active: true },
    select: { role: true, branch: true }
  });
  if (!u) return null;
  return { role: u.role, branch: u.branch };
}

export async function assertFieldStaffBranchScopeForActor(
  tenantId: number,
  actorUserId: number | null | undefined,
  resourceUserIds: Array<number | null | undefined>,
  resourceBranches: Array<string | null | undefined> = []
): Promise<void> {
  const viewer = await loadViewerBranchContext(tenantId, actorUserId);
  if (!viewer || !isFieldStaffSingleBranchRole(viewer.role)) return;

  const uniqueUserIds = [
    ...new Set(
      resourceUserIds.filter((id): id is number => id != null && Number.isFinite(id) && id > 0)
    )
  ];
  if (uniqueUserIds.length > 0) {
    const users = await prisma.user.findMany({
      where: { tenant_id: tenantId, id: { in: uniqueUserIds } },
      select: { id: true, branch: true }
    });
    for (const u of users) {
      assertFieldStaffBranchScope(viewer.role, viewer.branch, u.branch);
    }
  }

  for (const branch of resourceBranches) {
    assertFieldStaffBranchScope(viewer.role, viewer.branch, branch);
  }
}
