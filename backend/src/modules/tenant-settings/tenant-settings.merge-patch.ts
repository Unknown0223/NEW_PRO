import type { ReturnFilterSettings } from "../returns/returns-filter.types";
import { normalizeReturnFilterSettings } from "../returns/returns-filter.settings";
import type { CurrencyEntryDto, PaymentMethodEntryDto } from "./finance-refs";
import {
  defaultCurrencyCodeFromEntries,
  normalizeCurrencyDefaults,
  paymentTypeStorageKeysFromMethodEntries,
  resolveCurrencyEntries
} from "./finance-refs";
import { activeValuesFromClientRefEntries, toClientRefEntryDto } from "./tenant-settings.refs";
import { asRecord } from "./tenant-settings.shared";
import { territoryRegionPickerNames } from "./tenant-settings.territory";
import type { BranchDto, TerritoryNodeDto, UnitMeasureDto } from "./tenant-settings.types";

/** Bo‘sh massiv bilan mavjud spravochnikni o‘chirishni bloklash. */
function rejectEmptyWipe(field: string, incoming: unknown, previous: unknown): void {
  if (!Array.isArray(incoming) || incoming.length > 0) return;
  const prevLen = Array.isArray(previous) ? previous.length : 0;
  if (prevLen > 0) {
    throw new Error(`REF_EMPTY_WIPE_REJECTED:${field}`);
  }
}

export type ProfileReferencesPatch = {
  payment_types?: string[];
  return_reasons?: string[];
  regions?: string[];
  client_categories?: string[];
  client_type_codes?: string[];
  client_formats?: string[];
  sales_channels?: string[];
  client_product_category_refs?: string[];
  client_districts?: string[];
  client_cities?: string[];
  client_neighborhoods?: string[];
  client_zones?: string[];
  client_logistics_services?: string[];
  territory_levels?: string[];
  territory_nodes?: TerritoryNodeDto[];
  unit_measures?: UnitMeasureDto[];
  branches?: BranchDto[];
  client_format_entries?: Parameters<typeof toClientRefEntryDto>[0][];
  client_type_entries?: Parameters<typeof toClientRefEntryDto>[0][];
  client_category_entries?: Parameters<typeof toClientRefEntryDto>[0][];
  territory_tree?: { zone: string; region: string; cities: string[] }[];
  currency_entries?: {
    id: string;
    name: string;
    code: string;
    sort_order?: number | null;
    active?: boolean;
    is_default?: boolean;
  }[];
  payment_method_entries?: {
    id: string;
    name: string;
    code?: string | null;
    currency_code: string;
    sort_order?: number | null;
    comment?: string | null;
    color?: string | null;
    active?: boolean;
  }[];
  price_type_entries?: {
    id: string;
    name: string;
    code?: string | null;
    payment_method_id: string;
    kind?: "sale" | "purchase";
    sort_order?: number | null;
    comment?: string | null;
    active?: boolean;
    manual?: boolean;
    attached_clients_only?: boolean;
  }[];
  request_type_entries?: Parameters<typeof toClientRefEntryDto>[0][];
  refusal_reason_entries?: Parameters<typeof toClientRefEntryDto>[0][];
  cancel_payment_reason_entries?: Parameters<typeof toClientRefEntryDto>[0][];
  order_note_entries?: Parameters<typeof toClientRefEntryDto>[0][];
  task_type_entries?: Parameters<typeof toClientRefEntryDto>[0][];
  photo_category_entries?: Parameters<typeof toClientRefEntryDto>[0][];
  finance_category_entries?: Parameters<typeof toClientRefEntryDto>[0][];
};

export type ProfileSettingsPatch = {
  feature_flags?: Record<string, unknown>;
  return_filter?: ReturnFilterSettings;
  references?: ProfileReferencesPatch;
};

