import { POLKI_PRICE_TYPE_LABEL_RU } from "../../constants";

export type PolkiPriceTypeEntryRef = {
  id: string;
  name: string;
  code: string | null;
  kind?: "sale" | "purchase" | string;
  active?: boolean;
  sort_order?: number | null;
};

export function polkiPriceTypeKey(e: PolkiPriceTypeEntryRef): string {
  const code = e.code?.trim();
  if (code) return code;
  const name = e.name.trim();
  if (name) return name;
  return e.id.trim();
}

/** Tenant `price_type_entries` (sale) — backend `create-context` bilan bir xil mantiq. */
export function salePriceTypeOptionsFromProfile(
  entries: PolkiPriceTypeEntryRef[] | undefined,
  fallbackKeys: string[]
): Array<{ key: string; label: string }> {
  const sale = (entries ?? []).filter(
    (e) => e.active !== false && String(e.kind ?? "sale").toLowerCase() === "sale"
  );
  if (sale.length > 0) {
    return [...sale]
      .sort((a, b) => {
        const ao = a.sort_order ?? 1e6;
        const bo = b.sort_order ?? 1e6;
        if (ao !== bo) return ao - bo;
        return a.name.localeCompare(b.name, "ru");
      })
      .map((e) => {
        const key = polkiPriceTypeKey(e);
        return { key, label: e.name.trim() || (POLKI_PRICE_TYPE_LABEL_RU[key] ?? key) };
      });
  }
  const keys = fallbackKeys.length > 0 ? fallbackKeys : ["retail"];
  return keys.map((key) => ({
    key,
    label: POLKI_PRICE_TYPE_LABEL_RU[key] ?? key
  }));
}
