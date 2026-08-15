import {
  AGENT_MOBILE_CONFIG_SCHEMA_VERSION,
  type AgentMobileConfigV1
} from "./agent-mobile-config.types";

const HH_MM = /^([01]?\d|2[0-3]):[0-5]\d$/;

export function validateAgentMobileConfig(
  tenantId: number,
  mc: AgentMobileConfigV1 | undefined | null
): void {
  if (!mc || mc.schema_version !== AGENT_MOBILE_CONFIG_SCHEMA_VERSION) return;

  const g = mc.gps;
  if (g) {
    if (g.min_battery_pct != null && (g.min_battery_pct < 0 || g.min_battery_pct > 100)) {
      throw new Error("BAD_MOBILE_CONFIG_GPS_BATTERY");
    }
    if (g.tracking_interval_sec != null && (g.tracking_interval_sec < 5 || g.tracking_interval_sec > 86_400)) {
      throw new Error("BAD_MOBILE_CONFIG_GPS_INTERVAL");
    }
    if (g.min_distance_m != null && (g.min_distance_m < 0 || g.min_distance_m > 1_000_000)) {
      throw new Error("BAD_MOBILE_CONFIG_GPS_DISTANCE");
    }
    if (g.max_accuracy_m != null && (g.max_accuracy_m < 1 || g.max_accuracy_m > 5_000)) {
      throw new Error("BAD_MOBILE_CONFIG_GPS_ACCURACY");
    }
  }

  const route = mc.route;
  if (route) {
    if (route.daily_visit_limit != null && (route.daily_visit_limit < 0 || route.daily_visit_limit > 10_000)) {
      throw new Error("BAD_MOBILE_CONFIG_ROUTE");
    }
    if (route.readd_cooldown_days != null && (route.readd_cooldown_days < 0 || route.readd_cooldown_days > 365)) {
      throw new Error("BAD_MOBILE_CONFIG_ROUTE");
    }
  }

  const ph = mc.photo;
  if (ph) {
    if (ph.max_width_px != null && (ph.max_width_px < 64 || ph.max_width_px > 8192)) throw new Error("BAD_MOBILE_CONFIG_PHOTO");
    if (ph.max_height_px != null && (ph.max_height_px < 64 || ph.max_height_px > 8192)) throw new Error("BAD_MOBILE_CONFIG_PHOTO");
    if (ph.jpeg_quality != null && (ph.jpeg_quality < 1 || ph.jpeg_quality > 100)) throw new Error("BAD_MOBILE_CONFIG_PHOTO");
  }

  const sy = mc.sync;
  if (sy) {
    if (sy.mandatory_sync_count != null && (sy.mandatory_sync_count < 0 || sy.mandatory_sync_count > 1000)) {
      throw new Error("BAD_MOBILE_CONFIG_SYNC");
    }
    if (sy.allowed_window_from != null && !HH_MM.test(sy.allowed_window_from)) throw new Error("BAD_MOBILE_CONFIG_SYNC_WINDOW");
    if (sy.allowed_window_to != null && !HH_MM.test(sy.allowed_window_to)) throw new Error("BAD_MOBILE_CONFIG_SYNC_WINDOW");
    // 0 = darhol; max 59 daqiqa (< 1 soat)
    if (
      sy.post_order_delay_minutes != null &&
      (sy.post_order_delay_minutes < 0 || sy.post_order_delay_minutes > 59)
    ) {
      throw new Error("BAD_MOBILE_CONFIG_SYNC");
    }
  }

  const m = mc.misc;
  if (m?.require_within_outlet_radius_m != null) {
    const r = m.require_within_outlet_radius_m;
    if (r < 1 || r > 50_000) throw new Error("BAD_MOBILE_CONFIG_MISC_RADIUS");
  }

  if (m?.disallowed_payment_method_codes?.length) {
    const idRe = /^[a-zA-Z0-9_-]{1,64}$/;
    for (const id of m.disallowed_payment_method_codes) {
      const t = id.trim();
      if (!idRe.test(t)) throw new Error("BAD_MOBILE_CONFIG_PAYMENT_METHOD");
    }
  }

  const vs = mc.van_selling;
  if (vs?.payment_acceptance_method_ids?.length) {
    const idRe = /^[a-zA-Z0-9_-]{1,64}$/;
    for (const id of vs.payment_acceptance_method_ids) {
      const t = id.trim();
      if (!idRe.test(t)) throw new Error("BAD_MOBILE_CONFIG_PAYMENT_METHOD");
    }
  }

  const ex = mc.expeditor;
  if (ex?.allowed_payment_method_ids?.length) {
    const idRe = /^[a-zA-Z0-9_-]{1,64}$/;
    for (const id of ex.allowed_payment_method_ids) {
      const t = id.trim();
      if (!idRe.test(t)) throw new Error("BAD_MOBILE_CONFIG_PAYMENT_METHOD");
    }
  }
  if (ex?.allowed_trade_direction_ids?.length) {
    if (ex.allowed_trade_direction_ids.length > 50) throw new Error("BAD_EXPEDITOR_MOBILE_TRADE_DIRECTION");
    for (const id of ex.allowed_trade_direction_ids) {
      if (!Number.isInteger(id) || id <= 0 || id > 2_000_000_000) {
        throw new Error("BAD_EXPEDITOR_MOBILE_TRADE_DIRECTION");
      }
    }
  }

  void tenantId;
}

