import type { AgentEntitlementSavePayload } from "@/components/staff/agent-restrictions-dialog";

export function parseSlotEntitlements(raw: unknown): AgentEntitlementSavePayload {
  if (!raw || typeof raw !== "object") return { price_types: [], product_rules: [] };
  const o = raw as Record<string, unknown>;
  const price_types = Array.isArray(o.price_types)
    ? o.price_types.filter((x): x is string => typeof x === "string" && x.trim().length > 0)
    : [];
  const product_rules: AgentEntitlementSavePayload["product_rules"] = [];
  if (Array.isArray(o.product_rules)) {
    for (const r of o.product_rules) {
      if (!r || typeof r !== "object" || Array.isArray(r)) continue;
      const rec = r as Record<string, unknown>;
      const cid = Number(rec.category_id);
      if (!Number.isInteger(cid) || cid <= 0) continue;
      const all = rec.all === true;
      const product_ids = Array.isArray(rec.product_ids)
        ? rec.product_ids
            .map((x) => (typeof x === "number" ? x : Number(x)))
            .filter((n) => Number.isInteger(n) && n > 0)
        : undefined;
      product_rules.push(
        all ? { category_id: cid, all: true } : { category_id: cid, all: false, product_ids }
      );
    }
  }
  return { price_types, product_rules };
}

function canon(ent: AgentEntitlementSavePayload): string {
  const pts = [...(ent.price_types ?? [])].sort();
  const rules = [...(ent.product_rules ?? [])]
    .map((r) => ({
      category_id: r.category_id,
      all: Boolean(r.all),
      product_ids: [...(r.product_ids ?? [])].sort((a, b) => a - b)
    }))
    .sort((a, b) => a.category_id - b.category_id);
  return JSON.stringify({ price_types: pts, product_rules: rules });
}

/** Bir nechta joy: bir xil bo‘lsa shu; farq qilsa — barcha belgilanganlar (union). */
export function mergeSlotEntitlementsForEditor(list: AgentEntitlementSavePayload[]): {
  merged: AgentEntitlementSavePayload;
  mixed: boolean;
} {
  if (list.length === 0) {
    return { merged: { price_types: [], product_rules: [] }, mixed: false };
  }
  const mixed = new Set(list.map(canon)).size > 1;
  const pts = new Set<string>();
  const byCat = new Map<number, { all: boolean; product_ids: Set<number> }>();
  for (const e of list) {
    for (const p of e.price_types ?? []) pts.add(p);
    for (const r of e.product_rules ?? []) {
      const prev = byCat.get(r.category_id) ?? { all: false, product_ids: new Set<number>() };
      if (r.all) prev.all = true;
      for (const id of r.product_ids ?? []) prev.product_ids.add(id);
      byCat.set(r.category_id, prev);
    }
  }
  const product_rules: AgentEntitlementSavePayload["product_rules"] = [...byCat.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([category_id, v]) =>
      v.all
        ? { category_id, all: true as const }
        : { category_id, all: false as const, product_ids: [...v.product_ids].sort((a, b) => a - b) }
    );
  return {
    merged: { price_types: [...pts], product_rules },
    mixed
  };
}
