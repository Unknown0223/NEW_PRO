/**
 * Agent field-sales policy (reference «Конфигурации» UI).
 * Stored at `User.agent_entitlements.mobile_config` with `schema_version: 1`.
 */

export const AGENT_MOBILE_CONFIG_SCHEMA_VERSION = 1 as const;

/** Keys for client field visibility / required (mobile form contract). */
export const CLIENT_FIELD_KEYS = [
  "name",
  "legal_name",
  "category",
  "client_type",
  "sales_channel",
  "territory",
  "inn",
  "phone",
  "visit_day",
  "coordinates",
  "client_pc",
  "bank",
  "mfo",
  "oked",
  "pinfl",
  "agreement_number"
] as const;

export type ClientFieldKey = (typeof CLIENT_FIELD_KEYS)[number];

export type AgentMobileClientConfig = {
  can_edit?: boolean;
  can_create?: boolean;
  require_new_client_approval?: boolean;
  show_balance?: boolean;
  show_photos?: boolean;
  phone_prefix?: string;
  fields_visible?: Partial<Record<ClientFieldKey, boolean>>;
  fields_required?: Partial<Record<ClientFieldKey, boolean>>;
  /** Экспедитор: разрешение менять координаты клиента в поле */
  can_change_client_location?: boolean;
};

export type AgentMobileGpsConfig = {
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

export type AgentMobileOutletConfig = {
  show_plan_in_reports?: boolean;
  plan_version?: string;
};

export type AgentMobileProductListConfig = {
  show_out_of_stock?: boolean;
  allow_submit_for_new_client?: boolean;
};

export type AgentMobilePhotoConfig = {
  max_width_px?: number | null;
  max_height_px?: number | null;
  jpeg_quality?: number | null;
  required_for_order?: boolean;
};

export type AgentMobileMiscConfig = {
  visit_start_end_enabled?: boolean;
  require_within_outlet_radius_m?: number | null;
  require_stock_snapshot_for_order?: boolean;
  require_shipment_date?: boolean;
  allow_exchange_request?: boolean;
  /** Payment method entry ids (tenant finance refs) blocked for this agent */
  disallowed_payment_method_codes?: string[];
  /** Супервайзер / мобильные: QR на странице визитов */
  qr_attach_visit_page?: boolean;
  qr_change_visit_page?: boolean;
  /** QR на странице клиента */
  qr_attach_client_page?: boolean;
  qr_change_client_page?: boolean;
};

export type AgentMobileSyncConfig = {
  mandatory_sync_count?: number | null;
  block_sync?: boolean;
  allowed_window_from?: string;
  allowed_window_to?: string;
};

export type AgentMobileOrdersConfig = {
  /**
   * Mobile order UI: `days_from_order_date` | `last_day_of_this_month` |
   * `first_day_next_month` | `specific_day_next_month` (other short strings = legacy).
   */
  consignment_payment_due_rule?: string;
  /** `free` | `all_required` | `auto_fill_remaining` */
  bonus_fill_mode?: string;
  allow_return_from_shelf?: boolean;
  /** Экспедитор: редактировать частичное возмещение / возврат */
  allow_partial_return_edit?: boolean;
  /** Экспедитор: догруз с автомобиля */
  allow_reload_from_vehicle?: boolean;
};

/**
 * Экспедиторское приложение: оплата, параметры отображения, накладные.
 * (Справочник «Конфигурации» — блоки Заказ/Клиент/Оплата/Gps/Параметры.)
 */
export type AgentMobileExpeditorConfig = {
  accept_payment_for_order?: boolean;
  accept_payment_on_delivery?: boolean;
  accept_payment_from_debtors?: boolean;
  currency_symbol?: string;
  /** Разрешённые способы оплаты (id из `payment_method_entries`) */
  allowed_payment_method_ids?: string[];
  /** Ограничение по направлениям торговли (id из `trade_directions`) */
  allowed_trade_direction_ids?: number[];
  /**
   * При доставке оплата только одним из выбранных способов (`allowed_payment_method_ids`).
   * `true` — строго; `false`/нет — не навязывать.
   */
  delivery_payment_method_strict?: boolean;
  /** Отгрузочная накладная: отпечаток при подтверждении */
  fingerprint_required_for_shipment_confirm?: boolean;
};

/** Mobile supervision checklist (not tenant audit journal). */
export type AgentMobileSupervisionConfig = {
  check_receipt_faces?: boolean;
  check_merchandising?: boolean;
  check_default_price?: boolean;
  check_motivation?: boolean;
  check_stock?: boolean;
  check_sales?: boolean;
};

export type AgentMobileVanSellingConfig = {
  payment_acceptance_method_ids?: string[];
  payment_required?: boolean;
  allow_order_while_moving?: boolean;
  allow_change_movement_status?: boolean;
};

export type AgentMobileConfigV1 = {
  schema_version: typeof AGENT_MOBILE_CONFIG_SCHEMA_VERSION;
  client?: AgentMobileClientConfig;
  gps?: AgentMobileGpsConfig;
  outlet?: AgentMobileOutletConfig;
  product_list?: AgentMobileProductListConfig;
  photo?: AgentMobilePhotoConfig;
  misc?: AgentMobileMiscConfig;
  sync?: AgentMobileSyncConfig;
  orders?: AgentMobileOrdersConfig;
  supervision?: AgentMobileSupervisionConfig;
  van_selling?: AgentMobileVanSellingConfig;
  expeditor?: AgentMobileExpeditorConfig;
};
