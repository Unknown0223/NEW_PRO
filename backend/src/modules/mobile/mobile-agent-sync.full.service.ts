import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { ORDER_STATUSES_EXCLUDED_FROM_CREDIT_EXPOSURE } from "../orders/order-status";
import {
  agentScopedClientWhere,
  agentScopedOrderWhere,
  applyMobileSyncGate,
  clientSyncSelect,
  compactClient,
  type CompactClientRow,
  type PresenceOpts
} from "./mobile-agent-sync.config.service";

const MOBILE_SYNC_CLIENT_LIMIT = 50;

export function compactProduct(p: {
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

export function compactPrice(p: { product_id: number; price_type: string; price: Prisma.Decimal }) {
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

export async function fetchSyncClients(
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

export async function fetchSyncOrders(tenantId: number, agentId: number, since: Date) {
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
