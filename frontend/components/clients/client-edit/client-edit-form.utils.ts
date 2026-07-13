import type { ClientRow } from "@/lib/client-types";

export type ClientDetailApi = ClientRow & {
  phone_normalized?: string | null;
  open_orders_total?: string;
  delivered_unpaid_total?: string;
};

export function isoToDateInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

export function dateInputToIso(s: string): string | null {
  const t = s.trim();
  if (!t) return null;
  const d = new Date(t + "T12:00:00");
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

/** API: `0` yoki qisqa PINFL placeholder → `null`; 14 raqam → saqlanadi. */
export function pinflForApi(raw: string): string | null {
  const pf = raw.replace(/\D/g, "");
  if (!pf || /^0+$/.test(pf)) return null;
  if (pf.length === 14) return pf;
  if (pf.length > 0 && pf.length < 14) {
    throw new Error("ПИНФЛ должен содержать 14 цифр или оставаться пустым");
  }
  return pf.slice(0, 20);
}

export const VISIT_DAYS: { k: number; l: string }[] = [
  { k: 1, l: "Пн" },
  { k: 2, l: "Вт" },
  { k: 3, l: "Ср" },
  { k: 4, l: "Чт" },
  { k: 5, l: "Пт" },
  { k: 6, l: "Сб" },
  { k: 7, l: "Вс" }
];

export const MAX_TEAM_ROWS = 10;
export const MAP_DEFAULT_LAT = 41.311081;
export const MAP_DEFAULT_LON = 69.279737;

export type AgentSlotForm = {
  agentId: string;
  expeditorUserId: string;
  weekdays: number[];
  /** UI da ko‘rinmaydi — mavjud yozuvni saqlash uchun */
  legacyVisitDate: string;
  legacyExpeditorPhone: string;
};

export function emptyAgentSlot(): AgentSlotForm {
  return { agentId: "", expeditorUserId: "", weekdays: [], legacyVisitDate: "", legacyExpeditorPhone: "" };
}

export function assignmentRowHasData(a: ClientRow["agent_assignments"][number]): boolean {
  const wd = Array.isArray(a.visit_weekdays) ? a.visit_weekdays.filter((x) => x >= 1 && x <= 7) : [];
  return (
    a.agent_id != null ||
    a.expeditor_user_id != null ||
    wd.length > 0 ||
    (a.visit_date != null && String(a.visit_date).trim() !== "") ||
    (a.expeditor_phone != null && a.expeditor_phone.trim() !== "")
  );
}

export function buildAgentSlots(client: ClientRow): AgentSlotForm[] {
  const list = client.agent_assignments;
  const rows: AgentSlotForm[] = [];
  if (Array.isArray(list) && list.length > 0) {
    const sorted = [...list].sort((a, b) => a.slot - b.slot);
    for (const a of sorted) {
      if (!assignmentRowHasData(a)) continue;
      const wd = Array.isArray(a.visit_weekdays) ? a.visit_weekdays.filter((x) => x >= 1 && x <= 7) : [];
      rows.push({
        agentId: a.agent_id != null ? String(a.agent_id) : "",
        expeditorUserId: a.expeditor_user_id != null ? String(a.expeditor_user_id) : "",
        weekdays: wd,
        legacyVisitDate: isoToDateInput(a.visit_date),
        legacyExpeditorPhone: a.expeditor_phone ?? ""
      });
    }
  }
  if (rows.length === 0 && client.agent_id != null) {
    rows.push({
      agentId: String(client.agent_id),
      expeditorUserId: "",
      weekdays: [],
      legacyVisitDate: isoToDateInput(client.visit_date),
      legacyExpeditorPhone: ""
    });
  }
  return rows.length > 0 ? rows : [emptyAgentSlot()];
}

export function toggleWeekday(slot: AgentSlotForm, day: number): number[] {
  const set = new Set(slot.weekdays);
  if (set.has(day)) set.delete(day);
  else set.add(day);
  return Array.from(set).sort((a, b) => a - b);
}
