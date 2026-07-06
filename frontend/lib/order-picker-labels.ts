/**
 * Zakaz / dashboard tanlovlari: ko‘rinishda faqat FIO (nom), qidiruvda id, login, kod.
 */

import { formatPersonDisplayName, staffPickerDisplayName, staffPickerSearchText } from "@/lib/person-display";

export function orderAgentFilterOption(u: { id: number; name: string; login: string }) {
  const label = (u.name ?? "").trim() || (u.login ?? "").trim();
  return {
    value: String(u.id),
    label,
    searchText: [String(u.id), u.login, u.name].filter((x) => String(x).trim()).join(" ")
  };
}

export function orderExpeditorFilterOption(r: { id: number; fio: string; login: string }) {
  const label = staffPickerDisplayName(r);
  return {
    value: String(r.id),
    label,
    searchText: staffPickerSearchText(r)
  };
}

/** Zakaz forma klienti: ko‘rinishda faqat nom (agent tanlovi bilan bir xil); qidiruv serverda. */
export function orderClientPickerDisplayName(c: { id: number; name: string }) {
  const n = (c.name ?? "").trim();
  return n || `Клиент #${c.id}`;
}

export function staffDashboardMultiItem(s: {
  id: number;
  fio: string;
  first_name?: string | null;
  last_name?: string | null;
  middle_name?: string | null;
  code?: string | null;
  login?: string | null;
}) {
  return {
    id: String(s.id),
    title: staffPickerDisplayName(s),
    searchText: staffPickerSearchText(s)
  };
}

export { formatPersonDisplayName };
