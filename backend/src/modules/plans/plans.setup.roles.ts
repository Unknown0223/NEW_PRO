/** Reja qiymatini kiritish huquqi — daraxtdagi barcha xodimlar (agentlar ham). */
export const PLAN_SETTER_ROLES = new Set([
  "supervisor",
  "manager",
  "director",
  "sales_director",
  "commercial_director",
  "admin",
  "operator",
  "regional_manager",
  "agent"
]);

export function canRoleSetPlan(role: string): boolean {
  return PLAN_SETTER_ROLES.has(role.trim());
}

/** SVR dan yuqori avtomatik zanjir (kamroq raqam = yuqori). */
export const AUTO_CHAIN_ROLES_ABOVE_SUPERVISOR = [
  "manager",
  "sales_director",
  "commercial_director",
  "director"
] as const;

export function autoChainRoleRank(role: string): number {
  const idx = AUTO_CHAIN_ROLES_ABOVE_SUPERVISOR.indexOf(
    role as (typeof AUTO_CHAIN_ROLES_ABOVE_SUPERVISOR)[number]
  );
  return idx >= 0 ? idx : 99;
}

/** Reja tasdiqlash (KPI «Одобрить» / «Вернуть») — zanjirdagi rahbarlar. */
export const PLAN_APPROVER_ROLES = new Set([
  "supervisor",
  "manager",
  "regional_manager",
  "director",
  "sales_director",
  "commercial_director",
  "admin",
  "operator"
]);

export function canRoleApprovePlan(role: string): boolean {
  return PLAN_APPROVER_ROLES.has(role.trim());
}
