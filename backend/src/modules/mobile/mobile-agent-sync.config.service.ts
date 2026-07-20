import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { MOBILE_FIELD_ROLES } from "../../lib/constants";
import { parseVisitWeekdaysJson } from "../clients/clients.types";
import {
  evaluateMobileSyncPolicy,
  syncWindowMessage
} from "../staff/agent-mobile-config.sync-policy";
import {
  extractMobileConfigFromEntitlementsUnknown,
  type AgentMobileConfigV1
} from "../staff/agent-mobile-config";
import { getTenantProfile } from "../tenant-settings/tenant-settings.service";
import {
  referencesWithResolvedTerritoryNodes,
  territoryRegionPickerNames,
  type CityTerritoryHintDto
} from "../tenant-settings/tenant-settings.territory";
import { paymentMethodStorageKey, priceTypeEntriesFromUnknown, priceTypeKey } from "../tenant-settings/finance-refs";
import { asRecord } from "../tenant-settings/tenant-settings.shared";
import { territoryNodesFromUnknown } from "../tenant-settings/tenant-settings.refs";
import { loadActiveWorkSlotsByUserIds } from "../work-slots/work-slots.query";
import { resolveAppUpdateForTenant } from "./app-release.service";
import { getMobileAgentAssignedCities } from "./mobile-agent-cities";
import { mergeMobileCitiesByZoneRegion } from "./mobile-territory-references";

export function agentScopedClientWhere(
  tenantId: number,
  agentId: number
): Prisma.ClientWhereInput {
  return {
    tenant_id: tenantId,
    merged_into_client_id: null,
    OR: [{ agent_id: agentId }, { agent_assignments: { some: { agent_id: agentId } } }]
  };
}

export function agentScopedOrderWhere(tenantId: number, agentId: number): Prisma.OrderWhereInput {
  return { tenant_id: tenantId, agent_id: agentId };
}

/** Ish mintaqasi (UTC+5) — mobil `workRegionNow` bilan bir xil. */
const WORK_REGION_UTC_OFFSET_HOURS = 5;

export function workRegionTodayKey(d = new Date()): string {
  const wr = new Date(d.getTime() + WORK_REGION_UTC_OFFSET_HOURS * 3_600_000);
  return wr.toISOString().slice(0, 10);
}

export function workRegionDayRange(dateStr: string): { start: Date; end: Date } {
  const [y, m, d] = dateStr.split("-").map((x) => Number.parseInt(x, 10));
  const start = new Date(Date.UTC(y, m - 1, d, -WORK_REGION_UTC_OFFSET_HOURS, 0, 0, 0));
  const end = new Date(Date.UTC(y, m - 1, d, 24 - WORK_REGION_UTC_OFFSET_HOURS - 1, 59, 59, 999));
  return { start, end };
}

export function localTodayRange(): { start: Date; end: Date } {
  return workRegionDayRange(workRegionTodayKey());
}

export function monthUtcRange(d = new Date()): { start: Date; end: Date } {
  const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1, 0, 0, 0, 0));
  return { start, end };
}

export async function loadAgentMobileConfig(
  tenantId: number,
  userId: number
): Promise<AgentMobileConfigV1 | null> {
  const u = await prisma.user.findFirst({
    where: { id: userId, tenant_id: tenantId, is_active: true },
    select: { agent_entitlements: true }
  });
  return extractMobileConfigFromEntitlementsUnknown(u?.agent_entitlements) ?? null;
}

export async function assertAgentScopedClient(
  tenantId: number,
  agentId: number,
  clientId: number
): Promise<void> {
  const hit = await prisma.client.findFirst({
    where: { id: clientId, ...agentScopedClientWhere(tenantId, agentId), is_active: true },
    select: { id: true }
  });
  if (!hit) throw new Error("BAD_CLIENT");
}

export async function assertMobilePhotoReportForClient(
  tenantId: number,
  userId: number,
  clientId: number,
  cfg: AgentMobileConfigV1 | null
): Promise<void> {
  const required =
    cfg?.photo?.required_for_order === true ||
    cfg?.expeditor?.require_photo_report_before_visit === true;
  if (!required) return;
  const { start, end } = localTodayRange();
  const hit = await prisma.clientPhotoReport.findFirst({
    where: {
      tenant_id: tenantId,
      client_id: clientId,
      created_by_user_id: userId,
      deleted_at: null,
      created_at: { gte: start, lte: end }
    },
    select: { id: true }
  });
  if (!hit) throw new Error("PHOTO_REPORT_REQUIRED");
}

export function normalizePhotoBase64Url(raw: string): string {
  const t = raw.trim();
  if (t.startsWith("data:")) return t;
  return `data:image/jpeg;base64,${t}`;
}

export type PresenceOpts = {
  device_name?: string | null;
  user_agent?: string | null;
  apk_version?: string | null;
};

