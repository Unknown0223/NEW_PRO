import { api } from "@/lib/api";
import { flattenTerritoryNodes } from "@/lib/initial-setup/profile-to-preview";

export type RelationOption = { value: string; label: string };

/** Bog‘liq maydon manbalari — avval yaratilgan ma’lumotlardan tanlash */
export type RelationSource =
  | "territory-level"
  | "territory-parent"
  | "territory-code"
  | "currency-code"
  | "unit-code"
  | "price-type"
  | "branch-code"
  | "warehouse-name"
  | "product-category-name"
  | "product-category-parent"
  | "client-format-code"
  | "client-type-code"
  | "client-category-code"
  | "sales-channel-code"
  | "product-sku";

export const RELATION_SOURCE_LABEL: Record<RelationSource, string> = {
  "territory-level": "Уровень",
  "territory-parent": "Родитель (территория)",
  "territory-code": "Город / зона (код)",
  "currency-code": "Валюта",
  "unit-code": "Единица",
  "price-type": "Тип цены",
  "branch-code": "Филиал",
  "warehouse-name": "Склад",
  "product-category-name": "Категория продукта",
  "product-category-parent": "Родительская категория",
  "client-format-code": "Формат клиента",
  "client-type-code": "Тип клиента",
  "client-category-code": "Категория клиента",
  "sales-channel-code": "Канал продаж",
  "product-sku": "SKU продукта"
};

function asRecords(raw: unknown): Record<string, unknown>[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((x) => x != null && typeof x === "object" && !Array.isArray(x)) as Record<
    string,
    unknown
  >[];
}

function opt(value: string, label?: string): RelationOption | null {
  const v = value.trim();
  if (!v) return null;
  return { value: v, label: (label ?? v).trim() || v };
}

function uniqueOptions(list: Array<RelationOption | null>): RelationOption[] {
  const seen = new Set<string>();
  const out: RelationOption[] = [];
  for (const o of list) {
    if (!o) continue;
    const k = o.value.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(o);
  }
  return out.sort((a, b) => a.label.localeCompare(b.label, "ru"));
}

function fromRefEntries(
  refs: Record<string, unknown> | undefined,
  key: string,
  valueKey: "code" | "name",
  labelExtra?: (r: Record<string, unknown>) => string
): RelationOption[] {
  return uniqueOptions(
    asRecords(refs?.[key]).map((r) => {
      const value = String(r[valueKey] ?? "").trim();
      if (!value) return null;
      const name = String(r.name ?? "").trim();
      const label = labelExtra?.(r) ?? (name && name !== value ? `${name} (${value})` : value);
      return opt(value, label);
    })
  );
}

const LEVEL_OPTIONS: RelationOption[] = [
  { value: "зона", label: "зона" },
  { value: "регион", label: "регион" },
  { value: "город", label: "город" }
];

export type RelationOptionsMap = Partial<Record<RelationSource, RelationOption[]>>;

