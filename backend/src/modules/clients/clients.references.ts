import { prisma } from "../../config/database";
import { getRedisForApp } from "../../lib/redis-cache";
import { salesRefStoredValue } from "../sales-directions/sales-directions.service";
import {
  activeValuesFromClientRefEntries,
  buildCityTerritoryHints,
  clientRefEntriesFromUnknown,
  referencesWithResolvedTerritoryNodes,
  territoryCityStoredPairs,
  territoryRegionPickerNames,
  territoryRegionStoredPairs
} from "../tenant-settings/tenant-settings.service";
import type { ClientReferences } from "./clients.types";
import {
  mergeClientRefSelectOpts,
  mergeSalesChannelSelectOpts,
  mergeCitySelectOpts,
  normalizeDistinct
} from "./clients.helpers";

export async function getClientReferences(tenantId: number): Promise<ClientReferences> {
  const cacheKey = `tenant:${tenantId}:clients:references:v1`;
  try {
    const redis = await getRedisForApp();
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached) as ClientReferences;
  } catch {
    /* ignore */
  }

  const [clientRows, tenant, salesChannelRows, equipmentRows] = await Promise.all([
    prisma.client.findMany({
      where: { tenant_id: tenantId, merged_into_client_id: null },
      select: {
        category: true,
        client_type_code: true,
        region: true,
        district: true,
        city: true,
        neighborhood: true,
        zone: true,
        client_format: true,
        sales_channel: true,
        product_category_ref: true,
        logistics_service: true
      }
    }),
    prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { settings: true }
    }),
    prisma.salesChannelRef.findMany({
      where: { tenant_id: tenantId, is_active: true },
      select: { code: true, name: true }
    }),
    prisma.clientEquipment.findMany({
      where: { tenant_id: tenantId, removed_at: null },
      select: { equipment_kind: true, inventory_type: true }
    })
  ]);

  const settingsRefRaw = (tenant?.settings as { references?: Record<string, unknown> } | null)?.references;
  const settingsRef = settingsRefRaw
    ? referencesWithResolvedTerritoryNodes(settingsRefRaw as Record<string, unknown>)
    : undefined;
  const strArr = (k: string): string[] => {
    const v = settingsRef?.[k];
    if (!Array.isArray(v)) return [];
    return v.filter((x): x is string => typeof x === "string" && x.trim() !== "").map((s) => s.trim());
  };
  const settingsRegions = territoryRegionPickerNames(settingsRef as Record<string, unknown> | undefined);
  const catParsed = clientRefEntriesFromUnknown(settingsRef?.client_category_entries);
  const setCat =
    catParsed.length > 0 ? activeValuesFromClientRefEntries(catParsed) : strArr("client_categories");
  const typesParsed = clientRefEntriesFromUnknown(settingsRef?.client_type_entries);
  const setTypes =
    typesParsed.length > 0 ? activeValuesFromClientRefEntries(typesParsed) : strArr("client_type_codes");
  const fmtParsed = clientRefEntriesFromUnknown(settingsRef?.client_format_entries);
  const setFormats =
    fmtParsed.length > 0 ? activeValuesFromClientRefEntries(fmtParsed) : strArr("client_formats");
  const setSales = strArr("sales_channels");
  const setProdCat = strArr("client_product_category_refs");
  const setDistricts = strArr("client_districts");
  const setCities = strArr("client_cities");
  const setNeighborhoods = strArr("client_neighborhoods");
  const setZonesRef = strArr("client_zones");
  const setLogistics = strArr("client_logistics_services");

  const dbSalesLabels = salesChannelRows
    .map((r) => salesRefStoredValue(r))
    .filter((x): x is string => Boolean(x));

  const cityPairs = territoryCityStoredPairs(settingsRef as Record<string, unknown> | undefined);
  const regionPairs = territoryRegionStoredPairs(settingsRef as Record<string, unknown> | undefined);
  const cityTerritoryHints = buildCityTerritoryHints(settingsRef as Record<string, unknown> | undefined);

  /**
   * Ba'zi tenantlarda `clients.city` maydoni kod bo'lib saqlanadi (masalan `ANDIJON_SHAHAR`),
   * shahar nomi esa faqat `territory_nodes` daraxtida mavjud bo'ladi.
   *
   * `buildCityTerritoryHints()` shu daraxtdan `city_label`ni chiqaradi, lekin `city_options`
   * faqat `territoryCityStoredPairs()`ga tayanib qolsa, UI kodni ko'rsatib yuboradi.
   *
   * Shuning uchun: DBda uchragan shahar qiymatlarini hints orqali nomga bog'lab, `city_options`
   * ro'yxatiga qo'shib yuboramiz (agar mavjud bo'lsa).
   */
  const dbCityValues = new Set<string>();
  for (const r of clientRows) {
    const t = r.city?.trim();
    if (t) dbCityValues.add(t);
  }
  const hintCityPairs: { stored: string; name: string }[] = [];
  for (const cityStored of dbCityValues) {
    const hint = cityTerritoryHints[cityStored];
    const label = hint?.city_label?.trim();
    if (label && label !== cityStored) {
      hintCityPairs.push({ stored: cityStored, name: label });
    }
  }

  const equipVals = new Set<string>();
  for (const er of equipmentRows) {
    const k = er.equipment_kind?.trim();
    if (k) equipVals.add(k);
    const inv = er.inventory_type?.trim();
    if (inv) equipVals.add(inv);
  }

  const result: ClientReferences = {
    categories: normalizeDistinct([...setCat, ...clientRows.map((r) => r.category)]),
    client_type_codes: normalizeDistinct([...setTypes, ...clientRows.map((r) => r.client_type_code)]),
    regions: normalizeDistinct([...settingsRegions, ...clientRows.map((r) => r.region)]),
    districts: normalizeDistinct([...setDistricts, ...clientRows.map((r) => r.district)]),
    cities: normalizeDistinct([...setCities, ...clientRows.map((r) => r.city)]),
    neighborhoods: normalizeDistinct([...setNeighborhoods, ...clientRows.map((r) => r.neighborhood)]),
    zones: normalizeDistinct([...setZonesRef, ...clientRows.map((r) => r.zone)]),
    client_formats: normalizeDistinct([...setFormats, ...clientRows.map((r) => r.client_format)]),
    sales_channels: normalizeDistinct([
      ...setSales,
      ...dbSalesLabels,
      ...clientRows.map((r) => r.sales_channel)
    ]),
    product_category_refs: normalizeDistinct([...setProdCat, ...clientRows.map((r) => r.product_category_ref)]),
    logistics_services: normalizeDistinct([...setLogistics, ...clientRows.map((r) => r.logistics_service)]),
    equipment_filter_values: [...equipVals].sort((a, b) => a.localeCompare(b, "ru")),
    category_options: mergeClientRefSelectOpts(
      catParsed,
      strArr("client_categories"),
      clientRows.map((r) => r.category)
    ),
    client_type_options: mergeClientRefSelectOpts(
      typesParsed,
      strArr("client_type_codes"),
      clientRows.map((r) => r.client_type_code)
    ),
    client_format_options: mergeClientRefSelectOpts(
      fmtParsed,
      strArr("client_formats"),
      clientRows.map((r) => r.client_format)
    ),
    sales_channel_options: mergeSalesChannelSelectOpts(
      salesChannelRows,
      setSales,
      clientRows.map((r) => r.sales_channel)
    ),
    city_options: mergeCitySelectOpts(
      [...hintCityPairs, ...cityPairs],
      setCities,
      clientRows.map((r) => r.city)
    ),
    region_options: mergeCitySelectOpts(regionPairs, strArr("regions"), clientRows.map((r) => r.region)),
    city_territory_hints: cityTerritoryHints
  };
  try {
    const redis = await getRedisForApp();
    // references change rarely; cache longer
    await redis.set(cacheKey, JSON.stringify(result), "EX", 3600);
  } catch {
    /* ignore */
  }
  return result;
}
