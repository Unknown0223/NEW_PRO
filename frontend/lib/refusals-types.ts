export type ClientRefusalRow = {
  id: number;
  client_id: number;
  client_name: string;
  agent_id: number;
  agent_code: string | null;
  agent_name: string;
  refusal_reason_ref: string;
  refusal_reason_label: string | null;
  territory: string | null;
  comment: string | null;
  created_at: string;
};

export type RefusalFiltersState = {
  dateFrom: string;
  dateTo: string;
  agent: string;
  reason: string;
  clientCategory: string;
  zone: string;
  region: string;
  city: string;
};

export type RefusalFilterOptions = {
  agents: Array<{ id: number; code: string | null; name: string }>;
  reasons: Array<{ value: string; label: string }>;
  client_categories: string[];
  zones: string[];
  regions: string[];
  cities: string[];
};

export type RefusalsListResponse = {
  data: ClientRefusalRow[];
  total: number;
  page: number;
  limit: number;
  stats_by_reason: Array<{ reason_ref: string; reason_label: string; count: number }>;
};

export function todayYmd(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function formatRefusalDate(iso: string): string {
  const d = iso.slice(0, 10);
  const [y, m, day] = d.split("-");
  if (!y || !m || !day) return iso;
  return `${day}.${m}.${y}`;
}

export function formatRefusalDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  } catch {
    return formatRefusalDate(iso);
  }
}
