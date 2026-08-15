/**
 * Domain: Orders (yaratish, holat, qoldiq, bonus, ro‘yxat).
 * Boundary: route → JWT/RBAC + Zod; servis → tranzaksiya, zaxira, dashboard/stock invalidatsiya.
 * Bog‘liq: `orders.route.ts`, `contracts/orders.schemas.ts`, `docs/domain-boundary.md`.
 */
import { randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import { getErrorCode } from "../../../lib/app-error";
import { withTransaction } from "../../../lib/db-context";
import { prisma } from "../../../config/database";
import { emitOrderUpdated } from "../../../lib/order-event-bus";
import {
  invalidateDashboard,
  invalidateOrdersListCache,
  invalidateStock
} from "../../../lib/redis-cache";
import { appendTenantAuditEvent, AuditEntityType } from "../../../lib/tenant-audit";
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
  validateBonusGiftOverrides,
  validateBonusGiftLines
} from "./order.detail-mappers";
import { buildCreateOrderLineData } from "./order.create-lines";
import {
  orderDetailInclude,
  type BonusGiftOverrideInput,
  type CreateOrderInput,
  type OrderDetailLoaded,
  type OrderDetailRow
} from "./order.types";
import { runCreateOrderTransaction } from "./order.create-tx";

export type OrderViewerContext = {
  role?: string;
  userId?: number;
};

