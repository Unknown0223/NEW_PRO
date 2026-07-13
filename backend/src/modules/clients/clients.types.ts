import type { CityTerritoryHintDto } from "../tenant-settings/tenant-settings.service";

/** Telefonni solishtirish uchun faqat raqamlar (masalan +998 90 → 99890). */
export function normalizePhoneDigits(phone: string | null | undefined): string | null {
  if (phone == null) return null;
  const d = phone.replace(/\D/g, "");
  return d.length > 0 ? d : null;
}

export type ContactPersonSlot = {
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
};

export type ClientAgentAssignmentApi = {
  id?: number;
  slot: number;
  agent_id: number | null;
  agent_name: string | null;
  /** Agent `User.code` (masalan GGTR006) */
  agent_code: string | null;
  visit_date: string | null;
  expeditor_phone: string | null;
  /** 1=Du … 7=Ya */
  visit_weekdays: number[];
  expeditor_user_id: number | null;
  expeditor_name: string | null;
  lock_type: string;
  lock_reason: string | null;
  auto_assign_status: string;
  work_slot_id: number | null;
  work_slot_code: string | null;
};

export type ClientListRow = {
  id: number;
  name: string;
  legal_name: string | null;
  phone: string | null;
  address: string | null;
  category: string | null;
  client_type_code: string | null;
  credit_limit: string;
  is_active: boolean;
  /** Hisob saldo (qarzdorlik ko‘rsatkichi) */
  account_balance: string;
  responsible_person: string | null;
  landmark: string | null;
  inn: string | null;
  pdl: string | null;
  logistics_service: string | null;
  license_until: string | null;
  working_hours: string | null;
  region: string | null;
  district: string | null;
  city: string | null;
  neighborhood: string | null;
  street: string | null;
  house_number: string | null;
  apartment: string | null;
  gps_text: string | null;
  visit_date: string | null;
  notes: string | null;
  client_format: string | null;
  client_code: string | null;
  sales_channel: string | null;
  product_category_ref: string | null;
  bank_name: string | null;
  bank_account: string | null;
  bank_mfo: string | null;
  client_pinfl: string | null;
  oked: string | null;
  contract_number: string | null;
  vat_reg_code: string | null;
  latitude: string | null;
  longitude: string | null;
  zone: string | null;
  warehouse_id: number | null;
  warehouse_name: string | null;
  cash_desk_id: number | null;
  cash_desk_name: string | null;
  agent_id: number | null;
  agent_name: string | null;
  agent_assignments: ClientAgentAssignmentApi[];
  contact_persons: ContactPersonSlot[];
  created_at: string;
  active_equipment_count?: number;
  price_type: string | null;
  allow_order_with_debt: boolean;
  allow_consignment: boolean;
  allow_consignment_with_debt: boolean;
  tags: Array<{ id: number; name: string }>;
};

