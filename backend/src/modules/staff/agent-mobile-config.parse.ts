import {
  AGENT_MOBILE_CONFIG_SCHEMA_VERSION,
  CLIENT_FIELD_KEYS,
  type AgentMobileClientConfig,
  type AgentMobileConfigV1,
  type AgentMobileExpeditorConfig,
  type AgentMobileGpsConfig,
  type AgentMobileMiscConfig,
  type AgentMobileOrdersConfig,
  type AgentMobileOutletConfig,
  type AgentMobilePhotoConfig,
  type AgentMobileProductListConfig,
  type AgentMobileRouteConfig,
  type AgentMobileSupervisionConfig,
  type AgentMobileSyncConfig,
  type AgentMobileVanSellingConfig,
  type ClientFieldKey
} from "./agent-mobile-config.types";

function asBool(v: unknown): boolean | undefined {
  if (v === true || v === false) return v;
  return undefined;
}

function asNum(v: unknown): number | null | undefined {
  if (v == null) return v === null ? null : undefined;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

function asStr(v: unknown, max = 500): string | undefined {
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  if (!t) return undefined;
  return t.slice(0, max);
}

function parseFieldMap(raw: unknown): Partial<Record<ClientFieldKey, boolean>> | undefined {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const out: Partial<Record<ClientFieldKey, boolean>> = {};
  for (const k of CLIENT_FIELD_KEYS) {
    const b = asBool((raw as Record<string, unknown>)[k]);
    if (b !== undefined) out[k] = b;
  }
  return Object.keys(out).length ? out : undefined;
}

function parseStringArray(raw: unknown, maxLen = 64, maxItems = 50): string[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: string[] = [];
  for (const x of raw) {
    if (typeof x !== "string") continue;
    const t = x.trim().slice(0, maxLen);
    if (t) out.push(t);
    if (out.length >= maxItems) break;
  }
  return out.length ? out : undefined;
}

function parsePositiveIntArray(raw: unknown, maxItems = 50): number[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: number[] = [];
  const seen = new Set<number>();
  for (const x of raw) {
    const n = typeof x === "number" ? x : Number(x);
    if (!Number.isInteger(n) || n <= 0 || seen.has(n)) continue;
    seen.add(n);
    out.push(n);
    if (out.length >= maxItems) break;
  }
  return out.length ? out : undefined;
}

/**
 * Parse and whitelist `mobile_config` from JSON. Unknown keys are dropped.
 */
export function parseMobileConfigV1(raw: unknown): AgentMobileConfigV1 | undefined {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const o = raw as Record<string, unknown>;
  const ver = o.schema_version;
  if (ver !== 1 && ver !== "1") return undefined;

  const clientRaw = o.client;
  let client: AgentMobileClientConfig | undefined;
  if (clientRaw && typeof clientRaw === "object" && !Array.isArray(clientRaw)) {
    const c = clientRaw as Record<string, unknown>;
    client = {
      can_edit: asBool(c.can_edit),
      can_create: asBool(c.can_create),
      require_new_client_approval: asBool(c.require_new_client_approval),
      show_balance: asBool(c.show_balance),
      show_photos: asBool(c.show_photos),
      phone_prefix: asStr(c.phone_prefix, 32),
      fields_visible: parseFieldMap(c.fields_visible),
      fields_required: parseFieldMap(c.fields_required),
      can_change_client_location: asBool(c.can_change_client_location)
    };
    if (!Object.values(client).some((v) => v !== undefined)) client = undefined;
  }

  let gps: AgentMobileGpsConfig | undefined;
  const gpsRaw = o.gps;
  if (gpsRaw && typeof gpsRaw === "object" && !Array.isArray(gpsRaw)) {
    const g = gpsRaw as Record<string, unknown>;
    gps = {
      min_battery_pct: asNum(g.min_battery_pct) ?? undefined,
      always_on: asBool(g.always_on),
      required_for_order: asBool(g.required_for_order),
      internet_required_for_order: asBool(g.internet_required_for_order),
      internet_always_on: asBool(g.internet_always_on),
      tracking_enabled: asBool(g.tracking_enabled),
      tracking_interval_sec: asNum(g.tracking_interval_sec) ?? undefined,
      min_distance_m: asNum(g.min_distance_m) ?? undefined,
      max_accuracy_m: asNum(g.max_accuracy_m) ?? undefined
    };
    if (!Object.values(gps).some((v) => v !== undefined)) gps = undefined;
  }

  let outlet: AgentMobileOutletConfig | undefined;
  const outRaw = o.outlet;
  if (outRaw && typeof outRaw === "object" && !Array.isArray(outRaw)) {
    const u = outRaw as Record<string, unknown>;
    outlet = {
      show_plan_in_reports: asBool(u.show_plan_in_reports),
      plan_version: asStr(u.plan_version, 64)
    };
    if (!Object.values(outlet).some((v) => v !== undefined)) outlet = undefined;
  }

  let route: AgentMobileRouteConfig | undefined;
  const routeRaw = o.route;
  if (routeRaw && typeof routeRaw === "object" && !Array.isArray(routeRaw)) {
    const r = routeRaw as Record<string, unknown>;
    route = {
      daily_visit_limit: asNum(r.daily_visit_limit) ?? undefined,
      readd_cooldown_days: asNum(r.readd_cooldown_days) ?? undefined
    };
    if (!Object.values(route).some((v) => v !== undefined)) route = undefined;
  }

  let product_list: AgentMobileProductListConfig | undefined;
  const plRaw = o.product_list;
  if (plRaw && typeof plRaw === "object" && !Array.isArray(plRaw)) {
    const p = plRaw as Record<string, unknown>;
    product_list = {
      show_out_of_stock: asBool(p.show_out_of_stock),
      allow_submit_for_new_client: asBool(p.allow_submit_for_new_client)
    };
    if (!Object.values(product_list).some((v) => v !== undefined)) product_list = undefined;
  }

  let photo: AgentMobilePhotoConfig | undefined;
  const phRaw = o.photo;
  if (phRaw && typeof phRaw === "object" && !Array.isArray(phRaw)) {
    const p = phRaw as Record<string, unknown>;
    photo = {
      max_width_px: asNum(p.max_width_px) ?? undefined,
      max_height_px: asNum(p.max_height_px) ?? undefined,
      jpeg_quality: asNum(p.jpeg_quality) ?? undefined,
      required_for_order: asBool(p.required_for_order)
    };
    if (!Object.values(photo).some((v) => v !== undefined)) photo = undefined;
  }

  let misc: AgentMobileMiscConfig | undefined;
  const miscRaw = o.misc;
  if (miscRaw && typeof miscRaw === "object" && !Array.isArray(miscRaw)) {
    const m = miscRaw as Record<string, unknown>;
    const disallowed =
      parseStringArray(m.disallowed_payment_method_codes) ??
      parseStringArray(m.disallowed_payment_method_ids);
    misc = {
      visit_start_end_enabled: asBool(m.visit_start_end_enabled),
      require_within_outlet_radius_m: asNum(m.require_within_outlet_radius_m) ?? undefined,
      require_stock_snapshot_for_order: asBool(m.require_stock_snapshot_for_order),
      require_shipment_date: asBool(m.require_shipment_date),
      allow_exchange_request: asBool(m.allow_exchange_request),
      disallowed_payment_method_codes: disallowed
    };
    if (!Object.values(misc).some((v) => v !== undefined)) misc = undefined;
  }

  let sync: AgentMobileSyncConfig | undefined;
  const syncRaw = o.sync;
  if (syncRaw && typeof syncRaw === "object" && !Array.isArray(syncRaw)) {
    const s = syncRaw as Record<string, unknown>;
    sync = {
      mandatory_sync_count: asNum(s.mandatory_sync_count) ?? undefined,
      block_sync: asBool(s.block_sync),
      allowed_window_from: asStr(s.allowed_window_from, 8),
      allowed_window_to: asStr(s.allowed_window_to, 8),
      post_order_delay_minutes: (() => {
        const n = asNum(s.post_order_delay_minutes);
        if (n == null) return undefined;
        return Math.min(59, Math.max(0, Math.trunc(n)));
      })()
    };
    if (!Object.values(sync).some((v) => v !== undefined)) sync = undefined;
  }

  let orders: AgentMobileOrdersConfig | undefined;
  const ordRaw = o.orders;
  if (ordRaw && typeof ordRaw === "object" && !Array.isArray(ordRaw)) {
    const r = ordRaw as Record<string, unknown>;
    orders = {
      consignment_payment_due_rule: asStr(r.consignment_payment_due_rule, 120),
      bonus_fill_mode: asStr(r.bonus_fill_mode, 120),
      allow_return_from_shelf: asBool(r.allow_return_from_shelf),
      allow_partial_return_edit: asBool(r.allow_partial_return_edit),
      allow_reload_from_vehicle: asBool(r.allow_reload_from_vehicle),
      return_reason_required: asBool(r.return_reason_required)
    };
    if (!Object.values(orders).some((v) => v !== undefined)) orders = undefined;
  }

  let supervision: AgentMobileSupervisionConfig | undefined;
  const supRaw = o.supervision;
  if (supRaw && typeof supRaw === "object" && !Array.isArray(supRaw)) {
    const s = supRaw as Record<string, unknown>;
    supervision = {
      check_receipt_faces: asBool(s.check_receipt_faces),
      check_merchandising: asBool(s.check_merchandising),
      check_default_price: asBool(s.check_default_price),
      check_motivation: asBool(s.check_motivation),
      check_stock: asBool(s.check_stock),
      check_sales: asBool(s.check_sales)
    };
    if (!Object.values(supervision).some((v) => v !== undefined)) supervision = undefined;
  }

  let van_selling: AgentMobileVanSellingConfig | undefined;
  const vsRaw = o.van_selling;
  if (vsRaw && typeof vsRaw === "object" && !Array.isArray(vsRaw)) {
    const v = vsRaw as Record<string, unknown>;
    van_selling = {
      payment_acceptance_method_ids: parseStringArray(v.payment_acceptance_method_ids),
      payment_required: asBool(v.payment_required),
      allow_order_while_moving: asBool(v.allow_order_while_moving),
      allow_change_movement_status: asBool(v.allow_change_movement_status)
    };
    if (!Object.values(van_selling).some((x) => x !== undefined)) van_selling = undefined;
  }

  let expeditor: AgentMobileExpeditorConfig | undefined;
  const exRaw = o.expeditor;
  if (exRaw && typeof exRaw === "object" && !Array.isArray(exRaw)) {
    const e = exRaw as Record<string, unknown>;
    expeditor = {
      accept_payment_for_order: asBool(e.accept_payment_for_order),
      accept_payment_on_delivery: asBool(e.accept_payment_on_delivery),
      accept_payment_from_debtors: asBool(e.accept_payment_from_debtors),
      currency_symbol: asStr(e.currency_symbol, 16),
      allowed_payment_method_ids: parseStringArray(e.allowed_payment_method_ids),
      allowed_trade_direction_ids: parsePositiveIntArray(e.allowed_trade_direction_ids),
      delivery_payment_method_strict: asBool(e.delivery_payment_method_strict),
      fingerprint_required_for_shipment_confirm: asBool(e.fingerprint_required_for_shipment_confirm),
      require_photo_report_before_visit: asBool(e.require_photo_report_before_visit)
    };
    if (!Object.values(expeditor).some((x) => x !== undefined)) expeditor = undefined;
  }

  const cfg: AgentMobileConfigV1 = {
    schema_version: AGENT_MOBILE_CONFIG_SCHEMA_VERSION,
    ...(client ? { client } : {}),
    ...(gps ? { gps } : {}),
    ...(outlet ? { outlet } : {}),
    ...(route ? { route } : {}),
    ...(product_list ? { product_list } : {}),
    ...(photo ? { photo } : {}),
    ...(misc ? { misc } : {}),
    ...(sync ? { sync } : {}),
    ...(orders ? { orders } : {}),
    ...(supervision ? { supervision } : {}),
    ...(van_selling ? { van_selling } : {}),
    ...(expeditor ? { expeditor } : {})
  };

  const hasBody =
    client ||
    gps ||
    outlet ||
    route ||
    product_list ||
    photo ||
    misc ||
    sync ||
    orders ||
    supervision ||
    van_selling ||
    expeditor;
  if (!hasBody) return { schema_version: AGENT_MOBILE_CONFIG_SCHEMA_VERSION };
  return cfg;
}

export function extractMobileConfigFromEntitlementsUnknown(ent: unknown): AgentMobileConfigV1 | undefined {
  if (ent == null || typeof ent !== "object" || Array.isArray(ent)) return undefined;
  const mc = (ent as Record<string, unknown>).mobile_config;
  return parseMobileConfigV1(mc);
}
