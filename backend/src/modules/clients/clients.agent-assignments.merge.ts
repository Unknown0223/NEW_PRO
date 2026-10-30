import { type AgentAssignmentPatch, parseVisitWeekdaysJson } from "./clients.types";

export type ExistingAssignmentRow = {
  slot: number;
  agent_id: number | null;
  visit_date: Date | null;
  expeditor_phone: string | null;
  expeditor_user_id: number | null;
  visit_weekdays: unknown;
};

/**
 * Merge rejimi (xarita / ommaviy biriktirish): yuborilgan slotlarda faqat berilgan maydonlar
 * almashtiriladi, qolgan maydonlar va boshqa slotlar mavjud qiymatida qoladi.
 */
export function mergeAgentAssignmentPatches(
  existing: readonly ExistingAssignmentRow[],
  patches: readonly AgentAssignmentPatch[]
): AgentAssignmentPatch[] {
  const bySlot = new Map<number, AgentAssignmentPatch>(
    existing.map((r) => [
      r.slot,
      {
        slot: r.slot,
        agent_id: r.agent_id,
        visit_date: r.visit_date ? r.visit_date.toISOString() : null,
        expeditor_phone: r.expeditor_phone,
        expeditor_user_id: r.expeditor_user_id,
        visit_weekdays: parseVisitWeekdaysJson(r.visit_weekdays)
      }
    ])
  );
  for (const p of patches) {
    const slot = Math.floor(Number(p.slot));
    const next: AgentAssignmentPatch = { ...(bySlot.get(slot) ?? { slot }) };
    for (const [field, value] of Object.entries(p)) {
      if (value !== undefined && field !== "slot") (next as Record<string, unknown>)[field] = value;
    }
    bySlot.set(slot, next);
  }
  return [...bySlot.values()].sort((a, b) => a.slot - b.slot);
}
