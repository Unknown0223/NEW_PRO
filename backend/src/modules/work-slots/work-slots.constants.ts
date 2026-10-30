/**
 * Ishchi o‘rni (`work_slots.slot_type`) — maydon, nazorat va Сотрудники web-rollari (admin emas).
 * Har bir tip ↔ User.role 1:1 (manager, director, … alohida joy).
 */

import { OPERATOR_LIKE_WEB_ROLES } from "../../lib/tenant-user-roles";

const FIELD_SLOT_TYPES = [
  "agent",
  "collector",
  "expeditor",
  "skladchik",
  "supervisor",
  "auditor"
] as const;

export const WORK_SLOT_TYPES = [...FIELD_SLOT_TYPES, ...OPERATOR_LIKE_WEB_ROLES] as const;

export type WorkSlotType = (typeof WORK_SLOT_TYPES)[number];

/** Smart-kod prefiksi */
export const SLOT_TYPE_CODE_PREFIX: Record<WorkSlotType, string> = {
  agent: "A",
  collector: "I",
  expeditor: "E",
  skladchik: "S",
  supervisor: "N",
  auditor: "U",
  operator: "O",
  director: "D",
  sales_director: "V",
  manager: "M",
  regional_manager: "R",
  accountant: "B",
  warehouse_manager: "W"
};

/** Asosiy User.role — tip bilan bir xil. */
export const SLOT_TYPE_TO_USER_ROLE: Record<WorkSlotType, string> = Object.fromEntries(
  WORK_SLOT_TYPES.map((t) => [t, t])
) as unknown as Record<WorkSlotType, string>;

/** Assign: slot tipiga ruxsat etilgan User.role lar (1:1). */
export const SLOT_TYPE_ALLOWED_USER_ROLES: Record<WorkSlotType, readonly string[]> =
  Object.fromEntries(WORK_SLOT_TYPES.map((t) => [t, [t]])) as unknown as Record<
    WorkSlotType,
    readonly string[]
  >;

export function isWorkSlotType(value: string): value is WorkSlotType {
  return (WORK_SLOT_TYPES as readonly string[]).includes(value);
}

export function isOperatorLikeSlotType(value: string): boolean {
  return (OPERATOR_LIKE_WEB_ROLES as readonly string[]).includes(value);
}

export function userRoleMatchesSlotType(userRole: string, slotType: string): boolean {
  if (!isWorkSlotType(slotType)) return false;
  return SLOT_TYPE_ALLOWED_USER_ROLES[slotType].includes(userRole);
}
