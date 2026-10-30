export type PaymentMethodEntry = { id: string; name: string; active: boolean };

export type PriceTypeEntry = {
  id: string;
  name: string;
  code: string | null;
  payment_method_id: string;
  kind: "sale" | "purchase";
  sort_order: number | null;
  comment: string | null;
  active: boolean;
  manual: boolean;
  attached_clients_only: boolean;
};

export type PriceTypeTenantProfile = {
  references: {
    payment_method_entries?: PaymentMethodEntry[];
    price_type_entries?: PriceTypeEntry[];
  };
};

export function newPriceTypeId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `pt-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function sortPriceTypeRows(list: PriceTypeEntry[]): PriceTypeEntry[] {
  return [...list].sort((a, b) => {
    const ao = a.sort_order ?? 1e6;
    const bo = b.sort_order ?? 1e6;
    if (ao !== bo) return ao - bo;
    return a.name.localeCompare(b.name, "uz");
  });
}

export function priceTypeKey(e: PriceTypeEntry): string {
  return e.code?.trim() || e.name.trim() || e.name;
}

export function pickZodLeaf(per: Record<string, string>, leaf: string): string | undefined {
  for (const [k, v] of Object.entries(per)) {
    if (k === leaf || k.endsWith(`.${leaf}`)) return v;
  }
  return undefined;
}
