/**
 * Ishchi o‘rni (`work_slots.slot_type`) — maydon xodimlari va nazorat rollari.
 * `User.role` bilan 1:1 mos (assign tekshiruvi).
 */
export const WORK_SLOT_TYPES = [
  "agent",
  "collector",
  "expeditor",
  "skladchik",
  "supervisor",
  "auditor"
] as const;

export type WorkSlotType = (typeof WORK_SLOT_TYPES)[number];

/** Smart-kod prefiksi: `N-MAIN-001` */
export const SLOT_TYPE_CODE_PREFIX: Record<WorkSlotType, string> = {
  agent: "A",
  collector: "I",
  expeditor: "E",
  skladchik: "S",
  supervisor: "N",
  auditor: "U"
};

export const SLOT_TYPE_TO_USER_ROLE: Record<WorkSlotType, string> = {
  agent: "agent",
  collector: "collector",
  expeditor: "expeditor",
  skladchik: "skladchik",
  supervisor: "supervisor",
  auditor: "auditor"
};

export function isWorkSlotType(value: string): value is WorkSlotType {
  return (WORK_SLOT_TYPES as readonly string[]).includes(value);
}
