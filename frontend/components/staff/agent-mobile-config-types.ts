/** Mirrors backend `AgentMobileConfigV1` (schema_version: 1). */

export const AGENT_MOBILE_SCHEMA_VERSION = 1 as const;

export type AgentMobileConfigDraft = {
  schema_version: typeof AGENT_MOBILE_SCHEMA_VERSION;
  client?: {
    can_edit?: boolean;
    can_create?: boolean;
    require_new_client_approval?: boolean;
    show_balance?: boolean;
    show_photos?: boolean;
    phone_prefix?: string;
    fields_visible?: Record<string, boolean>;
    fields_required?: Record<string, boolean>;
    can_change_client_location?: boolean;
  };
  gps?: {
    min_battery_pct?: number | null;
    always_on?: boolean;
    required_for_order?: boolean;
    internet_required_for_order?: boolean;
    internet_always_on?: boolean;
    tracking_enabled?: boolean;
    tracking_interval_sec?: number | null;
    min_distance_m?: number | null;
    max_accuracy_m?: number | null;
  };
  outlet?: { show_plan_in_reports?: boolean; plan_version?: string };
  product_list?: { show_out_of_stock?: boolean; allow_submit_for_new_client?: boolean };
  photo?: {
    max_width_px?: number | null;
    max_height_px?: number | null;
    jpeg_quality?: number | null;
    required_for_order?: boolean;
  };
  misc?: {
    visit_start_end_enabled?: boolean;
    require_within_outlet_radius_m?: number | null;
    require_stock_snapshot_for_order?: boolean;
    require_shipment_date?: boolean;
    allow_exchange_request?: boolean;
    disallowed_payment_method_codes?: string[];
    qr_attach_visit_page?: boolean;
    qr_change_visit_page?: boolean;
    qr_attach_client_page?: boolean;
    qr_change_client_page?: boolean;
  };
  sync?: {
    mandatory_sync_count?: number | null;
    block_sync?: boolean;
    allowed_window_from?: string;
    allowed_window_to?: string;
  };
  orders?: {
    consignment_payment_due_rule?: string;
    bonus_fill_mode?: string;
    allow_return_from_shelf?: boolean;
    allow_partial_return_edit?: boolean;
    allow_reload_from_vehicle?: boolean;
  };
  expeditor?: {
    accept_payment_for_order?: boolean;
    accept_payment_on_delivery?: boolean;
    accept_payment_from_debtors?: boolean;
    currency_symbol?: string;
    allowed_payment_method_ids?: string[];
    allowed_trade_direction_ids?: number[];
    delivery_payment_method_strict?: boolean;
    fingerprint_required_for_shipment_confirm?: boolean;
  };
  supervision?: {
    check_receipt_faces?: boolean;
    check_merchandising?: boolean;
    check_default_price?: boolean;
    check_motivation?: boolean;
    check_stock?: boolean;
    check_sales?: boolean;
  };
  van_selling?: {
    payment_acceptance_method_ids?: string[];
    payment_required?: boolean;
    allow_order_while_moving?: boolean;
    allow_change_movement_status?: boolean;
  };
};

export const CLIENT_FIELD_META: { key: string; label: string }[] = [
  { key: "name", label: "Имя клиента" },
  { key: "legal_name", label: "Название компании клиента" },
  { key: "category", label: "Клиентская категория" },
  { key: "client_type", label: "Тип клиента" },
  { key: "sales_channel", label: "Клиентский канал продаж" },
  { key: "territory", label: "Территория клиента" },
  { key: "inn", label: "Клиент ИНН" },
  { key: "phone", label: "Клиентский телефон" },
  { key: "visit_day", label: "День посещения клиента" },
  { key: "coordinates", label: "Клиентские координаты" },
  { key: "client_pc", label: "Клиент ПК" },
  { key: "bank", label: "Клиентский банк" },
  { key: "mfo", label: "Клиент МФО" },
  { key: "oked", label: "Клиент ОКЭД" },
  { key: "pinfl", label: "Клиент ПИНФЛ" },
  { key: "agreement_number", label: "Клиентское соглашение номер" }
];

export function emptyMobileDraft(): AgentMobileConfigDraft {
  return { schema_version: AGENT_MOBILE_SCHEMA_VERSION };
}

export function cloneMobileFromRow(raw: unknown): AgentMobileConfigDraft {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return emptyMobileDraft();
  const mc = (raw as Record<string, unknown>).mobile_config;
  if (mc == null || typeof mc !== "object" || Array.isArray(mc)) return emptyMobileDraft();
  const o = mc as Record<string, unknown>;
  if (o.schema_version !== 1 && o.schema_version !== "1") return emptyMobileDraft();
  return JSON.parse(JSON.stringify(mc)) as AgentMobileConfigDraft;
}
