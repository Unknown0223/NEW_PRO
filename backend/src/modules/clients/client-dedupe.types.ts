export type DuplicateTab = "fields" | "geo";

export type ClientDedupePreviewDto = {
  id: number;
  name: string;
  legal_name: string | null;
  phone: string | null;
  inn: string | null;
  client_pinfl: string | null;
  contract_number: string | null;
  address: string | null;
  zone: string | null;
  region: string | null;
  city: string | null;
  category: string | null;
  landmark: string | null;
  client_code: string | null;
  is_active: boolean;
  latitude: string | null;
  longitude: string | null;
  updated_at: string;
  balance: string | null;
  /** Advanced merge panel — savdo / rekvizitlar */
  sales_channel: string | null;
  client_format: string | null;
  client_type_code: string | null;
  responsible_person: string | null;
  bank_name: string | null;
  bank_account: string | null;
  bank_mfo: string | null;
  oked: string | null;
  vat_reg_code: string | null;
  notes: string | null;
  credit_limit: string | null;
  product_category_ref: string | null;
  contact_summary: string | null;
  orders_total: number;
  orders_open: number;
  orders_cancelled: number;
  orders_bonus_sum: string | null;
  equipment_count: number;
  team_lines: string[];
};

export type DuplicateGroupDto = {
  reason: "phone" | "name" | "geo";
  score: number;
  key: string;
  client_ids: number[];
  count: number;
  previews: ClientDedupePreviewDto[];
};

export type DuplicateCandidatesQuery = {
  tab: DuplicateTab;
  page?: number;
  limit?: number;
  agent_id?: number;
  zone?: string;
  region?: string;
  city?: string;
  client_format?: string;
  category?: string;
  /** Bir nechta tip (IN) */
  client_type_codes?: string[];
  is_active?: "all" | "yes" | "no";
  search?: string;
  /** Qaysi ustunlarda qidirish: name, legal_name, phone, inn, pinfl, contract, address */
  search_fields?: string[];
  geo_radius_m?: number;
};
