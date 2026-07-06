import {
  AGENT_MOBILE_CONFIG_SCHEMA_VERSION,
  type AgentMobileClientConfig,
  type AgentMobileConfigV1
} from "./agent-mobile-config.types";
import { extractMobileConfigFromEntitlementsUnknown } from "./agent-mobile-config.parse";

/** Web «Конфигурации» bo‘sh qoldirilganda mobil uchun xavfsiz standartlar. */
export function defaultMobileConfigForRole(role: string): AgentMobileConfigV1 {
  const base: AgentMobileConfigV1 = { schema_version: AGENT_MOBILE_CONFIG_SCHEMA_VERSION };

  if (role === "agent") {
    return {
      ...base,
      client: {
        can_create: true,
        can_edit: true,
        can_change_client_location: true,
        show_balance: true,
        show_photos: true,
        phone_prefix: "+998",
        fields_visible: {
          name: true,
          legal_name: true,
          phone: true,
          category: true,
          territory: true,
          address: true,
          visit_day: true,
          coordinates: true
        }
      },
      gps: { tracking_enabled: false, tracking_interval_sec: 300 },
      route: { daily_visit_limit: 50, readd_cooldown_days: 0 },
      product_list: { show_out_of_stock: true, allow_submit_for_new_client: true },
      misc: { visit_start_end_enabled: true },
      sync: { allowed_window_from: "06:00", allowed_window_to: "22:00" },
      photo: { jpeg_quality: 92, max_width_px: 4032, max_height_px: 4032 },
      orders: { bonus_fill_mode: "auto_fill_remaining" }
    };
  }

  if (role === "expeditor") {
    return {
      ...base,
      client: { show_balance: true, show_photos: true },
      gps: { tracking_enabled: true, tracking_interval_sec: 300 },
      expeditor: {
        accept_payment_for_order: true,
        accept_payment_on_delivery: true,
        accept_payment_from_debtors: false,
        currency_symbol: "so'm"
      },
      orders: {
        allow_partial_return_edit: true,
        allow_reload_from_vehicle: true,
        allow_return_from_shelf: false,
        return_reason_required: false
      }
    };
  }

  if (role === "supervisor") {
    return {
      ...base,
      misc: { visit_start_end_enabled: true },
      supervision: {
        check_receipt_faces: true,
        check_merchandising: true,
        check_default_price: true,
        check_stock: true,
        check_sales: true,
        check_motivation: false
      }
    };
  }

  return base;
}

function mergeSection<T extends Record<string, unknown>>(base: T | undefined, patch: T | undefined): T | undefined {
  if (!base && !patch) return undefined;
  if (!base) return patch;
  if (!patch) return base;
  const out = { ...base } as T;
  for (const [key, value] of Object.entries(patch)) {
    if (value === null || value === undefined) continue;
    (out as Record<string, unknown>)[key] = value;
  }
  return out;
}

/** `fields_visible` / `fields_required` default maydonlar bilan aralashtirilmasin — faqat saqlangan xarita. */
function mergeClientConfig(
  base: AgentMobileClientConfig | undefined,
  patch: AgentMobileClientConfig | undefined
): AgentMobileClientConfig | undefined {
  const merged = mergeSection(
    base as Record<string, unknown> | undefined,
    patch as Record<string, unknown> | undefined
  ) as AgentMobileClientConfig | undefined;
  if (!merged) return undefined;
  if (patch?.fields_visible != null && Object.keys(patch.fields_visible).length > 0) {
    merged.fields_visible = { ...patch.fields_visible };
  }
  if (patch?.fields_required != null && Object.keys(patch.fields_required).length > 0) {
    merged.fields_required = { ...patch.fields_required };
  }
  return merged;
}

/** Vebda qisman saqlangan bo‘lsa ham rol defaultlari bilan birlashtiriladi (mobil to‘liq config oladi). */
export function mergeMobileConfigWithDefaults(
  role: string,
  parsed: AgentMobileConfigV1 | undefined
): AgentMobileConfigV1 {
  const defaults = defaultMobileConfigForRole(role);
  if (!parsed) return defaults;
  return {
    schema_version: AGENT_MOBILE_CONFIG_SCHEMA_VERSION,
    client: mergeClientConfig(defaults.client, parsed.client),
    gps: mergeSection(defaults.gps, parsed.gps),
    outlet: mergeSection(defaults.outlet, parsed.outlet),
    route: mergeSection(defaults.route, parsed.route),
    product_list: mergeSection(defaults.product_list, parsed.product_list),
    photo: mergeSection(defaults.photo, parsed.photo),
    misc: mergeSection(defaults.misc, parsed.misc),
    sync: mergeSection(defaults.sync, parsed.sync),
    orders: mergeSection(defaults.orders, parsed.orders),
    supervision: mergeSection(defaults.supervision, parsed.supervision),
    van_selling: mergeSection(defaults.van_selling, parsed.van_selling),
    expeditor: mergeSection(defaults.expeditor, parsed.expeditor)
  };
}

/** Saqlangan `mobile_config` + rol defaultlari. */
export function resolveMobileConfigForUser(role: string, entitlements: unknown): AgentMobileConfigV1 {
  const parsed = extractMobileConfigFromEntitlementsUnknown(entitlements);
  return mergeMobileConfigWithDefaults(role, parsed);
}
