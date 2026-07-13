/**
 * Mobil ekspeditor — qaytarish hujjatlari va «Возврат с полки по заказу» ro‘yxat/tarkib.
 */
import { prisma } from "../../config/database";
import { loadInterchangeableSiblingsByProductId } from "../returns/returns-bonus-reverse.peresort";
import {
  getClientReturnsData,
  listClientOrderPickBalancesWithMeta
} from "../returns/returns-enhanced.client-data";
import {
  assertExpeditorOwnsOrder,
  loadExpeditorMobileConfig
} from "./mobile.expeditor.orders.service";
import { buildPeresortOptionsForOrder } from "./mobile.expeditor.peresort";

export {
  createMobileExpeditorReturnByOrder,
  previewMobileExpeditorReturnByOrder
} from "./mobile.expeditor.returns.by-order";

/**
 * Ekspeditor o'zi shakllantirgan qaytarish hujjatlari (vozvratnaya nakladnaya).
 * Dastavchik omborga TOPSHIRADIGAN mahsulotlar ro'yxati (miqdor bilan) va
 * zavsklad qabul holati (`pending` → `posted`/`cancelled`) shu yerda ko'rinadi.
 */
export async function listMobileExpeditorReturns(
  tenantId: number,
  expeditorUserId: number
) {
  const rows = await prisma.salesReturn.findMany({
    where: { tenant_id: tenantId, created_by_user_id: expeditorUserId },
    orderBy: { created_at: "desc" },
    take: 100,
    select: {
      id: true,
      number: true,
      status: true,
      created_at: true,
      accepted_at: true,
      refund_amount: true,
      order: { select: { number: true } },
      client: { select: { name: true } },
      lines: {
        orderBy: { id: "asc" },
        select: { qty: true, product: { select: { sku: true, name: true } } }
      }
    }
  });

  const statusLabel = (s: string): string =>
    s === "pending"
      ? "Qabul kutilmoqda"
      : s === "posted"
        ? "Qabul qilindi"
        : s === "cancelled"
          ? "Rad etildi"
          : s;

  return {
    data: rows.map((r) => {
      const totalQty = r.lines.reduce((a, ln) => a + Number(ln.qty), 0);
      return {
        id: r.id,
        number: r.number,
        status: r.status,
        status_label: statusLabel(r.status),
        created_at: r.created_at.toISOString(),
        accepted_at: r.accepted_at ? r.accepted_at.toISOString() : null,
        order_number: r.order?.number ?? null,
        client_name: r.client?.name ?? null,
        refund_amount: r.refund_amount ? r.refund_amount.toString() : null,
        total_qty: totalQty,
        items: r.lines.map((ln) => ({
          sku: ln.product.sku,
          name: ln.product.name,
          qty: ln.qty.toString()
        }))
      };
    })
  };
}

/**
 * Ekspeditorga biriktirilgan yetkazilgan (delivered) zakazlar — sozlamadagi
 * `return_filter` (balans/davr) shartiga mos va to'liq qaytarilmaganlari.
 * «По заказу» rejimida zakazni tanlash uchun ro'yxat.
 */