export type ListClientsQuery = {
  page: number;
  limit: number;
  /** Faqat shu client id ro‘yxati (scope/kontekst kesimi) */
  client_ids?: number[];
  search?: string;
  is_active?: boolean;
  category?: string;
  region?: string;
  district?: string;
  neighborhood?: string;
  zone?: string;
  /** Bir nechta zona (OR) */
  zones?: string[];
  /** Shahar (kod yoki nom) — aniq moslik */
  city?: string;
  client_type_code?: string;
  client_format?: string;
  sales_channel?: string;
  /** Asosiy `agent_id` yoki istalgan jamoa qatoridagi agent */
  agent_id?: number;
  /** Bir nechta agent (OR) */
  agent_ids?: number[];
  /** Jamoa qatoridagi ekspeditor foydalanuvchi */
  expeditor_user_id?: number;
  expeditor_user_ids?: number[];
  /** 1=Du … 7=Ya — istalgan jamoa qatorida shu kun tanlangan mijozlar */
  visit_weekday?: number;
  visit_weekdays?: number[];
  /** INN qismiy moslik */
  inn?: string;
  /** Telefon qismiy moslik */
  phone?: string;
  /** ПИНФЛ / JSHSHIR qismiy moslik */
  client_pinfl?: string;
  /** Faol inventar (olib tashlanmagan) qatori bor mijozlar */
  has_active_equipment?: boolean;
  /** Faol inventarda `equipment_kind` yoki `inventory_type` dan biriga mos (contains, case-insensitive) */
  equipment_kind?: string;
  /** `credit_limit` > 0 */
  has_credit?: boolean;
  /** Asosiy yoki slot agenti `User.consignment === true` */
  agent_consignment?: "yes" | "no";
  /** Asosiy yoki slot agentida `consignment_limit_amount` berilgan */
  agent_consignment_limited?: "yes" | "no";
  /** YYYY-MM-DD — `created_at` dan katta yoki teng */
  created_from?: string;
  /** YYYY-MM-DD — `created_at` kichik yoki teng (kun oxirigacha) */
  created_to?: string;
  /** Asosiy agent yoki jamoa qatoridagi agentning `supervisor_user_id` */
  supervisor_user_id?: number;
  supervisor_user_ids?: number[];
  /** INN mavjudligi */
  has_inn?: boolean;
  /** Telefon mavjudligi */
  has_phone?: boolean;
  sort?:
    | "name"
    | "phone"
    | "id"
    | "created_at"
    | "region"
    | "legal_name"
    | "address"
    | "responsible_person"
    | "landmark"
    | "inn"
    | "client_pinfl"
    | "sales_channel"
    | "category"
    | "client_type_code"
    | "client_format"
    | "district"
    | "neighborhood"
    | "zone"
    | "city"
    | "client_code"
    | "latitude"
    | "longitude";
  order?: "asc" | "desc";
  /** Faqat kenglik/uzunligi bor yozuvlar (xarita) */
  has_coords?: boolean;
  /** GPS koordinatasi yo‘q yozuvlar */
  missing_coords?: boolean;
  /** Teg bo‘yicha filtr */
  tag_id?: number;
  price_type?: string;
  allow_order_with_debt?: boolean;
};


export type ClientRefOptionDto = { value: string; label: string };

export type ClientReferences = {
  categories: string[];
  client_type_codes: string[];
  regions: string[];
  districts: string[];
  cities: string[];
  neighborhoods: string[];
  zones: string[];
  client_formats: string[];
  sales_channels: string[];
  product_category_refs: string[];
  logistics_services: string[];
  /** Faol inventar bo‘yicha noyob `equipment_kind` / `inventory_type` qiymatlari (filtr select). */
  equipment_filter_values: string[];
  /** UI: `label` — nom, `value` — DB / filtrda saqlanadigan qiymat (odatda kod). */
  category_options: ClientRefOptionDto[];
  client_type_options: ClientRefOptionDto[];
  client_format_options: ClientRefOptionDto[];
  sales_channel_options: ClientRefOptionDto[];
  city_options: ClientRefOptionDto[];
  /** Hudud daraxti: kod/saqlangan qiymat → ko‘rinadigan nom */
  region_options: ClientRefOptionDto[];
  /** Shahar qiymati (kod yoki nom) → daraxtdan viloyat va zona */
  city_territory_hints: Record<string, CityTerritoryHintDto>;
};

/** JSON / massivdan 1..7 (Du..Ya) butun sonlarni ajratadi */
export function parseVisitWeekdaysJson(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [];
  const out: number[] = [];
  for (const x of raw) {
    const n = typeof x === "number" ? x : Number.parseInt(String(x), 10);
    if (Number.isFinite(n) && n >= 1 && n <= 7) out.push(n);
  }
  return [...new Set(out)].sort((a, b) => a - b);
}
export type AgentAssignmentPatch = {
  slot: number;
  agent_id?: number | null;
  visit_date?: string | null;
  expeditor_phone?: string | null;
  expeditor_user_id?: number | null;
  visit_weekdays?: number[];
};
