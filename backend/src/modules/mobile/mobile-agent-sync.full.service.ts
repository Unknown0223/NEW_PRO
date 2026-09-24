import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { ORDER_STATUSES_EXCLUDED_FROM_CREDIT_EXPOSURE } from "../orders/order-status";
import { loadActiveWorkSlotsByUserIds } from "../work-slots/work-slots.query";
import {
  agentScopedClientWhere,
  agentScopedOrderWhere,
  applyMobileSyncGate,
  clientSyncSelectForAgent,
  compactClient,
  type CompactClientRow,
  type PresenceOpts
} from "./mobile-agent-sync.config.service";
import {
  loadTenantTimezone,
  utcOffsetHoursForTimezone
} from "../tenant-settings/tenant-timezone";

const MOBILE_SYNC_CLIENT_BATCH = 200;
const MOBILE_SYNC_CLIENT_MAX = 20_000;
/** Syncga faqat qisqa HTTP URL — base64 `data:` Prisma napi stringni yiqitadi. */
const MOBILE_SYNC_PHOTO_URL_MAX = 2048;

/**
 * Katta base64 `image_url` larni Prisma orqali o‘qimasdan, faqat qisqa HTTP URL.
 * #5668 / `Failed to convert rust String into napi string` himoyasi.
 */
export async function fetchSyncClientPhotoUrls(
  tenantId: number,
  clientIds: number[]
): Promise<Map<number, string>> {
  const out = new Map<number, string>();
  if (clientIds.length === 0) return out;

  const rows = await prisma.$queryRaw<Array<{ client_id: number; image_url: string | null }>>`
    SELECT DISTINCT ON (r.client_id)
      r.client_id,
      CASE
        WHEN r.image_url IS NULL THEN NULL
        WHEN lower(left(r.image_url, 5)) = 'data:' THEN NULL
        WHEN length(r.image_url) > ${MOBILE_SYNC_PHOTO_URL_MAX} THEN NULL
        ELSE r.image_url
      END AS image_url
    FROM client_photo_reports r
    WHERE r.tenant_id = ${tenantId}
      AND r.deleted_at IS NULL
      AND r.client_id IN (${Prisma.join(clientIds)})
    ORDER BY r.client_id, r.created_at DESC
  `;

  for (const row of rows) {
    const url = row.image_url?.trim();
    if (url) out.set(row.client_id, url);
  }
  return out;
}

export async function fetchSyncClients(
  tenantId: number,
  agentId: number,
  since: Date
): Promise<ReturnType<typeof compactClient>[]> {
  const out: ReturnType<typeof compactClient>[] = [];
  let skip = 0;
  const slotMap = await loadActiveWorkSlotsByUserIds([agentId]);
  const workSlotId = slotMap.get(agentId)?.slot_id ?? null;

  while (out.length < MOBILE_SYNC_CLIENT_MAX) {
    const take = Math.min(MOBILE_SYNC_CLIENT_BATCH, MOBILE_SYNC_CLIENT_MAX - out.length);
    const rows = await prisma.client.findMany({
      where: {
        AND: [
          agentScopedClientWhere(tenantId, agentId, workSlotId),
          // Kutayotgan (неактив) yangi klientlar ham agentga ko‘rinsin
          { OR: [{ is_active: true }, { agent_id: agentId }] },
          ...(since.getTime() > 0 ? [{ updated_at: { gt: since } }] : [])
        ]
      },
      orderBy: { id: "asc" },
      skip,
      take,
      select: clientSyncSelectForAgent(agentId, workSlotId)
    });
    if (rows.length === 0) break;

    const photoByClient = await fetchSyncClientPhotoUrls(
      tenantId,
      rows.map((r) => r.id)
    );

    out.push(
      ...rows.map((r) => {
        const photo = photoByClient.get(r.id);
        return compactClient(
          {
            ...(r as unknown as CompactClientRow),
            ...(photo ? { client_photo_reports: [{ image_url: photo }] } : { client_photo_reports: [] })
          },
          { agentId, workSlotId }
        );
      })
    );
    if (rows.length < take) break;
    skip += rows.length;
  }

  return out;
}

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
  presence?: PresenceOpts & { forceClientsCatalog?: boolean }
) {
  await applyMobileSyncGate(tenantId, userId, presence);
  const forceClients = presence?.forceClientsCatalog === true;
  const clientSince = forceClients || lastSyncAt == null ? new Date(0) : lastSyncAt;
  // forceClientsCatalog faqat mijozlar — mahsulotlar ham to‘liq kelishi kerak,
  // aks holda mobil REPLACE qilganda (eski bug) yoki delta bo‘sh qoladi.
  const productSince =
    forceClients || lastSyncAt == null ? new Date(0) : lastSyncAt;
  const since: Date = lastSyncAt ?? new Date(0);
  const clientsReplaceAll = lastSyncAt == null || forceClients;

  const [clients, products, productPrices, orders] = await Promise.all([
    fetchSyncClients(tenantId, userId, clientSince),
    prisma.product.findMany({
      where: {
        tenant_id: tenantId,
        is_active: true,
        ...(productSince.getTime() > 0 ? { updated_at: { gt: productSince } } : {})
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
        ...(productSince.getTime() > 0 ? { updated_at: { gt: productSince } } : {})
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

  const workTimezone = await loadTenantTimezone(tenantId);
  return {
    sync_at: now.toISOString(),
    clients_replace_all: clientsReplaceAll,
    clients,
    products: products.map(compactProduct),
    prices: productPrices.map(compactPrice),
    orders,
    work_timezone: workTimezone,
    work_utc_offset_hours: utcOffsetHoursForTimezone(workTimezone)
  };
}
