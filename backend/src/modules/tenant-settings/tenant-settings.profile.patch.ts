import type { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { invalidatePriceTypesCache } from "../../lib/redis-cache";
import { appendTenantAuditEvent, AuditEntityType } from "../../lib/tenant-audit";
import { asRecord } from "./tenant-settings.shared";
import type {
  BranchDto,
  TerritoryNodeDto,
  TenantProfileDto,
  UnitMeasureDto
} from "./tenant-settings.types";
import type { CurrencyEntryDto, PaymentMethodEntryDto } from "./finance-refs";
import {
  defaultCurrencyCodeFromEntries,
  normalizeCurrencyDefaults,
  paymentTypeStorageKeysFromMethodEntries,
  resolveCurrencyEntries
} from "./finance-refs";
import {
  activeValuesFromClientRefEntries,
  assertBranchCashDeskAssignments,
  toClientRefEntryDto
} from "./tenant-settings.refs";
import { territoryRegionPickerNames } from "./tenant-settings.territory";
import { getRedisForApp, tenantSettingsCacheKey } from "../../lib/redis-cache";
import { getTenantProfile } from "./tenant-settings.profile.read";

type ClientRefEntryPatch = {
  id: string;
  name: string;
  code?: string | null;
  sort_order?: number | null;
  comment?: string | null;
  active?: boolean;
  color?: string | null;
};

type CurrencyEntryPatch = {
  id: string;
  name: string;
  code: string;
  sort_order?: number | null;
  active?: boolean;
  is_default?: boolean;
};

type PaymentMethodEntryPatch = {
  id: string;
  name: string;
  code?: string | null;
  currency_code: string;
  sort_order?: number | null;
  comment?: string | null;
  color?: string | null;
  active?: boolean;
};

type PriceTypeEntryPatch = {
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
};

export async function patchTenantProfile(
  tenantId: number,
  patch: Partial<{
    name: string;
    phone: string | null;
    address: string | null;
    logo_url: string | null;
    feature_flags: Record<string, unknown>;
    references: {
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
      client_format_entries?: ClientRefEntryPatch[];
      client_type_entries?: ClientRefEntryPatch[];
      client_category_entries?: ClientRefEntryPatch[];
      territory_tree?: { zone: string; region: string; cities: string[] }[];
      currency_entries?: CurrencyEntryPatch[];
      payment_method_entries?: PaymentMethodEntryPatch[];
      price_type_entries?: PriceTypeEntryPatch[];
      request_type_entries?: ClientRefEntryPatch[];
      refusal_reason_entries?: ClientRefEntryPatch[];
      cancel_payment_reason_entries?: ClientRefEntryPatch[];
      order_note_entries?: ClientRefEntryPatch[];
      task_type_entries?: ClientRefEntryPatch[];
      photo_category_entries?: ClientRefEntryPatch[];
      finance_category_entries?: ClientRefEntryPatch[];
    };
  }>,
  actorUserId: number | null = null
): Promise<TenantProfileDto> {
  const row = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { name: true, phone: true, address: true, logo_url: true, settings: true }
  });
  if (!row) {
    throw new Error("NOT_FOUND");
  }

  const data: Prisma.TenantUpdateInput = {};
  if (patch.name !== undefined) {
    data.name = patch.name.trim();
  }
  if (patch.phone !== undefined) {
    data.phone = patch.phone?.trim() || null;
  }
  if (patch.address !== undefined) {
    data.address = patch.address?.trim() || null;
  }
  if (patch.logo_url !== undefined) {
    data.logo_url = patch.logo_url?.trim() || null;
  }

  if (patch.feature_flags != null || patch.references != null) {
    const nextSettings = { ...asRecord(row.settings) };
    if (patch.feature_flags != null) {
      nextSettings.feature_flags = {
        ...asRecord(nextSettings.feature_flags),
        ...patch.feature_flags
      };
    }
    if (patch.references != null) {
      const prevRef = asRecord(nextSettings.references);
      const merged = { ...prevRef };
      if (patch.references.payment_types != null) {
        merged.payment_types = patch.references.payment_types;
      }
      if (patch.references.return_reasons != null) {
        merged.return_reasons = patch.references.return_reasons;
      }
      if (patch.references.regions != null) {
        merged.regions = patch.references.regions;
      }
      if (patch.references.client_categories != null) {
        merged.client_categories = patch.references.client_categories;
      }
      if (patch.references.client_type_codes != null) {
        merged.client_type_codes = patch.references.client_type_codes;
      }
      if (patch.references.client_formats != null) {
        merged.client_formats = patch.references.client_formats;
      }
      if (patch.references.sales_channels != null) {
        merged.sales_channels = patch.references.sales_channels;
      }
      if (patch.references.client_product_category_refs != null) {
        merged.client_product_category_refs = patch.references.client_product_category_refs;
      }
      if (patch.references.client_districts != null) {
        merged.client_districts = patch.references.client_districts;
      }
      if (patch.references.client_cities != null) {
        merged.client_cities = patch.references.client_cities;
      }
      if (patch.references.client_neighborhoods != null) {
        merged.client_neighborhoods = patch.references.client_neighborhoods;
      }
      if (patch.references.client_zones != null) {
        merged.client_zones = patch.references.client_zones;
      }
      if (patch.references.client_logistics_services != null) {
        merged.client_logistics_services = patch.references.client_logistics_services;
      }
      if (patch.references.territory_levels != null) {
        merged.territory_levels = patch.references.territory_levels;
        const nodesRaw = merged.territory_nodes;
        if (nodesRaw != null && Array.isArray(nodesRaw) && nodesRaw.length > 0) {
          merged.regions = territoryRegionPickerNames(merged as Record<string, unknown>);
        }
      }
      if (patch.references.territory_nodes != null) {
        merged.territory_nodes = patch.references.territory_nodes;
        merged.regions = territoryRegionPickerNames(merged as Record<string, unknown>);
      }
      if (patch.references.unit_measures != null) {
        merged.unit_measures = patch.references.unit_measures;
      }
      if (patch.references.branches != null) {
        await assertBranchCashDeskAssignments(tenantId, patch.references.branches);
        merged.branches = patch.references.branches;
      }
      if (patch.references.client_format_entries != null) {
        const norm = patch.references.client_format_entries.map(toClientRefEntryDto);
        merged.client_format_entries = norm;
        merged.client_formats = activeValuesFromClientRefEntries(norm);
      }
      if (patch.references.client_type_entries != null) {
        const norm = patch.references.client_type_entries.map(toClientRefEntryDto);
        merged.client_type_entries = norm;
        merged.client_type_codes = activeValuesFromClientRefEntries(norm);
      }
      if (patch.references.client_category_entries != null) {
        const norm = patch.references.client_category_entries.map(toClientRefEntryDto);
        merged.client_category_entries = norm;
        merged.client_categories = activeValuesFromClientRefEntries(norm);
      }
      if (patch.references.request_type_entries != null) {
        merged.request_type_entries = patch.references.request_type_entries.map(toClientRefEntryDto);
      }
      if (patch.references.refusal_reason_entries != null) {
        const norm = patch.references.refusal_reason_entries.map(toClientRefEntryDto);
        merged.refusal_reason_entries = norm;
        merged.return_reasons = activeValuesFromClientRefEntries(norm);
      }
      if (patch.references.cancel_payment_reason_entries != null) {
        merged.cancel_payment_reason_entries =
          patch.references.cancel_payment_reason_entries.map(toClientRefEntryDto);
      }
      if (patch.references.order_note_entries != null) {
        merged.order_note_entries = patch.references.order_note_entries.map(toClientRefEntryDto);
      }
      if (patch.references.task_type_entries != null) {
        merged.task_type_entries = patch.references.task_type_entries.map(toClientRefEntryDto);
      }
      if (patch.references.photo_category_entries != null) {
        merged.photo_category_entries = patch.references.photo_category_entries.map(toClientRefEntryDto);
      }
      if (patch.references.finance_category_entries != null) {
        merged.finance_category_entries = patch.references.finance_category_entries.map(toClientRefEntryDto);
      }
      if (patch.references.territory_tree != null) {
        merged.territory_tree = patch.references.territory_tree;
      }
      if (patch.references.currency_entries != null) {
        const asDto: CurrencyEntryDto[] = patch.references.currency_entries.map((e) => ({
          id: e.id.trim(),
          name: e.name.trim(),
          code: e.code.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 20),
          sort_order: e.sort_order ?? null,
          active: e.active ?? true,
          is_default: e.is_default ?? false
        }));
        merged.currency_entries = normalizeCurrencyDefaults(asDto);
      }
      if (patch.references.payment_method_entries != null) {
        const cur = resolveCurrencyEntries(merged);
        const asDto: PaymentMethodEntryDto[] = patch.references.payment_method_entries.map((e) => {
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
      if (patch.references.price_type_entries != null) {
        merged.price_type_entries = patch.references.price_type_entries.map((e) => ({
          id: e.id.trim(),
          name: e.name.trim(),
          code: e.code?.trim()
            ? e.code.trim().toUpperCase().replace(/[^A-Z0-9_]/g, "").slice(0, 20) || null
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
    data.settings = nextSettings as Prisma.InputJsonValue;
  }

  if (Object.keys(data).length > 0) {
    await prisma.tenant.update({
      where: { id: tenantId },
      data
    });
    const refPatch = patch.references;
    const referencesKeys =
      refPatch != null && typeof refPatch === "object"
        ? Object.keys(refPatch).filter((k) => (refPatch as Record<string, unknown>)[k] !== undefined)
        : undefined;

    await appendTenantAuditEvent({
      tenantId,
      actorUserId,
      entityType: AuditEntityType.tenant_settings,
      entityId: tenantId,
      action: "patch.profile",
      payload: {
        changed_keys: Object.keys(patch),
        ...(referencesKeys?.length ? { references_keys: referencesKeys } : {})
      }
    });
    if (patch.references?.price_type_entries != null) {
      void invalidatePriceTypesCache(tenantId);
    }
    if (patch.references?.territory_nodes != null || patch.references?.territory_tree != null) {
      void import("../access/access-territories-sync").then((m) => m.invalidateAccessTerritorySyncCache(tenantId));
    }
  }

  try {
    const redis = await getRedisForApp();
    await redis.del(tenantSettingsCacheKey(tenantId));
  } catch {
    /* ignore */
  }
  return getTenantProfile(tenantId);
}

