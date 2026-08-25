import {
  parseMobileConfigV1,
  type AgentMobileConfigV1
} from "./agent-mobile-config";
import type { AgentEntitlements } from "./staff.shared";
import { normalizePriceTypes, parsePriceTypesJson } from "./staff.shared";

export type EntSnap = {
  price_types: string[];
  product_rules: NonNullable<AgentEntitlements["product_rules"]>;
  mobile_config?: AgentMobileConfigV1;
};

export function entitlementsSnapshotFromAgentUser(u: {
  agent_entitlements: unknown;
  agent_price_types: unknown;
  price_type: string | null;
}): EntSnap {
  const fromJson =
    u.agent_entitlements && typeof u.agent_entitlements === "object" && !Array.isArray(u.agent_entitlements)
      ? (u.agent_entitlements as Record<string, unknown>)
      : {};
  const product_rules: NonNullable<AgentEntitlements["product_rules"]> = [];
  const rulesRaw = fromJson.product_rules;
  if (Array.isArray(rulesRaw)) {
    for (const r of rulesRaw) {
      if (!r || typeof r !== "object") continue;
      const rec = r as Record<string, unknown>;
      const cid =
        typeof rec.category_id === "number" && Number.isInteger(rec.category_id) && rec.category_id > 0
          ? rec.category_id
          : 0;
      if (!cid) continue;
      const all = Boolean(rec.all);
      const product_ids = Array.isArray(rec.product_ids)
        ? rec.product_ids.filter((x): x is number => typeof x === "number" && Number.isInteger(x) && x > 0)
        : undefined;
      product_rules.push({ category_id: cid, all, product_ids });
    }
  }
  const jPt = fromJson.price_types;
  const fromJsonPts =
    Array.isArray(jPt) && jPt.every((x) => typeof x === "string") ? normalizePriceTypes(jPt as string[]) : [];
  const colPts = parsePriceTypesJson(u.agent_price_types);
  const single = u.price_type ? normalizePriceTypes([u.price_type]) : [];
  const price_types = [...new Set([...fromJsonPts, ...colPts, ...single])];
  const mobile_config = parseMobileConfigV1(fromJson.mobile_config);
  return {
    price_types,
    product_rules,
    ...(mobile_config ? { mobile_config } : {})
  };
}

export function snapToAgentEntitlements(snap: EntSnap): AgentEntitlements {
  const out: AgentEntitlements = {
    price_types: snap.price_types,
    product_rules: snap.product_rules
  };
  if (snap.mobile_config) out.mobile_config = snap.mobile_config;
  return out;
}

function mergeAgentProductRulesPatch(
  ent: EntSnap,
  mode: "add" | "remove",
  categoryId: number,
  productIds: number[]
): EntSnap {
  const idSet = [...new Set(productIds.filter((x) => x > 0))];
  const rules = [...ent.product_rules];
  const idx = rules.findIndex((r) => r.category_id === categoryId);
  if (mode === "add") {
    if (!idSet.length) return ent;
    if (idx < 0) {
      rules.push({ category_id: categoryId, all: false, product_ids: idSet });
    } else {
      const r = rules[idx]!;
      if (r.all) {
        rules[idx] = { category_id: categoryId, all: false, product_ids: idSet };
      } else {
        const cur = new Set(r.product_ids ?? []);
        for (const p of idSet) cur.add(p);
        rules[idx] = { category_id: categoryId, all: false, product_ids: [...cur] };
      }
    }
    return { ...ent, product_rules: rules };
  }
  if (idx < 0) return ent;
  const r = rules[idx]!;
  if (r.all) {
    rules.splice(idx, 1);
    return { ...ent, product_rules: rules };
  }
  const rm = new Set(idSet);
  const next = (r.product_ids ?? []).filter((id) => !rm.has(id));
  if (next.length === 0) rules.splice(idx, 1);
  else rules[idx] = { category_id: categoryId, all: false, product_ids: next };
  return { ...ent, product_rules: rules };
}

function mergeEntitlementPriceTypes(ent: EntSnap, mode: "add" | "remove", labels: string[]): EntSnap {
  const norm = [...new Set(labels.map((s) => s.trim()).filter(Boolean))];
  let pts = [...ent.price_types];
  if (mode === "add") pts = [...new Set([...pts, ...norm])];
  else {
    const rm = new Set(norm);
    pts = pts.filter((p) => !rm.has(p));
  }
  return { ...ent, price_types: pts };
}

/** Guruh mahsulot/narx patchidan keyin `mobile_config` saqlanadi (regression fix). */
export function mergeAgentEntitlementsAfterProductListPatch(
  userRow: { agent_entitlements: unknown; agent_price_types: unknown; price_type: string | null },
  patch: {
    mode: "add" | "remove";
    category_id?: number;
    product_ids?: number[];
    price_types?: string[];
  }
): AgentEntitlements {
  let snap = entitlementsSnapshotFromAgentUser(userRow);
  if (patch.product_ids?.length && patch.category_id != null) {
    snap = mergeAgentProductRulesPatch(snap, patch.mode, patch.category_id, patch.product_ids);
  }
  if (patch.price_types?.length) {
    snap = mergeEntitlementPriceTypes(snap, patch.mode, patch.price_types);
  }
  return snapToAgentEntitlements(snap);
}