/** Bir nechta manba uchun variantlarni yuklaydi (tanlovlar uchun). */
export async function loadRelationOptions(
  tenantSlug: string,
  sources: RelationSource[]
): Promise<RelationOptionsMap> {
  const need = new Set(sources);
  if (!need.size) return {};

  const out: RelationOptionsMap = {};

  if (need.has("territory-level")) {
    out["territory-level"] = LEVEL_OPTIONS;
  }

  let profileRefs: Record<string, unknown> | undefined;
  const needsProfile =
    need.has("territory-parent") ||
    need.has("territory-code") ||
    need.has("currency-code") ||
    need.has("unit-code") ||
    need.has("price-type") ||
    need.has("branch-code") ||
    need.has("client-format-code") ||
    need.has("client-type-code") ||
    need.has("client-category-code");

  if (needsProfile) {
    try {
      const { data } = await api.get<{ references?: Record<string, unknown> }>(
        `/api/${tenantSlug}/settings/profile`
      );
      profileRefs = data.references ?? {};
    } catch {
      profileRefs = {};
    }
  }

  if (need.has("territory-parent") || need.has("territory-code")) {
    const flat = flattenTerritoryNodes(profileRefs?.territory_nodes);
    if (need.has("territory-parent")) {
      out["territory-parent"] = uniqueOptions(flat.map((r) => opt(r.cells.name ?? "")));
    }
    if (need.has("territory-code")) {
      out["territory-code"] = uniqueOptions(
        flat.map((r) => {
          const code = (r.cells.code ?? "").trim();
          const name = (r.cells.name ?? "").trim();
          if (code) return opt(code, name ? `${name} (${code})` : code);
          return opt(name);
        })
      );
    }
  }
  if (need.has("currency-code")) {
    out["currency-code"] = fromRefEntries(profileRefs, "currency_entries", "code");
  }
  if (need.has("unit-code")) {
    out["unit-code"] = fromRefEntries(profileRefs, "unit_measures", "code", (r) => {
      const code = String(r.code ?? "");
      const name = String(r.name ?? "");
      return name ? `${name} (${code})` : code;
    });
  }
  if (need.has("price-type")) {
    const byCode = fromRefEntries(profileRefs, "price_type_entries", "code");
    const byName = fromRefEntries(profileRefs, "price_type_entries", "name");
    out["price-type"] = uniqueOptions([...byCode, ...byName].map((o) => o));
  }
  if (need.has("branch-code")) {
    out["branch-code"] = fromRefEntries(profileRefs, "branches", "code", (r) => {
      const code = String(r.code ?? "");
      const name = String(r.name ?? "");
      if (!code) return name;
      return name ? `${name} (${code})` : code;
    });
  }
  if (need.has("client-format-code")) {
    out["client-format-code"] = fromRefEntries(profileRefs, "client_format_entries", "code");
  }
  if (need.has("client-type-code")) {
    out["client-type-code"] = fromRefEntries(profileRefs, "client_type_entries", "code");
  }
  if (need.has("client-category-code")) {
    out["client-category-code"] = fromRefEntries(profileRefs, "client_category_entries", "code");
  }

  if (need.has("sales-channel-code")) {
    try {
      const { data } = await api.get<{ data?: { name: string; code?: string | null }[] }>(
        `/api/${tenantSlug}/sales-channels?is_active=true`
      );
      out["sales-channel-code"] = uniqueOptions(
        (data.data ?? []).map((r) => {
          const code = String(r.code ?? "").trim();
          const name = String(r.name ?? "").trim();
          if (code) return opt(code, name ? `${name} (${code})` : code);
          return opt(name);
        })
      );
    } catch {
      out["sales-channel-code"] = [];
    }
  }

  if (need.has("warehouse-name")) {
    try {
      const { data } = await api.get<{ data?: { name: string; code?: string | null }[] }>(
        `/api/${tenantSlug}/warehouses`
      );
      out["warehouse-name"] = uniqueOptions(
        (data.data ?? []).map((r) =>
          opt(r.name, r.code ? `${r.name} (${r.code})` : r.name)
        )
      );
    } catch {
      out["warehouse-name"] = [];
    }
  }

  if (need.has("product-category-name") || need.has("product-category-parent")) {
    try {
      const { data } = await api.get<{ data?: { name: string; code?: string | null }[] }>(
        `/api/${tenantSlug}/product-categories`
      );
      const cats = uniqueOptions(
        (data.data ?? []).map((r) =>
          opt(r.name, r.code ? `${r.name} (${r.code})` : r.name)
        )
      );
      if (need.has("product-category-name")) out["product-category-name"] = cats;
      if (need.has("product-category-parent")) out["product-category-parent"] = cats;
    } catch {
      if (need.has("product-category-name")) out["product-category-name"] = [];
      if (need.has("product-category-parent")) out["product-category-parent"] = [];
    }
  }

  if (need.has("product-sku")) {
    try {
      const { data } = await api.get<{
        data?: { sku?: string; name?: string }[];
      }>(`/api/${tenantSlug}/products?limit=500`);
      out["product-sku"] = uniqueOptions(
        (data.data ?? []).map((r) => {
          const sku = String(r.sku ?? "").trim();
          if (!sku) return null;
          const name = String(r.name ?? "").trim();
          return opt(sku, name ? `${sku} — ${name}` : sku);
        })
      );
    } catch {
      out["product-sku"] = [];
    }
  }

  return out;
}

export function relationSourcesForColumns(
  columns: Array<{ relation?: RelationSource }>
): RelationSource[] {
  return [...new Set(columns.map((c) => c.relation).filter(Boolean) as RelationSource[])];
}
