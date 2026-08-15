import { ADMIN_AND_OPERATOR_LIKE_ROLES, isOperatorLikeWebRole } from "../../lib/tenant-user-roles";
import { getAccessUser, jwtAccessVerify, requireAnyPermission, requireRoles } from "../auth/auth.prehandlers";
import { enrichScopedReportActor, intersectRequestedAgentIds } from "../access/access-agent-scope";

export const catalogRoles = [...ADMIN_AND_OPERATOR_LIKE_ROLES, "supervisor"] as const;

/**
 * Yangi strukturali + legacy «Дашбоард» kalitlari.
 * Access UI structured (`*.view`) deny → resolve/patch legacy juftlikni ham olib tashlaydi.
 * Section marshrutlarda keng `dashboard.view` OR qilinmaydi — aks holda bitta bo‘lim deny yetarli emas.
 */
export const DASHBOARD_ANY_KEYS = [
  "dashboard.view",
  "dashboard.prodazhi",
  "dashboard.prodazhi.view",
  "dashboard.finansy",
  "dashboard.finansy.view",
  "dashboard.supervayzer",
  "dashboard.supervayzer.view",
  "dashboard.plan_fakt",
  "dashboard.plan_fakt.view"
] as const;

/** @deprecated Use DASHBOARD_ANY_KEYS */
export const DASHBOARD_ANY_LEGACY = DASHBOARD_ANY_KEYS;

export const dashboardStatsPreHandler = [
  jwtAccessVerify,
  requireRoles(...catalogRoles),
  requireAnyPermission([...DASHBOARD_ANY_KEYS])
];
export const dashboardSupervisorPreHandler = [
  jwtAccessVerify,
  requireRoles(...catalogRoles),
  requireAnyPermission(["dashboard.supervayzer", "dashboard.supervayzer.view"])
];
export const dashboardFinancePreHandler = [
  jwtAccessVerify,
  requireRoles(...catalogRoles),
  requireAnyPermission(["dashboard.finansy", "dashboard.finansy.view"])
];
export const dashboardSalesPreHandler = [
  jwtAccessVerify,
  requireRoles(...catalogRoles),
  requireAnyPermission(["dashboard.prodazhi", "dashboard.prodazhi.view"])
];
export const dashboardSalesMonitoringPreHandler = [
  jwtAccessVerify,
  requireRoles(...catalogRoles),
  requireAnyPermission([
    "dashboard.plan_fakt",
    "dashboard.plan_fakt.view",
    "dashboard.prodazhi",
    "dashboard.prodazhi.view"
  ])
];

export const dashboardMetaPreHandler = [
  jwtAccessVerify,
  requireRoles(...catalogRoles),
  requireAnyPermission([...DASHBOARD_ANY_KEYS])
];

export function applySupervisorSelfScope(
  accessUser: { role: string; sub: string },
  parsed: { supervisor_ids?: number[] }
) {
  if (accessUser.role === "supervisor") {
    const selfId = Number.parseInt(accessUser.sub, 10);
    if (Number.isFinite(selfId) && selfId > 0) {
      parsed.supervisor_ids = [selfId];
    }
  }
}

/**
 * Access «Сотрудники»: operator-like / supervisor uchun dashboard agent_ids ni bound doirasiga majburlaydi.
 */
export async function applyAccessAgentIdsScope(
  tenantId: number,
  accessUser: { role: string; sub: string },
  parsed: { agent_ids?: number[] }
): Promise<void> {
  const role = accessUser.role ?? "";
  if (role === "admin") return;
  if (!(role === "supervisor" || role === "agent" || isOperatorLikeWebRole(role))) return;
  const userId = Number.parseInt(accessUser.sub, 10);
  if (!Number.isFinite(userId) || userId < 1) return;
  const actor = await enrichScopedReportActor(tenantId, { userId, role });
  const hit = intersectRequestedAgentIds(parsed.agent_ids, actor);
  if (hit.restricted) {
    parsed.agent_ids = hit.agentIds;
  }
}

export function applySalesMonitoringSupervisorScope(
  accessUser: { role: string; sub: string },
  parsed: { supervisor_ids?: number[] }
) {
  if (accessUser.role === "supervisor") {
    const selfId = Number.parseInt(accessUser.sub, 10);
    if (Number.isFinite(selfId) && selfId > 0) {
      parsed.supervisor_ids = [selfId];
    }
  }
}
