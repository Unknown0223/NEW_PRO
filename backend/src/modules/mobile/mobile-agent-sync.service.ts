import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { parseVisitWeekdaysJson } from "../clients/clients.types";
import { ORDER_STATUSES_EXCLUDED_FROM_CREDIT_EXPOSURE } from "../orders/order-status";
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
import { paymentMethodStorageKey } from "../tenant-settings/finance-refs";
import { asRecord } from "../tenant-settings/tenant-settings.shared";
import { territoryNodesFromUnknown } from "../tenant-settings/tenant-settings.refs";
import { loadActiveWorkSlotsByUserIds } from "../work-slots/work-slots.query";
import { resolveAppUpdateForTenant } from "./app-release.service";
import { getMobileAgentAssignedCities } from "./mobile-agent-cities";
import { mergeMobileCitiesByZoneRegion } from "./mobile-territory-references";

const MOBILE_SYNC_CLIENT_LIMIT = 50;

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

export function localTodayRange(): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  return { start, end };
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

type PresenceOpts = {
  device_name?: string | null;
  user_agent?: string | null;
  apk_version?: string | null;
};

async function applyMobileSyncGate(
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
  agent_assignments?: { visit_weekdays: unknown }[];
};

export function compactClient(c: CompactClientRow) {
  const ledger = c.client_balances?.[0]?.balance;
  const weekdays =
    parseVisitWeekdaysJson(c.visit_weekdays) ||
    parseVisitWeekdaysJson(c.agent_assignments?.[0]?.visit_weekdays);
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
    visit_date: c.visit_date ?? null,
    ...(weekdays.length ? { visit_weekdays: weekdays } : {}),
    balance: ledger != null ? Number(ledger) : null,
    credit_limit: c.credit_limit != null ? Number(c.credit_limit) : null
  };
}

function compactProduct(p: {
  id: number;
  sku: string;
  name: string;
  unit: string;
  barcode: string | null;
  category_id: number | null;
  brand_id: number | null;
  is_active: boolean;
  weight_kg: Prisma.Decimal | null;
  sell_code: string | null;
  updated_at: Date;
}) {
  return {
    id: p.id,
    sku: p.sku,
    name: p.name,
    unit: p.unit,
    barcode: p.barcode,
    category_id: p.category_id,
    brand_id: p.brand_id,
    is_active: p.is_active,
    weight_kg: p.weight_kg ? Number(p.weight_kg) : null,
    sell_code: p.sell_code,
    updated_at: p.updated_at
  };
}

function compactPrice(p: { product_id: number; price_type: string; price: Prisma.Decimal }) {
  return {
    product_id: p.product_id,
    price_type: p.price_type,
    price: Number(p.price)
  };
}

function compactOrder(o: {
  id: number;
  number: string;
  client_id: number;
  agent_id: number | null;
  warehouse_id: number | null;
  status: string;
  total_sum: Prisma.Decimal;
  created_at: Date;
  items?: { product_id: number; qty: Prisma.Decimal; price: Prisma.Decimal; total: Prisma.Decimal }[];
}) {
  return {
    id: o.id,
    number: o.number,
    client_id: o.client_id,
    agent_id: o.agent_id,
    warehouse_id: o.warehouse_id,
    status: o.status,
    total_sum: Number(o.total_sum),
    created_at: o.created_at,
    ...(o.items
      ? {
          items: o.items.map((item) => ({
            product_id: item.product_id,
            qty: Number(item.qty),
            price: Number(item.price),
            total: Number(item.total)
          }))
        }
      : {})
  };
}

export const clientSyncSelect = {
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
  client_balances: { select: { balance: true }, take: 1 },
  agent_assignments: {
    where: { slot: 1 },
    select: { visit_weekdays: true },
    take: 1
  }
} as const;

