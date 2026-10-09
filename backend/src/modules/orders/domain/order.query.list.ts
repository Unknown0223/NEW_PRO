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
import { getAppCache, invalidateDashboard, invalidateStock, ordersListCacheKey, setAppCache } from "../../../lib/redis-cache";
import { stableJsonStringify } from "../../dashboard/dashboard.cache";
import { enqueueOrderStatusNotifyJob } from "../../jobs/jobs.service";
import {
  buildOrderAgentScopeWhere,
  enrichScopedReportActor
} from "../../access/access-agent-scope";
import { clientIdsWithVisitWeekday } from "../../clients/clients.list.where";
import { isDiscountAlertCode } from "../order-discount-alert";
import { isBonusAlertCode } from "../order-bonus-stock-cap";
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
import {
  expandPaymentMethodFilterValues,
  findPriceTypeEntry,
  orderListPriceTypeLabel,
  priceTypeKey,
  resolvePriceTypeKeyToLabel
} from "../../tenant-settings/finance-refs";
import {
  loadPaymentMethodEntriesForResolve,
  loadPriceTypeEntriesForResolve
} from "../../tenant-settings/tenant-settings.service";
import { prepareExchangeOrderLines } from "../exchange-order-create";

import {
  allowedNextForRole,
  enrichOrderDetailRow,
  loadOrdersFinanceEnrichment,
  sumBonusQty
} from "./order.detail-mappers";
import {
  loadAgentTradeDirectionFromSlots,
  loadOrdersListMetaEnrichment
} from "./order.list-enrichment";
import { normalizeStoredCreationChannel } from "./order.creation-channel";
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

