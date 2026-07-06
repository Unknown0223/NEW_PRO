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
    if (ref.payment_types != null) merged.payment_types = ref.payment_types;
    if (ref.return_reasons != null) merged.return_reasons = ref.return_reasons;
    if (ref.regions != null) merged.regions = ref.regions;
    if (ref.client_categories != null) merged.client_categories = ref.client_categories;
    if (ref.client_type_codes != null) merged.client_type_codes = ref.client_type_codes;
    if (ref.client_formats != null) merged.client_formats = ref.client_formats;
    if (ref.sales_channels != null) merged.sales_channels = ref.sales_channels;
    if (ref.client_product_category_refs != null) {
      merged.client_product_category_refs = ref.client_product_category_refs;
    }
    if (ref.client_districts != null) merged.client_districts = ref.client_districts;
    if (ref.client_cities != null) merged.client_cities = ref.client_cities;
    if (ref.client_neighborhoods != null) merged.client_neighborhoods = ref.client_neighborhoods;
    if (ref.client_zones != null) merged.client_zones = ref.client_zones;
    if (ref.client_logistics_services != null) merged.client_logistics_services = ref.client_logistics_services;
    if (ref.territory_levels != null) {
      merged.territory_levels = ref.territory_levels;
      const nodesRaw = merged.territory_nodes;
      if (nodesRaw != null && Array.isArray(nodesRaw) && nodesRaw.length > 0) {
        merged.regions = territoryRegionPickerNames(merged as Record<string, unknown>);
      }
    }
    if (ref.territory_nodes != null) {
      merged.territory_nodes = ref.territory_nodes;
      merged.regions = territoryRegionPickerNames(merged as Record<string, unknown>);
    }
    if (ref.unit_measures != null) merged.unit_measures = ref.unit_measures;
    if (ref.branches != null) merged.branches = ref.branches;
    if (ref.client_format_entries != null) {
      const norm = ref.client_format_entries.map(toClientRefEntryDto);
      merged.client_format_entries = norm;
      merged.client_formats = activeValuesFromClientRefEntries(norm);
    }
    if (ref.client_type_entries != null) {
      const norm = ref.client_type_entries.map(toClientRefEntryDto);
      merged.client_type_entries = norm;
      merged.client_type_codes = activeValuesFromClientRefEntries(norm);
    }
    if (ref.client_category_entries != null) {
      const norm = ref.client_category_entries.map(toClientRefEntryDto);
      merged.client_category_entries = norm;
      merged.client_categories = activeValuesFromClientRefEntries(norm);
    }
    if (ref.request_type_entries != null) {
      merged.request_type_entries = ref.request_type_entries.map(toClientRefEntryDto);
    }
    if (ref.refusal_reason_entries != null) {
      const norm = ref.refusal_reason_entries.map(toClientRefEntryDto);
      merged.refusal_reason_entries = norm;
      merged.return_reasons = activeValuesFromClientRefEntries(norm);
    }
    if (ref.cancel_payment_reason_entries != null) {
      merged.cancel_payment_reason_entries = ref.cancel_payment_reason_entries.map(toClientRefEntryDto);
    }
    if (ref.order_note_entries != null) {
      merged.order_note_entries = ref.order_note_entries.map(toClientRefEntryDto);
    }
    if (ref.task_type_entries != null) {
      merged.task_type_entries = ref.task_type_entries.map(toClientRefEntryDto);
    }
    if (ref.photo_category_entries != null) {
      merged.photo_category_entries = ref.photo_category_entries.map(toClientRefEntryDto);
    }
    if (ref.finance_category_entries != null) {
      merged.finance_category_entries = ref.finance_category_entries.map(toClientRefEntryDto);
    }
    if (ref.territory_tree != null) merged.territory_tree = ref.territory_tree;
    if (ref.currency_entries != null) {
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