export async function listMobileExpeditorReturnByOrderOrders(
  tenantId: number,
  expeditorUserId: number
) {
  const cfg = await loadExpeditorMobileConfig(tenantId, expeditorUserId);
  if (cfg.orders?.allow_return_from_shelf !== true) throw new Error("RETURN_DISABLED");

  const delivered = await prisma.order.findMany({
    where: {
      tenant_id: tenantId,
      expeditor_user_id: expeditorUserId,
      status: "delivered",
      order_type: "order"
    },
    select: {
      id: true,
      number: true,
      total_sum: true,
      created_at: true,
      client_id: true,
      client: { select: { name: true } }
    },
    orderBy: { created_at: "desc" }
  });
  if (delivered.length === 0) return { orders: [], filter_mode: null as string | null };

  const byClient = new Map<number, typeof delivered>();
  for (const o of delivered) {
    const arr = byClient.get(o.client_id) ?? [];
    arr.push(o);
    byClient.set(o.client_id, arr);
  }

  type OrderProduct = {
    product_id: number;
    name: string;
    sku: string;
    category_id: number | null;
    category_name: string | null;
  };
  const out: Array<{
    id: number;
    number: string;
    client_id: number;
    client_name: string;
    total_sum: number;
    created_at: string;
    remaining_paid_qty: number;
    products: OrderProduct[];
  }> = [];
  let filterMode: string | null = null;

  for (const [clientId, orders] of byClient) {
    let eligible;
    try {
      eligible = await listClientOrderPickBalancesWithMeta(tenantId, clientId);
    } catch {
      continue;
    }
    filterMode = eligible.filter_meta?.filter_mode ?? filterMode;
    const balById = new Map(eligible.balances.map((b) => [b.order_id, b]));
    for (const o of orders) {
      const bal = balById.get(o.id);
      if (!bal) continue;
      out.push({
        id: o.id,
        number: o.number,
        client_id: clientId,
        client_name: o.client?.name ?? "",
        total_sum: Number(o.total_sum),
        created_at: o.created_at.toISOString(),
        remaining_paid_qty: bal.remaining_paid_qty,
        products: []
      });
    }
  }

  const eligibleIds = out.map((o) => o.id);
  if (eligibleIds.length > 0) {
    const items = await prisma.orderItem.findMany({
      where: { order_id: { in: eligibleIds } },
      select: {
        order_id: true,
        product_id: true,
        product: {
          select: {
            name: true,
            sku: true,
            category_id: true,
            category: { select: { name: true } }
          }
        }
      }
    });
    const byOrder = new Map<number, OrderProduct[]>();
    for (const it of items) {
      const arr = byOrder.get(it.order_id) ?? [];
      if (!arr.some((p) => p.product_id === it.product_id)) {
        arr.push({
          product_id: it.product_id,
          name: it.product?.name ?? "",
          sku: it.product?.sku ?? "",
          category_id: it.product?.category_id ?? null,
          category_name: it.product?.category?.name ?? null
        });
      }
      byOrder.set(it.order_id, arr);
    }
    for (const o of out) {
      o.products = byOrder.get(o.id) ?? [];
    }
  }

  out.sort((a, b) => b.created_at.localeCompare(a.created_at));
  return { orders: out, filter_mode: filterMode };
}

/** Bitta zakaz tarkibi — qaytarish mumkin bo'lgan mahsulotlar (qoldiq, narx, bonus). */
export async function getMobileExpeditorReturnByOrderComposition(
  tenantId: number,
  expeditorUserId: number,
  orderId: number
) {
  const cfg = await loadExpeditorMobileConfig(tenantId, expeditorUserId);
  if (cfg.orders?.allow_return_from_shelf !== true) throw new Error("RETURN_DISABLED");

  const order = await assertExpeditorOwnsOrder(tenantId, expeditorUserId, orderId);
  if (order.status !== "delivered") throw new Error("BAD_STATUS");

  const cdata = await getClientReturnsData(
    tenantId,
    order.client_id,
    undefined,
    undefined,
    orderId
  );

  const productIds = [...new Set(cdata.items.map((it) => it.product_id))];
  const catRows = productIds.length
    ? await prisma.product.findMany({
        where: { tenant_id: tenantId, id: { in: productIds } },
        select: { id: true, category_id: true, category: { select: { name: true } } }
      })
    : [];
  const catById = new Map(
    catRows.map((p) => [
      p.id,
      { category_id: p.category_id ?? null, category_name: p.category?.name ?? null }
    ])
  );

  const items = cdata.items
    .filter((it) => Number(it.qty) > 0)
    .map((it) => {
      const price = Number(it.price);
      const maxQty = Number(it.qty);
      const cat = catById.get(it.product_id);
      return {
        product_id: it.product_id,
        sku: it.sku,
        name: it.name,
        unit: it.unit,
        is_bonus: it.is_bonus,
        price,
        max_qty: maxQty,
        line_total: it.is_bonus ? 0 : price * maxQty,
        category_id: cat?.category_id ?? null,
        category_name: cat?.category_name ?? null
      };
    });

  const paidValue = items
    .filter((i) => !i.is_bonus)
    .reduce((s, i) => s + i.line_total, 0);
  const bonusQty = items
    .filter((i) => i.is_bonus)
    .reduce((s, i) => s + i.max_qty, 0);
  const ord = cdata.orders[0];

  const siblingsMap = await loadInterchangeableSiblingsByProductId(tenantId);
  const peresortEnabled = siblingsMap.size > 0;
  const productIdsInOrder = [...new Set(items.map((i) => i.product_id))];
  const peresort = peresortEnabled
    ? await buildPeresortOptionsForOrder(tenantId, productIdsInOrder, siblingsMap)
    : {};

  return {
    order: { id: order.id, number: ord?.number ?? String(order.id) },
    client_id: order.client_id,
    items,
    paid_value: paidValue,
    bonus_qty_total: bonusQty,
    max_returnable_value: Number(cdata.max_returnable_value),
    client_balance: Number(cdata.client_balance),
    peresort_enabled: peresortEnabled,
    peresort
  };
}