/** PATCH ni serverdagi yangi `settings` JSON ustiga qo‘llaydi (qator qulfi ichida chaqiriladi). */
export function mergeProfilePatchIntoSettings(
  baseSettings: Record<string, unknown>,
  patch: ProfileSettingsPatch
): Record<string, unknown> {
  const nextSettings = { ...baseSettings };
  if (patch.return_filter != null) {
    nextSettings.return_filter = normalizeReturnFilterSettings(patch.return_filter);
  }
  if (patch.feature_flags != null) {
    nextSettings.feature_flags = {
      ...asRecord(nextSettings.feature_flags),
      ...patch.feature_flags
    };
  }
  if (patch.references != null) {
    const prevRef = asRecord(nextSettings.references);
    const merged = { ...prevRef };
    const ref = patch.references;
    if (ref.payment_types != null) {
      rejectEmptyWipe("payment_types", ref.payment_types, merged.payment_types);
      merged.payment_types = ref.payment_types;
    }
    if (ref.return_reasons != null) {
      rejectEmptyWipe("return_reasons", ref.return_reasons, merged.return_reasons);
      merged.return_reasons = ref.return_reasons;
    }
    if (ref.regions != null) {
      rejectEmptyWipe("regions", ref.regions, merged.regions);
      merged.regions = ref.regions;
    }
    if (ref.client_categories != null) {
      rejectEmptyWipe("client_categories", ref.client_categories, merged.client_categories);
      merged.client_categories = ref.client_categories;
    }
    if (ref.client_type_codes != null) {
      rejectEmptyWipe("client_type_codes", ref.client_type_codes, merged.client_type_codes);
      merged.client_type_codes = ref.client_type_codes;
    }
    if (ref.client_formats != null) {
      rejectEmptyWipe("client_formats", ref.client_formats, merged.client_formats);
      merged.client_formats = ref.client_formats;
    }
    if (ref.sales_channels != null) {
      rejectEmptyWipe("sales_channels", ref.sales_channels, merged.sales_channels);
      merged.sales_channels = ref.sales_channels;
    }
    if (ref.client_product_category_refs != null) {
      rejectEmptyWipe(
        "client_product_category_refs",
        ref.client_product_category_refs,
        merged.client_product_category_refs
      );
      merged.client_product_category_refs = ref.client_product_category_refs;
    }
    if (ref.client_districts != null) {
      rejectEmptyWipe("client_districts", ref.client_districts, merged.client_districts);
      merged.client_districts = ref.client_districts;
    }
    if (ref.client_cities != null) {
      rejectEmptyWipe("client_cities", ref.client_cities, merged.client_cities);
      merged.client_cities = ref.client_cities;
    }
    if (ref.client_neighborhoods != null) {
      rejectEmptyWipe("client_neighborhoods", ref.client_neighborhoods, merged.client_neighborhoods);
      merged.client_neighborhoods = ref.client_neighborhoods;
    }
    if (ref.client_zones != null) {
      rejectEmptyWipe("client_zones", ref.client_zones, merged.client_zones);
      merged.client_zones = ref.client_zones;
    }
    if (ref.client_logistics_services != null) {
      rejectEmptyWipe(
        "client_logistics_services",
        ref.client_logistics_services,
        merged.client_logistics_services
      );
      merged.client_logistics_services = ref.client_logistics_services;
    }
    if (ref.territory_levels != null) {
      merged.territory_levels = ref.territory_levels;
      const nodesRaw = merged.territory_nodes;
      if (nodesRaw != null && Array.isArray(nodesRaw) && nodesRaw.length > 0) {
        merged.regions = territoryRegionPickerNames(merged as Record<string, unknown>);
      }
    }
    if (ref.territory_nodes != null) {
      rejectEmptyWipe("territory_nodes", ref.territory_nodes, merged.territory_nodes);
      merged.territory_nodes = ref.territory_nodes;
      merged.regions = territoryRegionPickerNames(merged as Record<string, unknown>);
    }
    if (ref.unit_measures != null) {
      rejectEmptyWipe("unit_measures", ref.unit_measures, merged.unit_measures);
      merged.unit_measures = ref.unit_measures;
    }
    if (ref.branches != null) {
      rejectEmptyWipe("branches", ref.branches, merged.branches);
      merged.branches = ref.branches;
    }
    if (ref.client_format_entries != null) {
      rejectEmptyWipe("client_format_entries", ref.client_format_entries, merged.client_format_entries);
      const norm = ref.client_format_entries.map(toClientRefEntryDto);
      merged.client_format_entries = norm;
      merged.client_formats = activeValuesFromClientRefEntries(norm);
    }
    if (ref.client_type_entries != null) {
      rejectEmptyWipe("client_type_entries", ref.client_type_entries, merged.client_type_entries);
      const norm = ref.client_type_entries.map(toClientRefEntryDto);
      merged.client_type_entries = norm;
      merged.client_type_codes = activeValuesFromClientRefEntries(norm);
    }
    if (ref.client_category_entries != null) {
      rejectEmptyWipe("client_category_entries", ref.client_category_entries, merged.client_category_entries);
      const norm = ref.client_category_entries.map(toClientRefEntryDto);
      merged.client_category_entries = norm;
      merged.client_categories = activeValuesFromClientRefEntries(norm);
    }
    if (ref.request_type_entries != null) {
      rejectEmptyWipe("request_type_entries", ref.request_type_entries, merged.request_type_entries);
      merged.request_type_entries = ref.request_type_entries.map(toClientRefEntryDto);
    }
    if (ref.refusal_reason_entries != null) {
      rejectEmptyWipe("refusal_reason_entries", ref.refusal_reason_entries, merged.refusal_reason_entries);
      const norm = ref.refusal_reason_entries.map(toClientRefEntryDto);
      merged.refusal_reason_entries = norm;
      merged.return_reasons = activeValuesFromClientRefEntries(norm);
    }
    if (ref.cancel_payment_reason_entries != null) {
      rejectEmptyWipe(
        "cancel_payment_reason_entries",
        ref.cancel_payment_reason_entries,
        merged.cancel_payment_reason_entries
      );
      merged.cancel_payment_reason_entries = ref.cancel_payment_reason_entries.map(toClientRefEntryDto);
    }
    if (ref.order_note_entries != null) {
      rejectEmptyWipe("order_note_entries", ref.order_note_entries, merged.order_note_entries);
      merged.order_note_entries = ref.order_note_entries.map(toClientRefEntryDto);
    }
    if (ref.task_type_entries != null) {
      rejectEmptyWipe("task_type_entries", ref.task_type_entries, merged.task_type_entries);
      merged.task_type_entries = ref.task_type_entries.map(toClientRefEntryDto);
    }
    if (ref.photo_category_entries != null) {
      rejectEmptyWipe("photo_category_entries", ref.photo_category_entries, merged.photo_category_entries);
      merged.photo_category_entries = ref.photo_category_entries.map(toClientRefEntryDto);
    }
    if (ref.finance_category_entries != null) {
      rejectEmptyWipe("finance_category_entries", ref.finance_category_entries, merged.finance_category_entries);
      merged.finance_category_entries = ref.finance_category_entries.map(toClientRefEntryDto);
    }
    if (ref.territory_tree != null) merged.territory_tree = ref.territory_tree;
    if (ref.currency_entries != null) {
      rejectEmptyWipe("currency_entries", ref.currency_entries, merged.currency_entries);
      const asDto: CurrencyEntryDto[] = ref.currency_entries.map((e) => ({
        id: e.id.trim(),
        name: e.name.trim(),
        code: e.code.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 20),
        sort_order: e.sort_order ?? null,
        active: e.active ?? true,
        is_default: e.is_default ?? false
      }));
      merged.currency_entries = normalizeCurrencyDefaults(asDto);
    }
    if (ref.payment_method_entries != null) {
      rejectEmptyWipe("payment_method_entries", ref.payment_method_entries, merged.payment_method_entries);
      const cur = resolveCurrencyEntries(merged);
      const asDto: PaymentMethodEntryDto[] = ref.payment_method_entries.map((e) => {
        const codeRaw = e.code?.trim().toLowerCase() ?? "";
        const code = codeRaw && /^[a-z0-9_]+$/.test(codeRaw) ? codeRaw.slice(0, 30) : null;
        const cc =
          e.currency_code.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 20) ||
          defaultCurrencyCodeFromEntries(cur);
        return {
          id: e.id.trim(),
          name: e.name.trim(),
          code,
          currency_code: cc,
          sort_order: e.sort_order ?? null,
          comment: e.comment?.trim() || null,
          color: e.color?.trim().slice(0, 32) || null,
          active: e.active ?? true
        };
      });
      merged.payment_method_entries = asDto;
      merged.payment_types = paymentTypeStorageKeysFromMethodEntries(asDto);
    }
    if (ref.price_type_entries != null) {
      rejectEmptyWipe("price_type_entries", ref.price_type_entries, merged.price_type_entries);
      merged.price_type_entries = ref.price_type_entries.map((e) => ({
        id: e.id.trim(),
        name: e.name.trim(),
        code: e.code?.trim()
          ? e.code.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 20) || null
          : null,
        payment_method_id: e.payment_method_id.trim(),
        kind: e.kind === "purchase" ? "purchase" : "sale",
        sort_order: e.sort_order ?? null,
        comment: e.comment?.trim() || null,
        active: e.active ?? true,
        manual: e.manual ?? false,
        attached_clients_only: e.attached_clients_only ?? false
      }));
    }
    nextSettings.references = merged;
  }
  return nextSettings;
}
