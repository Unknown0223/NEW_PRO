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
import { cursorPagination, decodeCursor } from "../../../lib/pagination";
import { getAppCache, invalidateDashboard, invalidateStock, setAppCache } from "../../../lib/redis-cache";
import { stableJsonStringify } from "../../dashboard/dashboard.cache";
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
  allowedNextForRole,
  enrichOrderDetailRow,
  loadOrdersFinanceEnrichment,
  sumBonusQty
} from "./order.detail-mappers";
import {
  orderDetailInclude,
  type ListOrdersQuery,
  type OrderDetailLoaded,
  type OrderDetailRow,
  type OrderListRow
} from "./order.types";

function parseListOrderLocalDayStart(isoDate: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return null;
  const dt = new Date(y, mo - 1, d, 0, 0, 0, 0);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function parseListOrderLocalDayEnd(isoDate: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return null;
  const dt = new Date(y, mo - 1, d, 23, 59, 59, 999);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

const ORDERS_LIST_CACHE_TTL_SECONDS = 20;

export async function listOrdersPaged(
  tenantId: number,
  q: ListOrdersQuery,
  viewerRole: string,
  viewerUserId?: number | null
): Promise<{
  data: OrderListRow[];
  total: number;
  page: number;
  limit: number;
  next_cursor?: string | null;
  has_next?: boolean;
}> {
  const cursorRawEarly = q.cursor?.trim();
  const useCursorEarly = Boolean(cursorRawEarly);
  if (!useCursorEarly) {
    const cacheKey = `tenant:${tenantId}:orders:list:${stableJsonStringify({
      q,
      viewerRole,
      viewerUserId: viewerUserId ?? null
    })}`;
    const cached = await getAppCache<{
      data: OrderListRow[];
      total: number;
      page: number;
      limit: number;
      next_cursor?: string | null;
      has_next?: boolean;
    }>(cacheKey);
    if (cached) return cached;
  }

  const andClauses: Prisma.OrderWhereInput[] = [{ tenant_id: tenantId }];

  if (q.status?.trim()) {
    andClauses.push({ status: q.status.trim() });
  }
  if (q.client_id != null && Number.isFinite(q.client_id) && q.client_id > 0) {
    andClauses.push({ client_id: q.client_id });
  }
  if (q.warehouse_id != null && Number.isFinite(q.warehouse_id) && q.warehouse_id > 0) {
    andClauses.push({ warehouse_id: q.warehouse_id });
  }
  const multiAgent =
    Array.isArray(q.agent_ids) && q.agent_ids.length > 0
      ? q.agent_ids.filter((id) => Number.isFinite(id) && id > 0)
      : [];
  const hasMultiAgent = multiAgent.length > 0 || q.include_no_agent === true;
  if (hasMultiAgent) {
    const ors: Prisma.OrderWhereInput[] = [];
    if (multiAgent.length > 0) {
      ors.push({ agent_id: { in: multiAgent } });
    }
    if (q.include_no_agent === true) {
      ors.push({ agent_id: null });
    }
    if (ors.length === 1) {
      andClauses.push(ors[0]!);
    } else if (ors.length > 1) {
      andClauses.push({ OR: ors });
    }
  } else if (q.agent_id != null && Number.isFinite(q.agent_id) && q.agent_id > 0) {
    andClauses.push({ agent_id: q.agent_id });
  }
  if (q.expeditor_user_id != null && Number.isFinite(q.expeditor_user_id) && q.expeditor_user_id > 0) {
    andClauses.push({ expeditor_user_id: q.expeditor_user_id });
  }
  if (viewerRole === "gruzchik" && viewerUserId != null && viewerUserId > 0) {
    andClauses.push({ warehouse_block: { is: { gruzchik_user_id: viewerUserId } } });
  }
  const cat = q.client_category?.trim();
  if (cat) {
    andClauses.push({ client: { category: cat } });
  }
  if (q.product_id != null && Number.isFinite(q.product_id) && q.product_id > 0) {
    andClauses.push({ items: { some: { product_id: q.product_id } } });
  }
  if (q.order_type?.trim()) {
    andClauses.push({ order_type: q.order_type.trim() });
  }
  if (q.is_consignment === true) {
    andClauses.push({ is_consignment: true });
  } else if (q.is_consignment === false) {
    andClauses.push({ is_consignment: false });
  }
  if (q.product_category_id != null && Number.isFinite(q.product_category_id) && q.product_category_id > 0) {
    andClauses.push({
      items: {
        some: {
          is_bonus: false,
          product: { tenant_id: tenantId, category_id: q.product_category_id }
        }
      }
    });
  }
  const payT = q.payment_type?.trim();
  if (payT) {
    andClauses.push({
      payments: { some: { payment_type: payT, deleted_at: null } }
    });
  }

  const pmRef = q.payment_method_ref?.trim();
  if (pmRef) {
    andClauses.push({ payment_method_ref: pmRef });
  }

  const fromD = q.date_from?.trim() ? parseListOrderLocalDayStart(q.date_from.trim()) : null;
  const toD = q.date_to?.trim() ? parseListOrderLocalDayEnd(q.date_to.trim()) : null;
  if (fromD && toD && fromD.getTime() > toD.getTime()) {
    return { data: [], total: 0, page: q.page, limit: q.limit };
  }
  if (fromD || toD) {
    const range: Prisma.DateTimeFilter = {};
    if (fromD) range.gte = fromD;
    if (toD) range.lte = toD;
    const rawMode = (q.date_mode?.trim() || "created").toLowerCase();
    const mode = rawMode === "order" ? "created" : rawMode;
    if (mode === "ship") {
      andClauses.push({
        status_logs: {
          some: {
            to_status: "delivering",
            created_at: range
          }
        }
      });
    } else {
      andClauses.push({ created_at: range });
    }
  }

  const rawSearch = q.search?.trim() ?? "";
  if (rawSearch.length > 0) {
    const s = rawSearch.length > 200 ? rawSearch.slice(0, 200) : rawSearch;
    andClauses.push({
      OR: [
        { number: { contains: s, mode: "insensitive" } },
        { client: { is: { name: { contains: s, mode: "insensitive" } } } },
        { comment: { contains: s, mode: "insensitive" } }
      ]
    });
  }

  const cursorRaw = q.cursor?.trim();
  const cursorId = cursorRaw ? Number.parseInt(decodeCursor(cursorRaw) ?? "", 10) : NaN;
  const useCursor = cursorRaw && Number.isFinite(cursorId) && cursorId > 0;

  if (useCursor) {
    andClauses.push({ id: { lt: cursorId } });
  }

  const whereFinal: Prisma.OrderWhereInput = { AND: andClauses };

  const [total, rowsRaw] = await Promise.all([
    useCursor ? Promise.resolve(0) : prisma.order.count({ where: whereFinal }),
    prisma.order.findMany({
      where: whereFinal,
      skip: useCursor ? undefined : (q.page - 1) * q.limit,
      take: useCursor ? q.limit + 1 : q.limit,
      orderBy: [{ created_at: "desc" }, { id: "desc" }],
      include: {
        client: {
          select: {
            name: true,
            region: true,
            city: true,
            district: true,
            neighborhood: true
          }
        },
        warehouse: { select: { name: true } },
        warehouse_block: { select: { id: true, name: true } },
        agent: {
          select: {
            name: true,
            code: true,
            consignment: true,
            trade_direction: true,
            trade_direction_row: { select: { code: true, name: true } }
          }
        },
        expeditor_user: { select: { id: true, login: true, name: true } },
        items: { select: { qty: true, is_bonus: true } }
      }
    })
  ]);

  const cursorPack = useCursor ? cursorPagination(rowsRaw, (r) => r.id, q.limit) : null;
  const rows = cursorPack?.data ?? rowsRaw;

  const finance = await loadOrdersFinanceEnrichment(
    tenantId,
    rows.map((o) => ({
      id: o.id,
      client_id: o.client_id,
      order_type: o.order_type ?? "order",
      status: o.status,
      total_sum: o.total_sum
    }))
  );

  const result = {
    data: rows.map((o) => {
      const ex = o.expeditor_user;
      const expeditorDisplay = ex ? `${ex.login} (${ex.name})` : null;
      const finRow = finance.get(o.id);
      return {
      id: o.id,
      number: o.number,
      order_type: o.order_type ?? "order",
      client_id: o.client_id,
      client_name: o.client.name,
      client_legal_name: null,
      warehouse_id: o.warehouse_id,
      warehouse_name: o.warehouse?.name ?? null,
      warehouse_block_id: (o as { warehouse_block_id?: number | null }).warehouse_block_id ?? null,
      warehouse_block_name: (o as { warehouse_block?: { name: string } | null }).warehouse_block?.name ?? null,
      agent_id: o.agent_id,
      agent_name: o.agent?.name ?? null,
      agent_code: o.agent?.code ?? null,
      agent_trade_direction:
        o.agent?.trade_direction_row?.code?.trim() ||
        o.agent?.trade_direction_row?.name?.trim() ||
        o.agent?.trade_direction?.trim() ||
        null,
      expeditors: expeditorDisplay,
      expeditor_id: ex?.id ?? null,
      expeditor_display: expeditorDisplay,
      region: o.client.region ?? null,
      city: o.client.city ?? o.client.district ?? null,
      zone: o.client.neighborhood ?? null,
      consignment: o.agent?.consignment ?? null,
      is_consignment: o.is_consignment ?? false,
      day: null,
      created_by: null,
      created_by_role: null,
      expected_ship_date: null,
      shipped_at: finRow?.shipped_at ?? null,
      delivered_at: finRow?.delivered_at ?? null,
      status: o.status,
      qty: o.items
        .filter((i) => !i.is_bonus)
        .reduce((acc, i) => acc.add(i.qty), new Prisma.Decimal(0))
        .toString(),
      total_sum: o.total_sum.toString(),
      bonus_qty: sumBonusQty(o.items),
      discount_sum: o.discount_sum.toString(),
      bonus_sum: o.bonus_sum.toString(),
      balance: finRow?.balance ?? null,
      debt: finRow?.debt ?? null,
      price_type: o.payment_method_ref?.trim() || null,
      comment: (o as { comment?: string | null }).comment ?? null,
      request_type_ref: (o as { request_type_ref?: string | null }).request_type_ref ?? null,
      payment_method_ref: o.payment_method_ref?.trim() || null,
      created_at: o.created_at.toISOString(),
      allowed_next_statuses: allowedNextForRole(o.status, viewerRole)
    };
    }),
    total,
    page: q.page,
    limit: q.limit,
    ...(cursorPack
      ? { next_cursor: cursorPack.nextCursor, has_next: cursorPack.hasNext }
      : {})
  };

  if (!useCursor) {
    const cacheKey = `tenant:${tenantId}:orders:list:${stableJsonStringify({
      q,
      viewerRole,
      viewerUserId: viewerUserId ?? null
    })}`;
    void setAppCache(cacheKey, result, ORDERS_LIST_CACHE_TTL_SECONDS);
  }

  return result;
}

export async function getOrderDetail(
  tenantId: number,
  id: number,
  viewerRole?: string
): Promise<OrderDetailRow> {
  const o = await prisma.order.findFirst({
    where: { id, tenant_id: tenantId },
    include: orderDetailInclude
  });
  if (!o) {
    throw new Error("NOT_FOUND");
  }
  return enrichOrderDetailRow(tenantId, o as unknown as OrderDetailLoaded, viewerRole);
}
