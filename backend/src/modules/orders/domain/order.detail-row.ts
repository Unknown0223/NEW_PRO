import { Prisma } from "@prisma/client";
import { prisma } from "../../../config/database";
import { resolvePaymentMethodRefToLabel } from "../../tenant-settings/finance-refs";
import { loadPaymentMethodEntriesForResolve } from "../../tenant-settings/tenant-settings.service";
import {
  allowedNextForRole,
  buildBonusGiftSwapOptions,
  parseBonusGiftSelectionsJson,
  sumBonusQty
} from "./order.detail-bonus";
import { loadOrdersFinanceEnrichment } from "./order.detail-finance";
import { parseAppliedBonusRulesSnapshot } from "../../bonus-rules/bonus-rules.snapshot";
import {
  applyOrderLevelDiscountPctToItems,
  orderHasAppliedDiscountRule
} from "../order-merchandise-net";
import { enrichItemsBonusDisplay } from "./order.detail-items-bonus";
import type { OrderDetailLoaded, OrderDetailRow, OrderItemRow } from "./order.types";

export function toDetailRow(o: OrderDetailLoaded, viewerRole?: string): OrderDetailRow {
  const agentDisplay = o.agent ? `${o.agent.login} (${o.agent.name})` : null;
  const exp = o.expeditor_user;
  const expeditorDisplay = exp ? `${exp.login} (${exp.name})` : null;
  const agentTradeDir =
    o.agent?.trade_direction_row?.name?.trim() ||
    o.agent?.trade_direction_row?.code?.trim() ||
    o.agent?.trade_direction?.trim() ||
    null;
  const cl = o.client;
  return {
    id: o.id,
    number: o.number,
    order_type: o.order_type ?? "order",
    client_id: o.client_id,
    client_name: cl.name,
    client_code: cl.client_code?.trim() || null,
    client_legal_name: cl.legal_name?.trim() || null,
    client_phone: cl.phone?.trim() || null,
    client_inn: cl.inn?.trim() || null,
    client_address: cl.address?.trim() || null,
    order_location: cl.landmark?.trim() || null,
    sales_channel: cl.sales_channel?.trim() || null,
    volume_m3: o.items
      .filter((i) => !i.is_bonus)
      .reduce((acc, i) => {
        const vol = i.product.volume_m3;
        return vol != null ? acc.add(i.qty.mul(vol)) : acc;
      }, new Prisma.Decimal(0))
      .toString(),
    cumulative_bonus: null,
    source_order_numbers: [],
    source_order_ids: [],
    returned_at: null,
    creation_channel: "web",
    list_created_at: o.created_at.toISOString(),
    warehouse_id: o.warehouse_id,
    warehouse_name: o.warehouse?.name ?? null,
    agent_name: o.agent?.name ?? null,
    agent_code: o.agent?.code ?? null,
    expeditors: expeditorDisplay,
    expeditor_id: o.expeditor_user_id,
    expeditor_display: expeditorDisplay,
    region: cl.region ?? null,
    city: cl.city?.trim() || cl.district?.trim() || null,
    zone: cl.neighborhood ?? null,
    consignment: o.agent?.consignment ?? null,
    day: null,
    created_by: null,
    created_by_role: null,
    expected_ship_date: null,
    shipped_at: null,
    delivered_at: null,
    qty: (o.order_type === "exchange"
      ? o.items.filter((i) => !i.is_bonus && i.exchange_line_kind === "plus")
      : o.items.filter((i) => !i.is_bonus)
    )
      .reduce((acc, i) => acc.add(i.qty), new Prisma.Decimal(0))
      .toString(),
    agent_id: o.agent_id,
    agent_display: agentDisplay,
    agent_trade_direction: agentTradeDir,
    payment_method_ref: o.payment_method_ref?.trim() || null,
    payment_method_label: null,
    is_consignment: o.is_consignment ?? false,
    consignment_due_date: o.consignment_due_date ? o.consignment_due_date.toISOString() : null,
    apply_bonus: o.applied_auto_bonus_rule_ids.length > 0,
    applied_bonus_rules_snapshot: parseAppliedBonusRulesSnapshot(o.applied_bonus_rules_snapshot),
    status: o.status,
    approval_status: o.approval_status ?? null,
    total_sum: o.total_sum.toString(),
    bonus_qty: sumBonusQty(o.items),
    discount_sum: o.discount_sum.toString(),
    discount_alert: o.discount_alert ?? null,
    bonus_alert: o.bonus_alert ?? null,
    bonus_sum: o.bonus_sum.toString(),
    balance: null,
    debt: null,
    price_type: null,
    comment: o.comment ?? null,
    request_type_ref: o.request_type_ref ?? null,
    created_at: o.created_at.toISOString(),
    warehouse_block_id: o.warehouse_block_id ?? null,
    warehouse_block_name: o.warehouse_block?.name ?? null,
    items: enrichItemsBonusDisplay(mapItems(o.items)),
    allowed_next_statuses: allowedNextForRole(o.status, viewerRole, o.order_type ?? "order"),
    status_logs: [...o.status_logs].reverse().map((l) => ({
      id: l.id,
      from_status: l.from_status,
      to_status: l.to_status,
      user_login: l.user?.login ?? null,
      created_at: l.created_at.toISOString()
    })),
    change_logs: [...o.change_logs].reverse().map((l) => ({
      id: l.id,
      action: l.action,
      payload: l.payload,
      user_login: l.user?.login ?? null,
      created_at: l.created_at.toISOString()
    })),
    client_gps_text: cl.gps_text?.trim() || null,
    client_latitude: cl.latitude != null ? cl.latitude.toString() : null,
    client_longitude: cl.longitude != null ? cl.longitude.toString() : null,
    client_category: cl.category?.trim() || null,
    client_responsible_person: cl.responsible_person?.trim() || null
  };
}

