/**
 * Zakaz / dashboard tanlovlari: ko‘rinishda faqat FIO (nom), qidiruvda id, login, kod.
 */

export function orderAgentFilterOption(u: { id: number; name: string; login: string }) {
  const label = (u.name ?? "").trim() || (u.login ?? "").trim();
  return {
    value: String(u.id),
    label,
    searchText: [String(u.id), u.login, u.name].filter((x) => String(x).trim()).join(" ")
  };
}

export function orderExpeditorFilterOption(r: { id: number; fio: string; login: string }) {
  const label = (r.fio ?? "").trim() || (r.login ?? "").trim();
  return {
    value: String(r.id),
    label,
    searchText: [String(r.id), r.login, r.fio].filter((x) => String(x).trim()).join(" ")
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
  code?: string | null;
  login?: string | null;
}) {
  return {
    id: String(s.id),
    title: (s.fio ?? "").trim() || `ID ${s.id}`,
    searchText: [String(s.id), s.code, s.login, s.fio]
      .filter((x) => x != null && String(x).trim())
      .join(" ")
  };
}
