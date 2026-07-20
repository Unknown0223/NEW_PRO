import { prisma } from "../../config/database";
import { getAppCache, setAppCache, tenantSettingsCacheKey } from "../../lib/redis-cache";
import { asRecord } from "./tenant-settings.shared";
import type { BranchDto, TenantProfileDto } from "./tenant-settings.types";
import type { PaymentMethodEntryDto, PriceTypeEntryDto } from "./finance-refs";
import {
  defaultCurrencyCodeFromEntries,
  paymentTypeStorageKeysFromMethodEntries,
  priceTypeEntriesFromUnknown,
  resolveCurrencyEntries,
  resolvePaymentMethodEntries
} from "./finance-refs";
import {
  listActiveSalesChannelLabels,
  listActiveTradeDirectionLabels
} from "../sales-directions/sales-directions.service";
import {
  activeValuesFromClientRefEntries,
  branchesFromUnknown,
  clientRefEntriesFromUnknown,
  resolveClientRefEntries,
  resolveRefusalReasonEntries,
  stringArrayFromUnknown,
  territoryNodesFromUnknown,
  territoryTreeFromUnknown,
  unitMeasuresFromUnknown
} from "./tenant-settings.refs";
import {
  referencesWithResolvedTerritoryNodes,
  territoryRegionPickerNames
} from "./tenant-settings.territory";
import { normalizeReturnFilterSettings } from "../returns/returns-filter.settings";

export async function getTenantDefaultCurrencyCode(tenantId: number): Promise<string> {
  const row = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { settings: true }
  });
  const st = asRecord(row?.settings);
  const refInner = asRecord(st.references);
  return defaultCurrencyCodeFromEntries(resolveCurrencyEntries(refInner));
}

/** Vedoma / zakaz kartasi: `payment_method_ref` → nom (barcha yozuvlar, jumladan nofaol). */
export async function loadPaymentMethodEntriesForResolve(tenantId: number): Promise<PaymentMethodEntryDto[]> {
  const row = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { settings: true }
  });
  const st = asRecord(row?.settings);
  const ref = asRecord(st.references);
  const currency_entries = resolveCurrencyEntries(ref);
  return resolvePaymentMethodEntries(ref, currency_entries);
}

/** Jadval/hisobot: `price_type` kaliti → nom (barcha yozuvlar, jumladan nofaol). */
export async function loadPriceTypeEntriesForResolve(tenantId: number): Promise<PriceTypeEntryDto[]> {
  const row = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { settings: true }
  });
  const st = asRecord(row?.settings);
  const ref = asRecord(st.references);
  return priceTypeEntriesFromUnknown(ref.price_type_entries);
}

/** «Доступ» → филиалы: `tenant.settings.references.branches` (аналог `CashDesk` для касс). */
export async function loadTenantBranchesForAccess(tenantId: number): Promise<BranchDto[]> {
  const row = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { settings: true }
  });
  const st = asRecord(row?.settings);
  const ref = asRecord(st.references);
  return branchesFromUnknown(ref.branches);
}

export async function getTenantProfile(tenantId: number): Promise<TenantProfileDto> {
  const cacheKey = tenantSettingsCacheKey(tenantId);
  const cached = await getAppCache<TenantProfileDto>(cacheKey);
  if (cached) return cached;

  const row = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { name: true, phone: true, address: true, logo_url: true, settings: true }
  });
  if (!row) {
    throw new Error("NOT_FOUND");
  }
  const st = asRecord(row.settings);
  const ff = asRecord(st.feature_flags);
  const ref = asRecord(st.references);
  const refT = referencesWithResolvedTerritoryNodes(ref);
  const territory_nodes = territoryNodesFromUnknown(refT.territory_nodes);
  const territory_tree = territoryTreeFromUnknown(ref.territory_tree);
  const client_formats = stringArrayFromUnknown(ref.client_formats);
  const client_type_codes = stringArrayFromUnknown(ref.client_type_codes);
  const client_categories = stringArrayFromUnknown(ref.client_categories);
  const currency_entries = resolveCurrencyEntries(ref);
  const payment_method_entries = resolvePaymentMethodEntries(ref, currency_entries);
  const price_type_entries = priceTypeEntriesFromUnknown(ref.price_type_entries);

  const refusal_reason_entries = resolveRefusalReasonEntries(ref);

  const [dbSalesLabels, dbTradeLabels] = await Promise.all([
    listActiveSalesChannelLabels(tenantId),
    listActiveTradeDirectionLabels(tenantId)
  ]);

  const profile: TenantProfileDto = {
    name: row.name,
    phone: row.phone,
    address: row.address,
    logo_url: row.logo_url,
    feature_flags: ff,
    return_filter: normalizeReturnFilterSettings(st.return_filter),
    references: {
      payment_types:
        payment_method_entries.length > 0
          ? paymentTypeStorageKeysFromMethodEntries(payment_method_entries)
          : stringArrayFromUnknown(ref.payment_types),
      return_reasons: activeValuesFromClientRefEntries(refusal_reason_entries),
      regions:
        territory_nodes.length > 0
          ? territoryRegionPickerNames(refT as Record<string, unknown>)
          : stringArrayFromUnknown(ref.regions),
      client_categories,
      client_type_codes,
      client_formats,
      client_format_entries: resolveClientRefEntries(ref, "client_format_entries", client_formats, "fmt"),
      client_type_entries: resolveClientRefEntries(ref, "client_type_entries", client_type_codes, "typ"),
      client_category_entries: resolveClientRefEntries(ref, "client_category_entries", client_categories, "cat"),
      sales_channels: dbSalesLabels,
      trade_directions: dbTradeLabels,
      client_product_category_refs: stringArrayFromUnknown(ref.client_product_category_refs),
      client_districts: stringArrayFromUnknown(ref.client_districts),
      client_cities: stringArrayFromUnknown(ref.client_cities),
      client_neighborhoods: stringArrayFromUnknown(ref.client_neighborhoods),
      client_zones: stringArrayFromUnknown(ref.client_zones),
      client_logistics_services: stringArrayFromUnknown(ref.client_logistics_services),
      territory_levels: stringArrayFromUnknown(ref.territory_levels),
      territory_nodes,
      unit_measures: unitMeasuresFromUnknown(ref.unit_measures),
      branches: branchesFromUnknown(ref.branches),
      territory_tree,
      currency_entries,
      payment_method_entries,
      price_type_entries,
      refusal_reason_entries,
      request_type_entries: clientRefEntriesFromUnknown(ref.request_type_entries),
      cancel_payment_reason_entries: clientRefEntriesFromUnknown(ref.cancel_payment_reason_entries),
      order_note_entries: clientRefEntriesFromUnknown(ref.order_note_entries),
      task_type_entries: clientRefEntriesFromUnknown(ref.task_type_entries),
      photo_category_entries: clientRefEntriesFromUnknown(ref.photo_category_entries),
      finance_category_entries: clientRefEntriesFromUnknown(ref.finance_category_entries)
    }
  };
  await setAppCache(cacheKey, profile, 3600);
  return profile;
}
