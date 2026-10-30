import { parseVisitWeekdaysJson } from "../clients/clients.types";

export type SyncAssignmentHint = {
  visit_weekdays: unknown;
  visit_date?: Date | string | null;
  agent_id?: number | null;
  work_slot_id?: number | null;
};

export type SyncClientVisitPlan = {
  weekdays: number[];
  visitDate: string | null;
};

function isoDate(raw: Date | string | null | undefined): string | null {
  if (raw == null) return null;
  if (raw instanceof Date) {
    return Number.isNaN(raw.getTime()) ? null : raw.toISOString();
  }
  const s = String(raw).trim();
  return s.length > 0 ? s : null;
}

function assignmentMatchesAgent(
  a: SyncAssignmentHint,
  agentId?: number,
  workSlotId?: number | null
): boolean {
  if (agentId != null && a.agent_id === agentId) return true;
  if (workSlotId != null && workSlotId > 0 && a.work_slot_id === workSlotId) return true;
  return false;
}

/** Joriy agent/slot assignment kunlari — bo‘sh [] client.visit_weekdays ni yutib yubormasin. */
export function resolveSyncClientVisitPlan(
  assignments: SyncAssignmentHint[] | undefined,
  clientVisitWeekdays: unknown,
  opts?: { agentId?: number; workSlotId?: number | null }
): SyncClientVisitPlan {
  const list = assignments ?? [];
  const mine = list.filter((a) => assignmentMatchesAgent(a, opts?.agentId, opts?.workSlotId));
  const pool = mine.length > 0 ? mine : list;

  const withDays =
    pool.find((a) => parseVisitWeekdaysJson(a.visit_weekdays).length > 0) ??
    list.find((a) => parseVisitWeekdaysJson(a.visit_weekdays).length > 0);

  const assignment = withDays ?? pool[0] ?? list[0];
  const fromAssignment = parseVisitWeekdaysJson(assignment?.visit_weekdays);
  const weekdays =
    fromAssignment.length > 0 ? fromAssignment : parseVisitWeekdaysJson(clientVisitWeekdays);

  const visitDate = isoDate(assignment?.visit_date);
  return { weekdays, visitDate };
}