async function fetchSyncClients(
  tenantId: number,
  agentId: number,
  since: Date
): Promise<ReturnType<typeof compactClient>[]> {
  const rows = await prisma.client.findMany({
    where: {
      ...agentScopedClientWhere(tenantId, agentId),
      is_active: true,
      ...(since.getTime() > 0 ? { updated_at: { gt: since } } : {})
    },
    take: MOBILE_SYNC_CLIENT_LIMIT,
    orderBy: { updated_at: "desc" },
    select: clientSyncSelect
  });
  return rows.map((r) => compactClient(r as unknown as CompactClientRow));
}

async function fetchSyncOrders(tenantId: number, agentId: number, since: Date) {
  const excluded = [...ORDER_STATUSES_EXCLUDED_FROM_CREDIT_EXPOSURE];
  const rows = await prisma.order.findMany({
    where: {
      ...agentScopedOrderWhere(tenantId, agentId),
      status: { notIn: excluded },
      ...(since.getTime() > 0 ? { updated_at: { gt: since } } : {})
    },
    select: {
      id: true,
      number: true,
      client_id: true,
      agent_id: true,
      warehouse_id: true,
      status: true,
      total_sum: true,
      created_at: true,
      items: { select: { product_id: true, qty: true, price: true, total: true } }
    },
    orderBy: { updated_at: "desc" },
    take: 500
  });
  return rows.map((o) => compactOrder(o));
}

export async function syncFull(
  tenantId: number,
  userId: number,
  lastSyncAt: Date | null,
  presence?: PresenceOpts
) {
  await applyMobileSyncGate(tenantId, userId, presence);
  const since: Date = lastSyncAt ?? new Date(0);
  const firstSync = lastSyncAt == null;

  const [clients, products, productPrices, orders] = await Promise.all([
    fetchSyncClients(tenantId, userId, since),
    prisma.product.findMany({
      where: {
        tenant_id: tenantId,
        is_active: true,
        ...(since.getTime() > 0 ? { updated_at: { gt: since } } : {})
      },
      select: {
        id: true,
        sku: true,
        name: true,
        unit: true,
        barcode: true,
        category_id: true,
        brand_id: true,
        is_active: true,
        weight_kg: true,
        sell_code: true,
        updated_at: true
      },
      take: 5000
    }),
    prisma.productPrice.findMany({
      where: {
        tenant_id: tenantId,
        ...(since.getTime() > 0 ? { updated_at: { gt: since } } : {})
      },
      select: { product_id: true, price_type: true, price: true },
      take: 20000
    }),
    fetchSyncOrders(tenantId, userId, since)
  ]);

  const now = new Date();
  await prisma.user.update({
    where: { id: userId },
    data: { last_sync_at: now }
  });

  return {
    sync_at: now.toISOString(),
    clients_replace_all: firstSync,
    clients,
    products: products.map(compactProduct),
    prices: productPrices.map(compactPrice),
    orders
  };
}

export async function syncDelta(
  tenantId: number,
  userId: number,
  lastSyncAt: Date | null,
  entityType?: "clients" | "products" | "prices" | "orders",
  presence?: PresenceOpts
) {
  await applyMobileSyncGate(tenantId, userId, presence);
  const since: Date = lastSyncAt ?? new Date(0);
  const now = new Date();
  let result: Record<string, unknown> = {};

  switch (entityType) {
    case "clients": {
      result.clients = await fetchSyncClients(tenantId, userId, since);
      break;
    }
    case "products": {
      const rows = await prisma.product.findMany({
        where: {
          tenant_id: tenantId,
          is_active: true,
          ...(since.getTime() > 0 ? { updated_at: { gt: since } } : {})
        },
        select: {
          id: true,
          sku: true,
          name: true,
          unit: true,
          barcode: true,
          category_id: true,
          brand_id: true,
          is_active: true,
          weight_kg: true,
          sell_code: true,
          updated_at: true
        },
        take: 5000
      });
      result.products = rows.map(compactProduct);
      break;
    }
    case "prices": {
      const rows = await prisma.productPrice.findMany({
        where: {
          tenant_id: tenantId,
          ...(since.getTime() > 0 ? { updated_at: { gt: since } } : {})
        },
        select: { product_id: true, price_type: true, price: true },
        take: 20000
      });
      result.prices = rows.map(compactPrice);
      break;
    }
    case "orders": {
      result.orders = await fetchSyncOrders(tenantId, userId, since);
      break;
    }
    default:
      break;
  }

  await prisma.user.update({
    where: { id: userId },
    data: { last_sync_at: now }
  });

  return { sync_at: now.toISOString(), ...result };
}

