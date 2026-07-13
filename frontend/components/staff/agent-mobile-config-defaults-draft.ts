import {
  AGENT_MOBILE_SCHEMA_VERSION,
  type AgentMobileConfigDraft
} from "@/components/staff/agent-mobile-config-types";

/** Backend `defaultMobileConfigForRole('agent')` — guruh konfiguratsiyasi standart ko‘rinishi. */
export function defaultAgentMobileDraft(): AgentMobileConfigDraft {
  return {
    schema_version: AGENT_MOBILE_SCHEMA_VERSION,
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
    product_list: { show_out_of_stock: false, allow_submit_for_new_client: true },
    misc: { visit_start_end_enabled: true },
    sync: { allowed_window_from: "06:00", allowed_window_to: "22:00" },
    photo: { jpeg_quality: 92, max_width_px: 4032, max_height_px: 4032 },
    orders: { bonus_fill_mode: "auto_fill_remaining" }
  };
}