export async function applyMobileSyncGate(
  tenantId: number,
  userId: number,
  presence?: PresenceOpts
): Promise<void> {
  if (presence) {
    await reportMobilePresence(userId, presence);
  }
  const cfg = await loadAgentMobileConfig(tenantId, userId);
  const policy = evaluateMobileSyncPolicy(cfg?.sync);
  if (!policy.allowed) {
    throw new Error(`SYNC_NOT_ALLOWED:${policy.message ?? syncWindowMessage(cfg?.sync ?? {})}`);
  }
}

export type CompactClientRow = {
  id: number;
  name: string;
  address: string | null;
  phone: string | null;
  inn: string | null;
  latitude: number | null;
  longitude: number | null;
  is_active: boolean;
  category: string | null;
  client_code: string | null;
  sales_channel: string | null;
  updated_at: Date;
  legal_name?: string | null;
  client_type_code?: string | null;
  region?: string | null;
  zone?: string | null;
  city?: string | null;
  bank_name?: string | null;
  bank_mfo?: string | null;
  oked?: string | null;
  client_pinfl?: string | null;
  contract_number?: string | null;
  notes?: string | null;
  visit_date?: string | null;
  visit_weekdays?: number[];
  balance?: number | null;
  credit_limit?: Prisma.Decimal | null;
  client_balances?: { balance: Prisma.Decimal }[];
  agent_assignments?: { visit_weekdays: unknown; visit_date?: Date | string | null }[];
};

export function compactClient(c: CompactClientRow) {
  const ledger = c.client_balances?.[0]?.balance;
  const assignment = c.agent_assignments?.[0];
  const weekdays =
    parseVisitWeekdaysJson(assignment?.visit_weekdays) ||
    parseVisitWeekdaysJson(c.visit_weekdays);
  const visitDate =
    assignment?.visit_date != null
      ? assignment.visit_date instanceof Date
        ? assignment.visit_date.toISOString()
        : String(assignment.visit_date)
      : c.visit_date ?? null;
  return {
    id: c.id,
    name: c.name,
    address: c.address,
    phone: c.phone,
    inn: c.inn,
    latitude: c.latitude != null ? Number(c.latitude) : null,
    longitude: c.longitude != null ? Number(c.longitude) : null,
    is_active: c.is_active,
    category: c.category,
    client_code: c.client_code,
    sales_channel: c.sales_channel,
    updated_at: c.updated_at,
    legal_name: c.legal_name ?? null,
    client_type_code: c.client_type_code ?? null,
    region: c.region ?? null,
    zone: c.zone ?? null,
    city: c.city ?? null,
    bank_name: c.bank_name ?? null,
    bank_mfo: c.bank_mfo ?? null,
    oked: c.oked ?? null,
    client_pinfl: c.client_pinfl ?? null,
    contract_number: c.contract_number ?? null,
    notes: c.notes ?? null,
    visit_date: visitDate,
    ...(weekdays.length ? { visit_weekdays: weekdays } : {}),
    balance: ledger != null ? Number(ledger) : null,
    credit_limit: c.credit_limit != null ? Number(c.credit_limit) : null
  };
}

export const clientSyncSelectBase = {
  id: true,
  name: true,
  address: true,
  phone: true,
  inn: true,
  latitude: true,
  longitude: true,
  is_active: true,
  category: true,
  client_code: true,
  sales_channel: true,
  updated_at: true,
  legal_name: true,
  client_type_code: true,
  region: true,
  zone: true,
  city: true,
  bank_name: true,
  bank_mfo: true,
  oked: true,
  client_pinfl: true,
  contract_number: true,
  notes: true,
  visit_date: true,
  credit_limit: true,
  client_balances: { select: { balance: true }, take: 1 }
} as const;

/** Mobil sync — joriy agentning slotidagi tashrif jadvali (slot:1 emas, agent_id bo‘yicha). */
export function clientSyncSelectForAgent(agentId: number) {
  return {
    ...clientSyncSelectBase,
    agent_assignments: {
      where: { agent_id: agentId },
      select: { visit_weekdays: true, visit_date: true },
      take: 1
    }
  };
}

/** @deprecated Admin/ko‘rish — mobil sync uchun `clientSyncSelectForAgent` ishlating. */
export const clientSyncSelect = {
  ...clientSyncSelectBase,
  agent_assignments: {
    where: { slot: 1 },
    select: { visit_weekdays: true, visit_date: true },
    take: 1
  }
} as const;

export async function registerFcmToken(
  tenantId: number,
  userId: number,
  token: string,
  deviceType: "android" | "ios" | "web"
) {
  await prisma.deviceToken.upsert({
    where: { user_id_fcm_token: { user_id: userId, fcm_token: token } },
    create: {
      tenant_id: tenantId,
      user_id: userId,
      fcm_token: token,
      device_type: deviceType
    },
    update: {
      tenant_id: tenantId,
      device_type: deviceType,
      updated_at: new Date()
    }
  });
  return { ok: true };
}