export async function createOrder(
  tenantId: number,
  input: CreateOrderInput,
  viewer?: OrderViewerContext | string
): Promise<OrderDetailRow> {
  const viewerCtx: OrderViewerContext =
    typeof viewer === "string" ? { role: viewer } : (viewer ?? {});
  const viewerRole = viewerCtx.role;
  const orderTypeEarly = normalizeOrderType(input.order_type);
  if (orderTypeEarly !== "exchange" && !input.items.length) {
    throw new Error("EMPTY_ITEMS");
  }
  if (orderTypeEarly === "exchange") {
    if (
      !input.source_order_ids?.length ||
      !input.minus_lines?.length ||
      !input.plus_lines?.length
    ) {
      throw new Error("EXCHANGE_PAYLOAD_REQUIRED");
    }
  }

  const client = await prisma.client.findFirst({
    where: {
      id: input.client_id,
      tenant_id: tenantId,
      merged_into_client_id: null,
      is_active: true
    },
    select: {
      id: true,
      category: true,
      sales_channel: true,
      product_category_ref: true,
      region: true,
      city: true,
      district: true,
      zone: true,
      neighborhood: true,
      address: true,
      credit_limit: true,
      price_type: true,
      allow_order_with_debt: true,
      allow_consignment: true,
      allow_consignment_with_debt: true
    }
  });
  if (!client) {
    throw new Error("BAD_CLIENT");
  }

  if (input.agent_id != null) {
    const { assertOrderAgentAllowedForClient } = await import("../../work-slots/work-slots.lock");
    await assertOrderAgentAllowedForClient(tenantId, input.client_id, input.agent_id);
  }

  let viewerBranch: string | null = null;
  if (viewerCtx.userId != null && viewerCtx.userId > 0) {
    const vu = await prisma.user.findFirst({
      where: { id: viewerCtx.userId, tenant_id: tenantId },
      select: { branch: true }
    });
    viewerBranch = vu?.branch ?? null;
  }

  const wh = await prisma.warehouse.findFirst({
    where: { id: input.warehouse_id, tenant_id: tenantId }
  });
  if (!wh) {
    throw new Error("BAD_WAREHOUSE");
  }

  let orderAgentForBonus: OrderAgentBonusContext | null = null;
  if (input.agent_id != null) {
    const u = await prisma.user.findFirst({
      where: { id: input.agent_id, tenant_id: tenantId, is_active: true },
      select: { id: true, branch: true, trade_direction_id: true }
    });
    if (!u) {
      throw new Error("BAD_AGENT");
    }
    const { assertFieldStaffBranchScope } = await import("../../work-slots/work-slots.branch-scope");
    assertFieldStaffBranchScope(viewerRole, viewerBranch, u.branch);
    orderAgentForBonus = {
      userId: u.id,
      branch: u.branch,
      trade_direction_id: u.trade_direction_id
    };
  }

  const priceType =
    (input.price_type ?? "").trim() || (client.price_type ?? "").trim() || "retail";

  const {
    lineData,
    totalSum,
    qtyByProduct,
    productById,
    orderedProductIds,
    exchangeMetaJson
  } = await buildCreateOrderLineData(tenantId, input, orderTypeEarly, priceType);

  const tempOrderNumber = `__${tenantId}_${Date.now()}_${randomBytes(5).toString("hex")}`;

  const orderType = orderTypeEarly;
  const isInboundShelfReturn = orderType === "return" || orderType === "return_by_order";

  if (orderType === "order") {
    if (input.agent_id == null || !Number.isFinite(input.agent_id) || input.agent_id < 1) {
      throw new Error("ORDER_REQUIRES_AGENT");
    }
  }
  if (orderType === "exchange") {
    if (input.agent_id == null || !Number.isFinite(input.agent_id) || input.agent_id < 1) {
      throw new Error("EXCHANGE_REQUIRES_AGENT");
    }
  }

  const tenantRow = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { settings: true }
  });
  const stackPolicy = parseBonusStackPolicy(tenantRow?.settings);

  const validatedGiftOverrides =
    input.bonus_gift_overrides?.length ?
      await validateBonusGiftOverrides(tenantId, input.bonus_gift_overrides)
    : new Map<number, number>();

  const validatedGiftSplits =
    input.bonus_gift_lines?.length ?
      await validateBonusGiftLines(tenantId, input.bonus_gift_lines)
    : new Map<number, Map<number, number>>();

  const roleNorm = (viewerRole ?? "").toLowerCase();
  const creationChannel: "web" | "mobile" =
    roleNorm.includes("agent") || roleNorm.includes("expeditor") ? "mobile" : "web";

  const { assertCreateOrderNotRestricted, planAutoConfirmAfterCreate } = await import(
    "../../order-automation/order-automation.apply"
  );
  await assertCreateOrderNotRestricted(tenantId, input, {
    client: {
      region: client.region,
      city: client.city,
      zone: client.zone,
      district: client.district,
      neighborhood: client.neighborhood
    },
    agent_trade_direction: null,
    total_sum: Number(totalSum),
    creation_channel: creationChannel
  });

  const order = await withTransaction((tx) =>
    runCreateOrderTransaction(tx, {
      tenantId,
      input,
      client,
      orderType,
      priceType,
      lineData,
      totalSum,
      qtyByProduct,
      productById,
      orderedProductIds,
      exchangeMetaJson: exchangeMetaJson ?? null,
      orderAgentForBonus,
      validatedGiftOverrides,
      validatedGiftSplits,
      tempOrderNumber,
      isInboundShelfReturn,
      stackPolicy
    })
  );

  emitOrderUpdated(tenantId, order.id);
  void invalidateOrdersListCache(tenantId);
  void invalidateDashboard(tenantId);
  void invalidateStock(tenantId, input.warehouse_id);

  void appendTenantAuditEvent({
    tenantId,
    actorUserId: viewerCtx.userId,
    entityType: AuditEntityType.order,
    entityId: String(order.id),
    action: "order.create",
    payload: {
      order_id: order.id,
      number: order.number,
      client_id: client.id,
      warehouse_id: input.warehouse_id,
      order_type: orderType,
      total_sum: String(totalSum)
    }
  });

  void planAutoConfirmAfterCreate(
    tenantId,
    order.id,
    input,
    {
      client: {
        region: client.region,
        city: client.city,
        zone: client.zone,
        district: client.district,
        neighborhood: client.neighborhood
      },
      agent_trade_direction: null,
      total_sum: Number(totalSum),
      creation_channel: creationChannel
    },
    order.created_at
  ).catch(() => undefined);

  const detail = await enrichOrderDetailRow(tenantId, order as unknown as OrderDetailLoaded, viewerRole);

  // Finance — post-commit hisoblash (yangi zakaz kiritilgan joriy holatni qaytarish)
  const balRow = await prisma.clientBalance.findUnique({
    where: { tenant_id_client_id: { tenant_id: tenantId, client_id: client.id } },
    select: { balance: true }
  });
  const accountBalance = balRow?.balance ?? new Prisma.Decimal(0);
  const creditLimit = client.credit_limit;
  const headroom = creditLimit.add(accountBalance);
  const agg = await prisma.order.aggregate({
    where: {
      tenant_id: tenantId,
      client_id: client.id,
      status: { notIn: [...ORDER_STATUSES_EXCLUDED_FROM_CREDIT_EXPOSURE] }
    },
    _sum: { total_sum: true }
  });
  const outstanding = agg._sum.total_sum ?? new Prisma.Decimal(0);

  return {
    ...detail,
    price_type: priceType,
    client_finance: {
      account_balance: accountBalance.toString(),
      credit_limit: creditLimit.toString(),
      outstanding: outstanding.toString(),
      headroom: headroom.toString()
    }
  };
}

