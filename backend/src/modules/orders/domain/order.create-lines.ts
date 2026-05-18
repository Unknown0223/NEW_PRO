/**
 * Domain: Orders (yaratish, holat, qoldiq, bonus, ro‘yxat).
 * Boundary: route → JWT/RBAC + Zod; servis → tranzaksiya, zaxira, dashboard/stock invalidatsiya.
 * Bog‘liq: `orders.route.ts`, `contracts/orders.schemas.ts`, `docs/domain-boundary.md`.
 */
import { randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import { getErrorCode } from "../../../lib/app-error";
import { prisma } from "../../../config/database";
import { emitOrderUpdated } from "../../../lib/order-event-bus";
import { invalidateDashboard, invalidateStock } from "../../../lib/redis-cache";
import { enqueueOrderStatusNotifyJob } from "../../jobs/jobs.service";
import { getProductPrice } from "../../products/product-prices.service";
import { parseBonusStackPolicy } from "../bonus-stack-policy";
import {
  fetchClientUsedAutoBonusRuleIds,
  fetchClientUsedAutoBonusRuleIdsExcludingOrder,
  resolveOrderBonusesForCreate,
  type OrderAgentBonusContext
} from "../order-bonus-apply";
import {
  ORDER_STATUSES_EXCLUDED_FROM_CREDIT_EXPOSURE,
  statusContributesToDeliveredReceivableDebt,
  normalizeOrderType,
  canTransitionOrderStatus,
  getAllowedNextStatuses,
  isBackwardTransition,
  isOperatorLateStageCancelForbidden,
  isValidOrderStatus
} from "../order-status";
import { resolveAutoExpeditorUserId } from "../expeditor-auto-assign";
import {
  computeAgentConsignmentOutstanding,
  parseYearMonth,
  utcMonthStart
} from "../../consignment/consignment.service";
import {
  buildNakladnoyXlsx,
  type NakladnoyBuildOptions,
  type NakladnoyLine,
  type NakladnoyOrderPayload,
  DEFAULT_NAKLADNOY_BUILD_OPTIONS
} from "../order-nakladnoy-xlsx";
import { buildNakladnoyPdf } from "../order-nakladnoy-pdf";
import {
  loadDeliveryDebtByClient,
  mergeLedgerWithUnpaidDelivered
} from "../../client-balances/client-balances.service";
import { resolvePaymentMethodRefToLabel } from "../../tenant-settings/finance-refs";
import { loadPaymentMethodEntriesForResolve } from "../../tenant-settings/tenant-settings.service";
import { prepareExchangeOrderLines } from "../exchange-order-create";

import {
  assertOrderWarehouseBlockAssignment,
  enrichOrderDetailRow,
  bonusGiftMapToJson,
  roundOrderMoney,
  validateBonusGiftOverrides
} from "./order.detail-mappers";
import {
  orderDetailInclude,
  type BonusGiftOverrideInput,
  type CreateOrderInput,
  type OrderDetailLoaded,
  type OrderDetailRow
} from "./order.types";

export type CreateOrderLineBuildResult = {
  lineData: Array<{
    product_id: number;
    qty: import("@prisma/client").Prisma.Decimal;
    price: import("@prisma/client").Prisma.Decimal;
    total: import("@prisma/client").Prisma.Decimal;
    exchange_line_kind?: "minus" | "plus";
  }>;
  totalSum: import("@prisma/client").Prisma.Decimal;
  qtyByProduct: Map<number, number>;
  productById: Map<number, { id: number; category_id: number | null }>;
  orderedProductIds: Set<number>;
  exchangeMetaJson?: import("@prisma/client").Prisma.InputJsonValue;
};

export async function buildCreateOrderLineData(
  tenantId: number,
  input: CreateOrderInput,
  orderTypeEarly: string,
  priceType: string
): Promise<CreateOrderLineBuildResult> {
  type LineDraft = CreateOrderLineBuildResult["lineData"][number];
  const lineData: LineDraft[] = [];
  let totalSum = new Prisma.Decimal(0);
  const qtyByProduct = new Map<number, number>();
  const productById = new Map<number, { id: number; category_id: number | null }>();
  const orderedProductIds = new Set<number>();

  let exchangeMetaJson: Prisma.InputJsonValue | undefined;

  if (orderTypeEarly === "exchange") {
    const ex = await prepareExchangeOrderLines(
      tenantId,
      input.client_id,
      input.warehouse_id,
      input.agent_id ?? null,
      priceType,
      {
        source_order_ids: input.source_order_ids!,
        minus_lines: input.minus_lines!,
        plus_lines: input.plus_lines!,
        reason_ref: input.reason_ref
      }
    );
    const plusRows = await prisma.product.findMany({
      where: { id: { in: ex.plusProductIds }, tenant_id: tenantId, is_active: true }
    });
    const minusRows = await prisma.product.findMany({
      where: { id: { in: ex.minusProductIds }, tenant_id: tenantId }
    });
    if (plusRows.length !== ex.plusProductIds.length || minusRows.length !== ex.minusProductIds.length) {
      throw new Error("BAD_PRODUCT");
    }
    const pmap = new Map<number, (typeof plusRows)[number]>();
    for (const p of [...plusRows, ...minusRows]) pmap.set(p.id, p);
    for (const l of ex.lines) {
      const row = pmap.get(l.product_id);
      if (!row) throw new Error("BAD_PRODUCT");
      lineData.push({
        product_id: l.product_id,
        qty: l.qty,
        price: l.price,
        total: l.total,
        exchange_line_kind: l.exchange_line_kind
      });
      productById.set(row.id, { id: row.id, category_id: row.category_id });
      if (l.exchange_line_kind === "plus") {
        qtyByProduct.set(l.product_id, (qtyByProduct.get(l.product_id) ?? 0) + Number(l.qty));
        orderedProductIds.add(l.product_id);
      }
    }
    totalSum = ex.paidTotal;
    exchangeMetaJson = ex.exchangeMeta as unknown as Prisma.InputJsonValue;
  } else {
    // ✅ BATCH validation — dublikat mahsulotlar tekshirish
    const orderProductIds = new Set(input.items.map((i) => i.product_id));
    if (orderProductIds.size !== input.items.length) {
      throw new Error("DUPLICATE_PRODUCT");
    }
    for (const it of input.items) {
      if (!Number.isFinite(it.qty) || it.qty <= 0) {
        throw new Error("BAD_QTY");
      }
    }
    const productIds = [...orderProductIds];
    const products = await prisma.product.findMany({
      where: { id: { in: productIds }, tenant_id: tenantId, is_active: true }
    });
    const productMap = new Map(products.map((p) => [p.id, p]));
    for (const it of input.items) {
      const product = productMap.get(it.product_id);
      if (!product) {
        throw new Error("BAD_PRODUCT");
      }
      const priceStr = await getProductPrice(tenantId, it.product_id, priceType);
      if (priceStr == null) {
        const e = new Error("NO_PRICE") as Error & { product_id: number; price_type: string };
        e.product_id = it.product_id;
        e.price_type = priceType;
        throw e;
      }
      const price = new Prisma.Decimal(priceStr);
      const qty = new Prisma.Decimal(it.qty);
      const lineTotal = qty.mul(price);
      totalSum = totalSum.add(lineTotal);
      lineData.push({ product_id: it.product_id, qty, price, total: lineTotal });
      productById.set(product.id, { id: product.id, category_id: product.category_id });
      qtyByProduct.set(it.product_id, (qtyByProduct.get(it.product_id) ?? 0) + it.qty);
      orderedProductIds.add(it.product_id);
    }
  }

  return { lineData, totalSum, qtyByProduct, productById, orderedProductIds, exchangeMetaJson };
}