export function lineDiscountPct(
  price: Prisma.Decimal,
  qty: Prisma.Decimal,
  total: Prisma.Decimal,
  isBonus: boolean
): string | null {
  if (isBonus) return null;
  const gross = price.mul(qty);
  if (gross.eq(0)) return null;
  const diff = gross.sub(total);
  if (diff.lte(0)) return "0.00";
  return diff
    .div(gross)
    .mul(100)
    .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP)
    .toString();
}

export function mapItems(
  items: Array<{
    id: number;
    product_id: number;
    qty: Prisma.Decimal;
    price: Prisma.Decimal;
    total: Prisma.Decimal;
    is_bonus: boolean;
    exchange_line_kind?: string | null;
    product: {
      sku: string;
      name: string;
      volume_m3: Prisma.Decimal | null;
      weight_kg: Prisma.Decimal | null;
      category_id: number | null;
      category: { id: number; name: string } | null;
      product_group: { id: number; name: string } | null;
    };
  }>
): OrderItemRow[] {
  return items.map((i) => {
    const vol = i.product.volume_m3;
    const wgt = i.product.weight_kg;
    let lineVolume: string | null = null;
    let lineWeight: string | null = null;
    if (vol != null) {
      lineVolume = i.qty.mul(vol).toDecimalPlaces(6, Prisma.Decimal.ROUND_HALF_UP).toString();
    }
    if (wgt != null) {
      lineWeight = i.qty.mul(wgt).toDecimalPlaces(4, Prisma.Decimal.ROUND_HALF_UP).toString();
    }
    const categoryName =
      i.product.product_group?.name?.trim() ||
      i.product.category?.name?.trim() ||
      null;
    const categoryId = i.product.product_group?.id ?? i.product.category?.id ?? i.product.category_id ?? null;
    return {
      id: i.id,
      product_id: i.product_id,
      sku: i.product.sku,
      name: i.product.name,
      category_id: categoryId,
      category_name: categoryName,
      qty: i.qty.toString(),
      price: i.price.toString(),
      total: i.total.toString(),
      is_bonus: i.is_bonus,
      exchange_line_kind: i.exchange_line_kind ?? null,
      volume_m3: vol != null ? vol.toString() : null,
      weight_kg: wgt != null ? wgt.toString() : null,
      line_volume_m3: lineVolume,
      line_weight_kg: lineWeight,
      discount_pct: lineDiscountPct(i.price, i.qty, i.total, i.is_bonus)
    };
  });
}

