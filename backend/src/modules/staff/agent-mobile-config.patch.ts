import {
  AGENT_MOBILE_CONFIG_SCHEMA_VERSION,
  type AgentMobileClientConfig,
  type AgentMobileConfigV1
} from "./agent-mobile-config.types";

function mergeSection<T extends Record<string, unknown>>(
  base: T | undefined,
  patch: T | undefined
): T | undefined {
  if (!patch) return base;
  if (!base) return patch;
  const out = { ...base } as T;
  for (const [key, value] of Object.entries(patch)) {
    if (value === null || value === undefined) continue;
    (out as Record<string, unknown>)[key] = value;
  }
  return out;
}

function mergeClientConfigPatch(
  base: AgentMobileClientConfig | undefined,
  patch: AgentMobileClientConfig | undefined
): AgentMobileClientConfig | undefined {
  if (!patch) return base;
  const merged = mergeSection(
    base as Record<string, unknown> | undefined,
    patch as Record<string, unknown> | undefined
  ) as AgentMobileClientConfig | undefined;
  if (!merged) return patch;
  if (patch.fields_visible != null && Object.keys(patch.fields_visible).length > 0) {
    merged.fields_visible = { ...base?.fields_visible, ...patch.fields_visible };
  }
  if (patch.fields_required != null && Object.keys(patch.fields_required).length > 0) {
    merged.fields_required = { ...base?.fields_required, ...patch.fields_required };
  }
  return merged;
}

/** Guruh patch: har bir agentning saqlangan `mobile_config` ustiga faqat yuborilgan bo‘limlar qo‘llanadi. */
export function mergeMobileConfigPatch(
  stored: AgentMobileConfigV1 | undefined,
  patch: AgentMobileConfigV1
): AgentMobileConfigV1 {
  const base: AgentMobileConfigV1 = stored ?? { schema_version: AGENT_MOBILE_CONFIG_SCHEMA_VERSION };
  return {
    schema_version: AGENT_MOBILE_CONFIG_SCHEMA_VERSION,
    client: mergeClientConfigPatch(base.client, patch.client),
    gps: mergeSection(base.gps, patch.gps),
    outlet: mergeSection(base.outlet, patch.outlet),
    route: mergeSection(base.route, patch.route),
    product_list: mergeSection(base.product_list, patch.product_list),
    photo: mergeSection(base.photo, patch.photo),
    misc: mergeSection(base.misc, patch.misc),
    sync: mergeSection(base.sync, patch.sync),
    orders: mergeSection(base.orders, patch.orders),
    supervision: mergeSection(base.supervision, patch.supervision),
    van_selling: mergeSection(base.van_selling, patch.van_selling),
    expeditor: mergeSection(base.expeditor, patch.expeditor)
  };
}
