import { ADMIN_AND_OPERATOR_LIKE_ROLES } from "../../lib/tenant-user-roles";
import { getAccessUser, jwtAccessVerify, requireAnyPermission, requireRoles } from "../auth/auth.prehandlers";

export const catalogRoles = [...ADMIN_AND_OPERATOR_LIKE_ROLES, "supervisor"] as const;

/** Yangi kalit + legacy «Дашбоард» bo‘limlari (`legacy-permissions.generated.ts`) — rolda ruxsat bo‘lmasa 403. */
export const DASHBOARD_ANY_LEGACY = [
  "dashboard.view",
  "dashboard.prodazhi",
  "dashboard.finansy",
  "dashboard.supervayzer",
  "dashboard.plan_fakt"
] as const;

export const dashboardStatsPreHandler = [
  jwtAccessVerify,
  requireRoles(...catalogRoles),
  requireAnyPermission([...DASHBOARD_ANY_LEGACY])
];
export const dashboardSupervisorPreHandler = [
  jwtAccessVerify,
  requireRoles(...catalogRoles),
  requireAnyPermission(["dashboard.view", "dashboard.supervayzer"])
];
export const dashboardFinancePreHandler = [
  jwtAccessVerify,
  requireRoles(...catalogRoles),
  requireAnyPermission(["dashboard.view", "dashboard.finansy"])
];
export const dashboardSalesPreHandler = [
  jwtAccessVerify,
  requireRoles(...catalogRoles),
  requireAnyPermission(["dashboard.view", "dashboard.prodazhi"])
];
export const dashboardSalesMonitoringPreHandler = [
  jwtAccessVerify,
  requireRoles(...catalogRoles),
  requireAnyPermission(["dashboard.view", "dashboard.plan_fakt", "dashboard.prodazhi"])
];

export const dashboardMetaPreHandler = [
  jwtAccessVerify,
  requireRoles(...catalogRoles),
  requireAnyPermission([...DASHBOARD_ANY_LEGACY])
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
