import type {
  CurrencyEntryDto,
  PaymentMethodEntryDto,
  PriceTypeEntryDto
} from "./finance-refs";

export type TerritoryNodeDto = {
  id: string;
  name: string;
  code?: string | null;
  comment?: string | null;
  sort_order?: number | null;
  active?: boolean;
  children: TerritoryNodeDto[];
};

export type UnitMeasureDto = {
  id: string;
  name: string;
  title?: string | null;
  code?: string | null;
  sort_order?: number | null;
  comment?: string | null;
  active?: boolean;
};

export type ClientRefEntryDto = {
  id: string;
  name: string;
  code: string | null;
  sort_order: number | null;
  comment: string | null;
  active: boolean;
  color: string | null;
};

export type BranchDto = {
  id: string;
  name: string;
  code?: string | null;
  sort_order?: number | null;
  comment?: string | null;
  active?: boolean;
  /** Bir nechta viloyat / hudud (nomlar) */
  territories?: string[];
  /** Bir nechta shahar (nomlar) */
  cities?: string[];
  /** Bir nechta kassa ID */
  cash_desk_ids?: number[];
  /** Orqaga moslik: birinchi territoriya */
  territory?: string | null;
  /** Orqaga moslik: birinchi shahar */
  city?: string | null;
  cashbox?: string | null;
  /** Filial uchun asosiy kassa (`cash_desks.id`) — birinchi ID */
  cash_desk_id?: number | null;
  user_links?: {
    role: string;
    user_ids: number[];
  }[];
};

/** Filialga bog‘langan barcha kassa ID (takrorlarsiz). */
export function branchCashDeskIds(b: Pick<BranchDto, "cash_desk_id" | "cash_desk_ids">): number[] {
  const out: number[] = [];
  if (b.cash_desk_id != null && b.cash_desk_id > 0) out.push(b.cash_desk_id);
  for (const id of b.cash_desk_ids ?? []) {
    if (typeof id === "number" && Number.isInteger(id) && id > 0) out.push(id);
  }
  return [...new Set(out)];
}

export type TenantProfileDto = {
  name: string;
  phone: string | null;
  address: string | null;
  logo_url: string | null;
  feature_flags: Record<string, unknown>;
  references: {
    payment_types: string[];
    return_reasons: string[];
    regions: string[];
    /** Mijoz kartochkasi — spravochnikdan tanlanadigan qiymatlar */
    client_categories: string[];
    client_type_codes: string[];
    client_formats: string[];
    client_format_entries: ClientRefEntryDto[];
    client_type_entries: ClientRefEntryDto[];
    client_category_entries: ClientRefEntryDto[];
    sales_channels: string[];
    /** Spravochnik + JSON; agent «Направление торговли» uchun */
    trade_directions: string[];
    client_product_category_refs: string[];
    /** Manzil / logistika — mijoz kartasida tanlanadi, shu yerda yaratiladi */
    client_districts: string[];
    client_cities: string[];
    client_neighborhoods: string[];
    client_zones: string[];
    client_logistics_services: string[];
    territory_levels: string[];
    /** Ierarxik territoriya daraxti (asosiy manba) */
    territory_nodes: TerritoryNodeDto[];
    unit_measures: UnitMeasureDto[];
    branches: BranchDto[];
    /** Eski format — faqat migratsiya / orqaga moslik */
    territory_tree: { zone: string; region: string; cities: string[] }[];
    currency_entries: CurrencyEntryDto[];
    payment_method_entries: PaymentMethodEntryDto[];
    price_type_entries: PriceTypeEntryDto[];
    /** Sozlamalar → «Причины и категории» (jadval + tanlovlar) */
    request_type_entries: ClientRefEntryDto[];
    refusal_reason_entries: ClientRefEntryDto[];
    cancel_payment_reason_entries: ClientRefEntryDto[];
    order_note_entries: ClientRefEntryDto[];
    task_type_entries: ClientRefEntryDto[];
    photo_category_entries: ClientRefEntryDto[];
    finance_category_entries: ClientRefEntryDto[];
  };
};