export async function reportMobilePresence(
  userId: number,
  input: PresenceOpts
): Promise<Date> {
  const now = new Date();
  await prisma.user.update({
    where: { id: userId },
    data: {
      device_name: input.device_name?.trim().slice(0, 255) || null,
      apk_version: input.apk_version?.trim().slice(0, 64) || null,
      last_sync_at: now
    }
  });
  return now;
}

async function loadMobileTenantReferences(tenantId: number) {
  const profile = await getTenantProfile(tenantId);
  const ref = profile.references;
  const refT = referencesWithResolvedTerritoryNodes(ref as unknown as Record<string, unknown>);
  const territoryNodes = territoryNodesFromUnknown(refT.territory_nodes);
  const hints: Record<string, CityTerritoryHintDto> = {};
  const tenantRow = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { settings: true }
  });
  const st = asRecord(tenantRow?.settings);
  const refInner = asRecord(st.references);
  const citiesByZoneRegion = mergeMobileCitiesByZoneRegion({
    fromTree: {},
    fromClientRows: {},
    cities: ref.client_cities ?? [],
    hints
  });

  const priceTypeOptions = priceTypeEntriesFromUnknown(ref.price_type_entries)
    .filter((e) => e.active !== false && e.kind === "sale")
    .map((e) => {
      const id = priceTypeKey(e).trim();
      const label = e.name.trim() || id;
      return { id, label, code: e.code ?? null };
    })
    .filter((o) => o.id.length > 0);

  return {
    refusal_reason_entries: (ref.refusal_reason_entries ?? []).map((e) => ({
      id: e.id,
      name: e.name,
      code: e.code ?? null
    })),
    photo_category_entries: (ref.photo_category_entries ?? []).map((e) => ({
      id: e.id,
      name: e.name,
      code: e.code ?? null
    })),
    payment_methods: (ref.payment_method_entries ?? []).map((e) => ({
      id: e.id,
      name: e.name,
      payment_type: paymentMethodStorageKey(e),
      code: e.code ?? null
    })),
    /** Mobil «Тип цены» dropdown — id=DB kaliti, label=katalog nomi */
    price_type_options: priceTypeOptions,
    client_categories: ref.client_categories ?? [],
    client_type_codes: ref.client_type_codes ?? [],
    sales_channels: ref.sales_channels ?? [],
    regions: territoryRegionPickerNames(refInner),
    zones: ref.client_zones ?? [],
    cities: ref.client_cities ?? [],
    territory_nodes: territoryNodes,
    territory_cascade: citiesByZoneRegion
  };
}

/** Mobil ilova: agent | expeditor | supervisor — `mobile_config` + entitlements. */
export async function getMobileAgentConfigPayload(
  tenantId: number,
  userId: number,
  clientVersion?: string
) {
  const u = await prisma.user.findFirst({
    where: { id: userId, tenant_id: tenantId, is_active: true },
    select: {
      id: true,
      role: true,
      agent_entitlements: true,
      consignment: true,
      consignment_limit_amount: true
    }
  });
  if (!u || !MOBILE_FIELD_ROLES.has(u.role)) {
    return { ok: false as const, error: "NotAgent" as const };
  }

  const slotMap = await loadActiveWorkSlotsByUserIds([userId]);
  const slot = slotMap.get(userId) ?? null;
  const profile = await getTenantProfile(tenantId);
  const refInner = profile.references as unknown as Record<string, unknown>;
  const refT = referencesWithResolvedTerritoryNodes(refInner);
  const territoryNodes = territoryNodesFromUnknown(refT.territory_nodes);
  const hints: Record<string, CityTerritoryHintDto> = {};
  const tenantRow = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { settings: true, slug: true }
  });
  const st = asRecord(tenantRow?.settings);
  const citiesByZoneRegion = mergeMobileCitiesByZoneRegion({
    fromTree: {},
    fromClientRows: {},
    cities: profile.references.client_cities ?? [],
    hints
  });

  const agentCities =
    u.role === "agent"
      ? await getMobileAgentAssignedCities(tenantId, userId, hints, {
          territoryNodes,
          citiesByZoneRegion,
          allTenantCities: profile.references.client_cities ?? []
        })
      : [];

  const appUpdate = await resolveAppUpdateForTenant(tenantId, clientVersion, "android", {
    tenantSlug: tenantRow?.slug
  });

  return {
    ok: true as const,
    user_id: u.id,
    mobile_config: extractMobileConfigFromEntitlementsUnknown(u.agent_entitlements) ?? null,
    agent_entitlements: u.agent_entitlements,
    agent_limits: {
      consignment: u.consignment === true,
      consignment_limit_amount: u.consignment_limit_amount?.toString() ?? null
    },
    work_slot_id: slot?.slot_id ?? null,
    work_slot_code: slot?.slot_code ?? null,
    tenant_references: await loadMobileTenantReferences(tenantId),
    agent_cities: agentCities,
    ...(appUpdate ? { app_update: appUpdate } : {})
  };
}
