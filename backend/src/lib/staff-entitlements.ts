/**
 * Staff entitlements parsing and merging utilities
 */
import type { AgentEntitlements } from "../modules/staff/staff.shared";

export interface ParsedEntitlements {
  price_types: string[];
  product_rules: Array<{
    category_id: number;
    all: boolean;
    product_ids?: number[];
  }>;
}

export function parseEntitlements(input: unknown): ParsedEntitlements {
  if (!input || typeof input !== "object") {
    return { price_types: [], product_rules: [] };
  }

  const obj = input as Record<string, unknown>;

  const price_types = Array.isArray(obj.price_types)
    ? obj.price_types.filter((p): p is string => typeof p === "string")
    : [];

  const product_rules: ParsedEntitlements["product_rules"] = [];

  if (Array.isArray(obj.product_rules)) {
    for (const r of obj.product_rules) {
      if (!r || typeof r !== "object") continue;
      const rec = r as Record<string, unknown>;
      const cid =
        typeof rec.category_id === "number" &&
        Number.isInteger(rec.category_id) &&
        rec.category_id > 0
          ? rec.category_id
          : 0;
      if (!cid) continue;

      const all = Boolean(rec.all);
      const product_ids = Array.isArray(rec.product_ids)
        ? rec.product_ids.filter((x): x is number =>
            typeof x === "number" && Number.isInteger(x) && x > 0
          )
        : undefined;

      product_rules.push({ category_id: cid, all, product_ids });
    }
  }

  return { price_types, product_rules };
}

export function normalizePriceTypes(types: string[]): string[] {
  return [...new Set(types.map((s) => s.trim()).filter(Boolean))];
}

export function mergeEntitlements(
  base: ParsedEntitlements,
  override: Partial<ParsedEntitlements>
): ParsedEntitlements {
  return {
    price_types: normalizePriceTypes([
      ...base.price_types,
      ...(override.price_types ?? [])
    ]),
    product_rules: [
      ...base.product_rules,
      ...(override.product_rules ?? [])
    ].filter(
      (v, i, arr) =>
        arr.findIndex((t) => t.category_id === v.category_id) === i
    )
  };
}

export function entitlementsToAgentEntitlements(parsed: ParsedEntitlements): AgentEntitlements {
  return {
    price_types: parsed.price_types,
    product_rules: parsed.product_rules
  };
}

export function agentEntitlementsToParsed(ent: AgentEntitlements): ParsedEntitlements {
  return {
    price_types: ent.price_types ?? [],
    product_rules: ent.product_rules ?? []
  };
}