export async function enrichOrderDetailRow(
  tenantId: number,
  o: OrderDetailLoaded,
  viewerRole?: string
): Promise<OrderDetailRow> {
  const base = toDetailRow(o, viewerRole);
  const pmEntries = await loadPaymentMethodEntriesForResolve(tenantId);
  const payment_method_label = resolvePaymentMethodRefToLabel(base.payment_method_ref, pmEntries);
  const sel = parseBonusGiftSelectionsJson(o.bonus_gift_selections ?? null);
  const swap = await buildBonusGiftSwapOptions(tenantId, o.applied_auto_bonus_rule_ids, sel);
  const bonus_gift_selections: Record<string, number> = {};
  for (const [k, v] of sel) bonus_gift_selections[String(k)] = v;
  const fin = await loadOrdersFinanceEnrichment(tenantId, [
    {
      id: o.id,
      client_id: o.client_id,
      order_type: o.order_type ?? "order",
      status: o.status,
      total_sum: o.total_sum,
      discount_sum: o.discount_sum,
      applied_auto_bonus_rule_ids: o.applied_auto_bonus_rule_ids ?? []
    }
  ]);
  const x = fin.get(o.id);
  let items = base.items;
  if (o.discount_sum.gt(0)) {
    const hasDiscountRule = await orderHasAppliedDiscountRule(
      tenantId,
      o.applied_auto_bonus_rule_ids ?? []
    );
    if (!hasDiscountRule) {
      items = applyOrderLevelDiscountPctToItems(items, o.discount_sum) as OrderItemRow[];
    }
  }
  return {
    ...base,
    items,
    payment_method_label,
    bonus_gift_selections,
    bonus_gift_swap_options: swap,
    shipped_at: x?.shipped_at ?? base.shipped_at,
    delivered_at: x?.delivered_at ?? base.delivered_at,
    debt: x?.debt ?? base.debt,
    balance: x?.balance ?? base.balance
  };
}

export async function assertOrderWarehouseBlockAssignment(
  tenantId: number,
  orderWarehouseId: number | null,
  orderExpeditorUserId: number | null,
  blockId: number | null
): Promise<void> {
  if (blockId == null) return;
  if (orderWarehouseId == null || orderWarehouseId < 1) {
    throw new Error("ORDER_REQUIRES_WAREHOUSE_FOR_BLOCK");
  }
  const block = await prisma.warehouseBlock.findFirst({
    where: { id: blockId, tenant_id: tenantId, is_active: true },
    include: {
      expeditors: { select: { user_id: true } }
    }
  });
  if (!block) throw new Error("BAD_WAREHOUSE_BLOCK");
  if (block.warehouse_id !== orderWarehouseId) throw new Error("WAREHOUSE_BLOCK_WRONG_WAREHOUSE");
  const ids = block.expeditors.map((e) => e.user_id);
  if (ids.length === 0) throw new Error("WAREHOUSE_BLOCK_NO_DRIVER");
  if (ids.length !== 1) throw new Error("WAREHOUSE_BLOCK_AMBIGUOUS_DRIVER");
  const driverId = ids[0]!;
  if (orderExpeditorUserId == null || orderExpeditorUserId !== driverId) {
    throw new Error("ORDER_BLOCK_EXPEDITOR_MISMATCH");
  }
}