export async function enqueueOrder(
  tenantId: number,
  userId: number,
  clientLocalId: string | number,
  warehouseId: number,
  items: { product_id: number; qty: number; price?: number }[],
  offlineCreatedAt: Date,
  opts?: { price_type?: string; comment?: string | null }
) {
  const clientId =
    typeof clientLocalId === "number"
      ? clientLocalId
      : Number.parseInt(String(clientLocalId), 10);
  if (!Number.isFinite(clientId) || clientId < 1) throw new Error("BAD_CLIENT");

  const cfg = await loadAgentMobileConfig(tenantId, userId);
  await assertAgentScopedClient(tenantId, userId, clientId);
  await assertMobilePhotoReportForClient(tenantId, userId, clientId, cfg);

  const wh = await prisma.warehouse.findFirst({
    where: { id: warehouseId, tenant_id: tenantId },
    select: { id: true }
  });
  if (!wh) throw new Error("BAD_WAREHOUSE");

  const now = new Date();
  const tempNumber = `OFF-${now.getTime()}`;
  const order = await prisma.order.create({
    data: {
      tenant_id: tenantId,
      number: tempNumber,
      client_id: clientId,
      agent_id: userId,
      warehouse_id: warehouseId,
      status: "pending_sync",
      total_sum: 0,
      bonus_sum: 0,
      comment: opts?.comment?.trim() || null,
      created_at: offlineCreatedAt,
      updated_at: now,
      items: {
        create: items.map((it) => ({
          product_id: it.product_id,
          qty: it.qty,
          price: it.price ?? 0,
          total: 0,
          is_bonus: false
        }))
      },
      change_logs: {
        create: {
          user_id: userId,
          action: "offline_enqueue",
          payload: {
            offline_created_at: offlineCreatedAt.toISOString(),
            price_type: (opts?.price_type ?? "").trim() || "retail"
          }
        }
      }
    },
    select: { id: true, number: true, status: true, created_at: true }
  });

  return order;
}

export async function getPendingCount(tenantId: number, userId: number) {
  const count = await prisma.order.count({
    where: {
      ...agentScopedOrderWhere(tenantId, userId),
      status: "pending_sync"
    }
  });
  return { pending: count };
}

export async function syncOrders(tenantId: number, userId: number) {
  const offlineOrders = await prisma.order.findMany({
    where: {
      ...agentScopedOrderWhere(tenantId, userId),
      status: "pending_sync"
    },
    include: { items: true },
    orderBy: { created_at: "asc" }
  });

  if (offlineOrders.length === 0) {
    return { synced: 0, results: [] };
  }

  const results: { clientLocalId: number; serverId: number; serverNumber: string }[] = [];

  await prisma.$transaction(async (tx) => {
    for (const order of offlineOrders) {
      let totalSum = 0;
      for (const item of order.items) {
        const total = Number(item.qty) * Number(item.price);
        totalSum += total;
        await tx.orderItem.update({ where: { id: item.id }, data: { total } });
      }

      const serverNumber = String(order.id);
      await tx.order.update({
        where: { id: order.id },
        data: { number: serverNumber, status: "new", total_sum: totalSum, updated_at: new Date() }
      });

      results.push({
        clientLocalId: order.client_id,
        serverId: order.id,
        serverNumber
      });
    }
  });

  return { synced: results.length, results };
}

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
  if (!u || (u.role !== "agent" && u.role !== "expeditor" && u.role !== "supervisor")) {
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
