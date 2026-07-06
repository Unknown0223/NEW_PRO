import { MOBILE_ONLY_KOMANDA_ROLES } from "../../lib/tenant-user-roles";
import { AUTO_CHAIN_ROLES_ABOVE_SUPERVISOR } from "./plans.setup.roles";

/** «Главные утверждающие» — direktorlar, admin va savdo menejerlari. */
export const APPROVER_LEADER_ROLES = [
  "director",
  "sales_director",
  "commercial_director",
  "admin",
  "manager",
  "regional_manager"
] as const;

/** «Степень N» — veb-paneldagi savdo menejerlari (agent va mobil-only emas). */
export const APPROVER_LEVEL_ROLES = [
  ...AUTO_CHAIN_ROLES_ABOVE_SUPERVISOR,
  "admin",
  "operator",
  "regional_manager"
] as const;

const leaderSet = new Set<string>(APPROVER_LEADER_ROLES);
const levelSet = new Set<string>(APPROVER_LEVEL_ROLES);
const mobileOnlySet = new Set<string>(MOBILE_ONLY_KOMANDA_ROLES);

export function isApproverLeaderRole(role: string): boolean {
  return leaderSet.has(role.trim());
}

export function isApproverLevelRole(role: string): boolean {
  const r = role.trim();
  if (mobileOnlySet.has(r) || r === "agent" || r === "supervisor") return false;
  return levelSet.has(r);
}
