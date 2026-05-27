export type ClientRefusalListRow = {
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

export type ListClientRefusalsQuery = {
  page: number;
  limit: number;
  /** Yuqori chegara (oddiy ro‘yxat 100, eksport 10000) */
  max_limit?: number;
  date_from?: string;
  date_to?: string;
  agent_id?: number;
  refusal_reason_ref?: string;
  client_category?: string;
  zone?: string;
  region?: string;
  city?: string;
  search?: string;
  sort_by?: "created_at" | "client" | "agent" | "reason";
  sort_dir?: "asc" | "desc";
};

export type ClientRefusalFilterOptions = {
  agents: Array<{ id: number; code: string | null; name: string }>;
  reasons: Array<{ value: string; label: string }>;
  client_categories: string[];
  zones: string[];
  regions: string[];
  cities: string[];
};
