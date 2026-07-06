import type { ClientRow } from "@/lib/client-types";

export const CLIENT_MAP_WEEKDAYS: { value: number; label: string }[] = [
  { value: 1, label: "Пн" },
  { value: 2, label: "Вт" },
  { value: 3, label: "Ср" },
  { value: 4, label: "Чт" },
  { value: 5, label: "Пт" },
  { value: 6, label: "Сб" },
  { value: 7, label: "Вс" }
];

export type ClientMapFiltersState = {
  visitWeekdays: number[];
  agentIds: number[];
  categories: string[];
  clientTypes: string[];
  status: "all" | "active" | "inactive";
  equipment: "all" | "with" | "without";
  zones: string[];
  regions: string[];
  cities: string[];
};

export const INITIAL_CLIENT_MAP_FILTERS: ClientMapFiltersState = {
  visitWeekdays: [],
  agentIds: [],
  categories: [],
  clientTypes: [],
  status: "all",
  equipment: "all",
  zones: [],
  regions: [],
  cities: []
};

function norm(v: string | null | undefined): string {
  return (v ?? "").trim().toLowerCase();
}

export function clientVisitWeekdays(c: ClientRow): number[] {
  const set = new Set<number>();
  for (const a of c.agent_assignments ?? []) {
    for (const d of a.visit_weekdays ?? []) {
      if (d >= 1 && d <= 7) set.add(d);
    }
  }
  return [...set];
}

export function clientHasActiveEquipment(c: ClientRow): boolean {
  const n = c.active_equipment_count;
  if (typeof n === "number") return n > 0;
  return false;
}

function territoryMatch(
  raw: string | null | undefined,
  selected: string,
  labelByValue: Record<string, string>
): boolean {
  if (!selected) return true;
  const rawNorm = norm(raw);
  const selectedNorm = norm(selected);
  const rawLabelNorm = norm(labelByValue[raw ?? ""] ?? raw);
  const selectedLabelNorm = norm(labelByValue[selected] ?? selected);
  return rawNorm === selectedNorm || rawLabelNorm === selectedLabelNorm;
}

export function applyClientMapFilters(
  clients: ClientRow[],
  filters: ClientMapFiltersState,
  opts: {
    regionLabelByValue: Record<string, string>;
    cityLabelByValue: Record<string, string>;
    search?: string;
  }
): ClientRow[] {
  const q = opts.search?.trim().toLowerCase() ?? "";
  return clients.filter((c) => {
    if (filters.visitWeekdays.length > 0) {
      const wd = clientVisitWeekdays(c);
      if (!filters.visitWeekdays.some((d) => wd.includes(d))) return false;
    }
    if (filters.agentIds.length > 0) {
      if (c.agent_id == null || !filters.agentIds.includes(c.agent_id)) return false;
    }
    if (filters.categories.length > 0) {
      const cat = (c.category ?? "").trim();
      if (!cat || !filters.categories.includes(cat)) return false;
    }
    if (filters.clientTypes.length > 0) {
      const t = (c.client_type_code ?? "").trim();
      if (!t || !filters.clientTypes.includes(t)) return false;
    }
    if (filters.status === "active" && !c.is_active) return false;
    if (filters.status === "inactive" && c.is_active) return false;
    if (filters.equipment === "with" && !clientHasActiveEquipment(c)) return false;
    if (filters.equipment === "without" && clientHasActiveEquipment(c)) return false;
    if (filters.zones.length > 0) {
      const z = (c.zone ?? "").trim();
      if (!z || !filters.zones.some((sel) => territoryMatch(z, sel, {}))) return false;
    }
    if (filters.regions.length > 0) {
      if (!filters.regions.some((sel) => territoryMatch(c.region, sel, opts.regionLabelByValue))) return false;
    }
    if (filters.cities.length > 0) {
      if (!filters.cities.some((sel) => territoryMatch(c.city, sel, opts.cityLabelByValue))) return false;
    }
    if (q) {
      const hit =
        c.name.toLowerCase().includes(q) ||
        (c.address && c.address.toLowerCase().includes(q)) ||
        (c.region && c.region.toLowerCase().includes(q)) ||
        (c.district && c.district.toLowerCase().includes(q)) ||
        (c.city && c.city.toLowerCase().includes(q)) ||
        (c.landmark && c.landmark.toLowerCase().includes(q));
      if (!hit) return false;
    }
    return true;
  });
}

export function computeCategoryCounts(clients: ClientRow[]): Array<{ category: string; count: number }> {
  const m = new Map<string, number>();
  for (const c of clients) {
    const cat = (c.category ?? "").trim() || "—";
    m.set(cat, (m.get(cat) ?? 0) + 1);
  }
  return [...m.entries()]
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count || a.category.localeCompare(b.category, "ru"));
}