function sumOrderListVolumeM3(
  items: Array<{
    qty: Prisma.Decimal;
    is_bonus: boolean;
    product: { volume_m3: Prisma.Decimal | null } | null;
  }>
): string | null {
  let sum = new Prisma.Decimal(0);
  let any = false;
  for (const i of items) {
    if (i.is_bonus) continue;
    const v = i.product?.volume_m3;
    if (v == null || v.lte(0)) continue;
    sum = sum.add(i.qty.mul(v));
    any = true;
  }
  return any ? sum.toDecimalPlaces(4, Prisma.Decimal.ROUND_HALF_UP).toString() : null;
}

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
    const cacheKey = ordersListCacheKey(
      tenantId,
      stableJsonStringify({
        q,
        viewerRole,
        viewerUserId: viewerUserId ?? null
      })
    );
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

  const [pmEntriesForLabel, ptEntriesForLabel] = await Promise.all([
    loadPaymentMethodEntriesForResolve(tenantId),
    loadPriceTypeEntriesForResolve(tenantId)
  ]);

  const scopedActor = await enrichScopedReportActor(tenantId, {
    userId: viewerUserId ?? null,
    role: viewerRole
  });
  const agentScopeWhere = buildOrderAgentScopeWhere(scopedActor);
  if (agentScopeWhere) {
    andClauses.push(agentScopeWhere);
  }

  const statusParts = (q.status ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (statusParts.length === 1) andClauses.push({ status: statusParts[0] });
  else if (statusParts.length > 1) andClauses.push({ status: { in: statusParts } });
  if (q.client_id != null && Number.isFinite(q.client_id) && q.client_id > 0) {
    andClauses.push({ client_id: q.client_id });
  }
  const warehouseIds = (q.warehouse_ids?.length ? q.warehouse_ids : q.warehouse_id ? [q.warehouse_id] : []).filter(
    (id) => Number.isFinite(id) && id > 0
  );
  if (warehouseIds.length === 1) andClauses.push({ warehouse_id: warehouseIds[0] });
  else if (warehouseIds.length > 1) andClauses.push({ warehouse_id: { in: warehouseIds } });
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
  const expeditorIds = (
    q.expeditor_user_ids?.length ? q.expeditor_user_ids : q.expeditor_user_id ? [q.expeditor_user_id] : []
  ).filter((id) => Number.isFinite(id) && id > 0);
  if (expeditorIds.length === 1) andClauses.push({ expeditor_user_id: expeditorIds[0] });
  else if (expeditorIds.length > 1) andClauses.push({ expeditor_user_id: { in: expeditorIds } });
  if (viewerRole === "gruzchik" && viewerUserId != null && viewerUserId > 0) {
    andClauses.push({ warehouse_block: { is: { gruzchik_user_id: viewerUserId } } });
  }
  const visitDays = (
    q.visit_weekdays?.length ? q.visit_weekdays : q.visit_weekday != null ? [q.visit_weekday] : []
  ).filter((n) => Number.isFinite(n) && n >= 1 && n <= 7);
  if (visitDays.length > 0) {
    const visitSets = await Promise.all(visitDays.map((d) => clientIdsWithVisitWeekday(tenantId, d)));
    const visitClientIds = [...new Set(visitSets.flat())];
    if (visitClientIds.length === 0) {
      return { data: [], total: 0, page: q.page, limit: q.limit };
    }
    andClauses.push({ client_id: { in: visitClientIds } });
  }
  const discountParts = (q.discount_alert ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (discountParts.includes("any")) {
    andClauses.push({ discount_alert: { not: null } });
  } else {
    const codes = discountParts.filter((s) => isDiscountAlertCode(s));
    if (codes.length === 1) andClauses.push({ discount_alert: codes[0] });
    else if (codes.length > 1) andClauses.push({ discount_alert: { in: codes } });
  }
  const bonusParts = (q.bonus_alert ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (bonusParts.includes("any")) {
    andClauses.push({ bonus_alert: { not: null } });
  } else {
    const codes = bonusParts.filter((s) => isBonusAlertCode(s));
    if (codes.length === 1) andClauses.push({ bonus_alert: codes[0] });
    else if (codes.length > 1) andClauses.push({ bonus_alert: { in: codes } });
  }
  const orderAlert = q.order_alert?.trim();
  if (orderAlert === "any") {
    andClauses.push({ OR: [{ discount_alert: { not: null } }, { bonus_alert: { not: null } }] });
  }
  const cats = (q.client_category ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (cats.length === 1) andClauses.push({ client: { category: cats[0] } });
  else if (cats.length > 1) andClauses.push({ client: { category: { in: cats } } });
  const regs = (q.client_region ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (regs.length === 1) andClauses.push({ client: { region: { equals: regs[0], mode: "insensitive" } } });
  else if (regs.length > 1) {
    andClauses.push({ OR: regs.map((reg) => ({ client: { region: { equals: reg, mode: "insensitive" as const } } })) });
  }
  const cities = (q.client_city ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (cities.length > 0) {
    andClauses.push({
      OR: cities.flatMap((cityF) => [
        { client: { city: { equals: cityF, mode: "insensitive" as const } } },
        { client: { district: { equals: cityF, mode: "insensitive" as const } } }
      ])
    });
  }
  const zones = (q.client_zone ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (zones.length === 1) andClauses.push({ client: { zone: { equals: zones[0], mode: "insensitive" } } });
  else if (zones.length > 1) {
    andClauses.push({ OR: zones.map((zoneF) => ({ client: { zone: { equals: zoneF, mode: "insensitive" as const } } })) });
  }
  const tradeDirs = (q.agent_trade_direction ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const tradeDir = tradeDirs[0];
  if (tradeDirs.length > 1) {
    andClauses.push({
      OR: tradeDirs.map((dir) => ({
        agent: {
          OR: [
            { trade_direction: dir },
            { trade_direction_row: { is: { OR: [{ code: dir }, { name: dir }] } } }
          ]
        }
      }))
    });
  } else if (tradeDir) {
    andClauses.push({
      agent: {
        OR: [
          { trade_direction: tradeDir },
          { trade_direction_row: { is: { OR: [{ code: tradeDir }, { name: tradeDir }] } } }
        ]
      }
    });
  }
  const productIds = (q.product_ids?.length ? q.product_ids : q.product_id ? [q.product_id] : []).filter(
    (id) => Number.isFinite(id) && id > 0
  );
  if (productIds.length === 1) andClauses.push({ items: { some: { product_id: productIds[0] } } });
  else if (productIds.length > 1) andClauses.push({ items: { some: { product_id: { in: productIds } } } });
  const orderTypes = (q.order_type ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (orderTypes.length === 1) andClauses.push({ order_type: orderTypes[0] });
  else if (orderTypes.length > 1) andClauses.push({ order_type: { in: orderTypes } });
  if (q.is_consignment === true) {
    andClauses.push({ is_consignment: true });
  } else if (q.is_consignment === false) {
    andClauses.push({ is_consignment: false });
  }
  const categoryIds = (
    q.product_category_ids?.length ? q.product_category_ids : q.product_category_id ? [q.product_category_id] : []
  ).filter((id) => Number.isFinite(id) && id > 0);
  if (categoryIds.length > 0) {
    andClauses.push({
      items: {
        some: {
          is_bonus: false,
          product: { tenant_id: tenantId, category_id: categoryIds.length === 1 ? categoryIds[0] : { in: categoryIds } }
        }
      }
    });
  }
  const payTypes = (q.payment_type ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (payTypes.length === 1) {
    andClauses.push({ payments: { some: { payment_type: payTypes[0], deleted_at: null } } });
  } else if (payTypes.length > 1) {
    andClauses.push({ payments: { some: { payment_type: { in: payTypes }, deleted_at: null } } });
  }

  const reqTypes = (q.request_type_ref ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (reqTypes.length === 1) andClauses.push({ request_type_ref: reqTypes[0] });
  else if (reqTypes.length > 1) andClauses.push({ request_type_ref: { in: reqTypes } });

  const pmRefs = (q.payment_method_ref ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const priceTypes = (q.list_price_type ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (pmRefs.length > 0) {
    const aliases = expandPaymentMethodFilterValues(
      pmRefs,
      pmEntriesForLabel,
      ptEntriesForLabel
    );
    andClauses.push({ payment_method_ref: { in: aliases } });
  } else if (priceTypes.length > 0) {
    const aliases = expandPaymentMethodFilterValues(priceTypes, pmEntriesForLabel, ptEntriesForLabel);
    const ptKeys = [
      ...new Set(
        priceTypes.flatMap((listPriceType) => {
          const pt = findPriceTypeEntry(listPriceType, ptEntriesForLabel);
          return [listPriceType, ...(pt ? [priceTypeKey(pt), pt.id, pt.code ?? "", pt.name] : [])];
        })
          .map((s) => s.trim())
          .filter(Boolean)
      )
    ];
    andClauses.push({
      OR: [{ price_type: { in: ptKeys } }, { price_type: null, payment_method_ref: { in: aliases } }]
    });
  }

  const parsedPeriods = (() => {
    const raw = q.date_periods?.trim() ?? "";
    if (!raw) return [] as Array<{ from: Date; to: Date }>;
    const out: Array<{ from: Date; to: Date }> = [];
    for (const part of raw.split(",")) {
      const chunk = part.trim();
      if (!chunk) continue;
      const [a, b] = chunk.split("_");
      const fromIso = a?.trim() ?? "";
      const toIso = b?.trim() ?? "";
      const fromD = fromIso ? parseListOrderLocalDayStart(fromIso) : null;
      const toD = toIso ? parseListOrderLocalDayEnd(toIso) : null;
      if (!fromD || !toD || fromD.getTime() > toD.getTime()) continue;
      out.push({ from: fromD, to: toD });
    }
    return out;
  })();

  const fromD = q.date_from?.trim() ? parseListOrderLocalDayStart(q.date_from.trim()) : null;
  const toD = q.date_to?.trim() ? parseListOrderLocalDayEnd(q.date_to.trim()) : null;
  if (parsedPeriods.length === 0 && fromD && toD && fromD.getTime() > toD.getTime()) {
    return { data: [], total: 0, page: q.page, limit: q.limit };
  }

  const rawMode = (q.date_mode?.trim() || "order").toLowerCase();
  const statusLogDate = rawMode === "ship" ? "delivering" : rawMode === "delivery" ? "delivered" : null;

  const pushDateRangeClause = (range: Prisma.DateTimeFilter) => {
    if (statusLogDate) {
      andClauses.push({
        status_logs: {
          some: {
            to_status: statusLogDate,
            created_at: range
          }
        }
      });
    } else {
      // «Дата заказа» / «Дата создания» — Order.created_at (UI: created_at / list_created_at)
      andClauses.push({ created_at: range });
    }
  };

  if (parsedPeriods.length > 0) {
    if (statusLogDate) {
      andClauses.push({
        OR: parsedPeriods.map((p) => ({
          status_logs: {
            some: {
              to_status: statusLogDate,
              created_at: { gte: p.from, lte: p.to }
            }
          }
        }))
      });
    } else {
      andClauses.push({
        OR: parsedPeriods.map((p) => ({
          created_at: { gte: p.from, lte: p.to }
        }))
      });
    }
  } else if (fromD || toD) {
    const range: Prisma.DateTimeFilter = {};
    if (fromD) range.gte = fromD;
    if (toD) range.lte = toD;
    pushDateRangeClause(range);
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
            legal_name: true,
            client_code: true,
            phone: true,
            inn: true,
            address: true,
            landmark: true,
            sales_channel: true,
            region: true,
            city: true,
            district: true,
            zone: true
          }
        },
        warehouse: { select: { name: true } },
        warehouse_block: { select: { id: true, name: true } },
        agent: {
          select: {
            login: true,
            name: true,
            code: true,
            consignment: true,
            trade_direction: true,
            trade_direction_row: { select: { code: true, name: true } }
          }
        },
        expeditor_user: { select: { id: true, login: true, name: true } },
        items: {
          select: {
            qty: true,
            is_bonus: true,
            product: { select: { volume_m3: true } }
          }
        }
      }
    })
  ]);

  const cursorPack = useCursor ? cursorPagination(rowsRaw, (r) => r.id, q.limit) : null;
  const rows = cursorPack?.data ?? rowsRaw;

  const exchangeIds = rows
    .filter((o) => (o.order_type ?? "order") === "exchange")
    .map((o) => o.id);
  const exchangeMetaById = new Map<number, unknown>();
  if (exchangeIds.length > 0) {
    const exRows = await prisma.order.findMany({
      where: { tenant_id: tenantId, id: { in: exchangeIds } },
      select: { id: true, exchange_meta: true }
    });
    for (const er of exRows) {
      exchangeMetaById.set(er.id, er.exchange_meta);
    }
  }

  const meta = await loadOrdersListMetaEnrichment(
    tenantId,
    rows.map((o) => ({
      id: o.id,
      order_type: o.order_type ?? "order",
      comment: o.comment ?? null,
      exchange_meta: exchangeMetaById.get(o.id) ?? null,
      agent_id: o.agent_id,
      client_id: o.client_id,
      agent_login: o.agent?.login ?? null,
      agent_name: o.agent?.name ?? null,
      created_at: o.created_at,
      status: o.status
    }))
  );

  const agentsMissingTradeDir = [
    ...new Set(
      rows
        .filter((o) => {
          if (o.agent_id == null) return false;
          const fromUser =
            o.agent?.trade_direction_row?.name?.trim() ||
            o.agent?.trade_direction_row?.code?.trim() ||
            o.agent?.trade_direction?.trim() ||
            null;
          return !fromUser;
        })
        .map((o) => o.agent_id as number)
    )
  ];
  const slotTradeDir = await loadAgentTradeDirectionFromSlots(tenantId, agentsMissingTradeDir);

  // «Тип цены» ustuni: xom ref (UUID/kod) o‘rniga spravochnikdagi nom.
  const priceTypeDisplayLabel = (storedKey: string | null, refRaw: string | null): string | null =>
    storedKey
      ? resolvePriceTypeKeyToLabel(storedKey, ptEntriesForLabel)
      : orderListPriceTypeLabel(refRaw, pmEntriesForLabel, ptEntriesForLabel);

  const finance = await loadOrdersFinanceEnrichment(
    tenantId,
    rows.map((o) => ({
      id: o.id,
      client_id: o.client_id,
      order_type: o.order_type ?? "order",
      status: o.status,
      total_sum: o.total_sum,
      discount_sum: o.discount_sum,
      applied_auto_bonus_rule_ids: o.applied_auto_bonus_rule_ids ?? []
    }))
  );

  const returnMirrorIds = rows
    .filter((o) => {
      const t = o.order_type ?? "order";
      return t === "return" || t === "return_by_order" || t === "partial_return";
    })
    .map((o) => o.id);
  const returnDiscountByMirror = new Map<
    number,
    { amount: Prisma.Decimal; note: string | null }
  >();
  if (returnMirrorIds.length > 0) {
    const srets = await prisma.salesReturn.findMany({
      where: { tenant_id: tenantId, mirror_order_id: { in: returnMirrorIds } },
      select: {
        mirror_order_id: true,
        discount_debt_amount: true,
        discount_debt_note: true
      }
    });
    for (const sr of srets) {
      if (sr.mirror_order_id == null) continue;
      if (sr.discount_debt_amount != null && sr.discount_debt_amount.gt(0)) {
        returnDiscountByMirror.set(sr.mirror_order_id, {
          amount: sr.discount_debt_amount,
          note: sr.discount_debt_note
        });
      }
    }
  }

  const result = {
    data: rows.map((o) => {
      const ex = o.expeditor_user;
      const expeditorDisplay = ex ? `${ex.login} (${ex.name})` : null;
      const finRow = finance.get(o.id);
      const metaRow = meta.get(o.id);
      const retDisc = returnDiscountByMirror.get(o.id);
      const discountSum =
        retDisc != null
          ? retDisc.amount.toString()
          : o.discount_sum.toString();
      const discountDebtNote = retDisc?.note ?? null;
      return {
      id: o.id,
      number: o.number,
      order_type: o.order_type ?? "order",
      client_id: o.client_id,
      client_name: o.client.name,
      client_code: o.client.client_code?.trim() || null,
      client_legal_name: o.client.legal_name?.trim() || null,
      client_phone: o.client.phone?.trim() || null,
      client_inn: o.client.inn?.trim() || null,
      client_address: o.client.address?.trim() || null,
      order_location: o.client.landmark?.trim() || null,
      sales_channel: o.client.sales_channel?.trim() || null,
      volume_m3: sumOrderListVolumeM3(o.items),
      cumulative_bonus: null,
      consignment_due_date: o.consignment_due_date
        ? o.consignment_due_date.toISOString()
        : null,
      warehouse_id: o.warehouse_id,
      warehouse_name: o.warehouse?.name ?? null,
      warehouse_block_id: (o as { warehouse_block_id?: number | null }).warehouse_block_id ?? null,
      warehouse_block_name: (o as { warehouse_block?: { name: string } | null }).warehouse_block?.name ?? null,
      agent_id: o.agent_id,
      agent_name: o.agent?.name ?? null,
      agent_code: o.agent?.code ?? null,
      agent_trade_direction:
        o.agent?.trade_direction_row?.name?.trim() ||
        o.agent?.trade_direction_row?.code?.trim() ||
        o.agent?.trade_direction?.trim() ||
        (o.agent_id != null ? slotTradeDir.get(o.agent_id) ?? null : null),
      expeditors: expeditorDisplay,
      expeditor_id: ex?.id ?? null,
      expeditor_display: expeditorDisplay,
      region: o.client.region ?? null,
      city: o.client.city ?? o.client.district ?? null,
      zone: o.client.zone ?? null,
      consignment: o.agent?.consignment ?? null,
      is_consignment: o.is_consignment ?? false,
      day: metaRow?.day ?? null,
      created_by: metaRow?.created_by ?? null,
      created_by_role: metaRow?.created_by_role ?? null,
      source_order_numbers: metaRow?.source_order_numbers ?? [],
      source_order_ids: metaRow?.source_order_ids ?? [],
      returned_at: metaRow?.returned_at ?? null,
      creation_channel: normalizeStoredCreationChannel(
        (o as { creation_channel?: string | null }).creation_channel,
        metaRow?.creation_channel ?? "web"
      ),
      expected_ship_date: metaRow?.expected_ship_date ?? null,
      shipped_at: metaRow?.shipped_at ?? finRow?.shipped_at ?? null,
      delivered_at: metaRow?.delivered_at ?? finRow?.delivered_at ?? null,
      list_created_at: metaRow?.list_created_at ?? o.created_at.toISOString(),
      status: o.status,
      qty: o.items
        .filter((i) => !i.is_bonus)
        .reduce((acc, i) => acc.add(i.qty), new Prisma.Decimal(0))
        .toString(),
      total_sum: o.total_sum.toString(),
      bonus_qty: sumBonusQty(o.items),
      discount_sum: discountSum,
      discount_debt_note: discountDebtNote,
      discount_alert: (o as { discount_alert?: string | null }).discount_alert ?? null,
      bonus_alert: (o as { bonus_alert?: string | null }).bonus_alert ?? null,
      bonus_sum: o.bonus_sum.toString(),
      balance: finRow?.balance ?? null,
      debt: finRow?.debt ?? null,
      price_type: priceTypeDisplayLabel(o.price_type?.trim() || null, o.payment_method_ref?.trim() || null),
      comment: (o as { comment?: string | null }).comment ?? null,
      request_type_ref: (o as { request_type_ref?: string | null }).request_type_ref ?? null,
      payment_method_ref: o.payment_method_ref?.trim() || null,
      created_at: o.created_at.toISOString(),
      allowed_next_statuses: allowedNextForRole(o.status, viewerRole, o.order_type ?? "order")
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
    const cacheKey = ordersListCacheKey(
      tenantId,
      stableJsonStringify({
        q,
        viewerRole,
        viewerUserId: viewerUserId ?? null
      })
    );
    void setAppCache(cacheKey, result, ORDERS_LIST_CACHE_TTL_SECONDS);
  }

  return result;
}
