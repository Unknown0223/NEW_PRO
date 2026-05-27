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
import { buildWarehouseLoadXlsx } from "../warehouse-templates/build-warehouse-load-xlsx";
import { buildExpeditorLoadingXlsx } from "../warehouse-templates/build-expeditor-loading-xlsx";
import {
  isExpeditorLoadingLayoutId,
  expeditorLoadingDownloadFilename,
  type ExpeditorLoadingLayoutId
} from "../warehouse-templates/expeditor-loading-template-ids";
import {
  isWarehouseLayoutId,
  warehouseLayoutDownloadFilename,
  type WarehouseLayoutId
} from "../warehouse-templates/warehouse-template-ids";
import { buildNakladnoyPdf } from "../order-nakladnoy-pdf";
import {
  loadDeliveryDebtByClient,
  mergeLedgerWithUnpaidDelivered
} from "../../client-balances/client-balances.service";
import { resolvePaymentMethodRefToLabel } from "../../tenant-settings/finance-refs";
import { loadPaymentMethodEntriesForResolve } from "../../tenant-settings/tenant-settings.service";
import { prepareExchangeOrderLines } from "../exchange-order-create";

export const NAKLADNOY_TEMPLATE_IDS = ["nakladnoy_warehouse", "nakladnoy_expeditor"] as const;
export type NakladnoyTemplateId = (typeof NAKLADNOY_TEMPLATE_IDS)[number];

export type BulkNakladnoyFileResult = {
  buffer: Buffer;
  filename: string;
  template: NakladnoyTemplateId;
  format: "xlsx" | "pdf";
  order_ids: number[];
};

type OrderNakladnoyDb = {
  id: number;
  number: string;
  agent_id: number | null;
  expeditor_user_id: number | null;
  created_at: Date;
  tenant: { name: string; phone: string | null };
  warehouse: { name: string } | null;
  agent: {
    login: string;
    name: string;
    code: string | null;
    phone: string | null;
    territory: string | null;
    branch: string | null;
    created_at: Date;
  } | null;
  expeditor_user: {
    login: string;
    name: string;
    code: string | null;
    phone: string | null;
    branch: string | null;
    created_at: Date;
  } | null;
  client: {
    name: string;
    address: string | null;
    region: string | null;
    city: string | null;
    district: string | null;
    neighborhood: string | null;
    street: string | null;
    house_number: string | null;
    phone: string | null;
    client_balances: { balance: Prisma.Decimal }[];
  };
  items: Array<{
    id: number;
    product_id: number;
    qty: Prisma.Decimal;
    price: Prisma.Decimal;
    total: Prisma.Decimal;
    is_bonus: boolean;
    product: {
      sku: string;
      barcode: string | null;
      name: string;
      qty_per_block: number | null;
      category: { name: string } | null;
      product_group: { name: string } | null;
    };
  }>;
};

function fmtRuDateShort(d: Date): string {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

export function mapOrderToNakladnoyPayload(o: OrderNakladnoyDb): NakladnoyOrderPayload {
  const bal = o.client.client_balances[0]?.balance ?? null;
  const ag = o.agent;
  const agentLine = ag
    ? `${ag.code?.trim() || ag.login}- [${ag.name}]${ag.phone?.trim() ? ` ${ag.phone.trim()}` : ""}`
    : "—";
  const ex = o.expeditor_user;
  const tag = (ex?.branch ?? ex?.code ?? ex?.login ?? "").toString().trim() || "—";
  const expeditorLine = ex
    ? `[${tag}] ${ex.name} (${fmtRuDateShort(ex.created_at)})${ex.phone?.trim() ? ` ${ex.phone.trim()}` : ""}`
    : "—";
  const territory =
    o.client.region?.trim() || ag?.territory?.trim() || "—";
  const addrParts = [
    o.client.region,
    o.client.city,
    o.client.district,
    o.client.neighborhood,
    o.client.street,
    o.client.house_number
  ]
    .map((x) => (x ?? "").trim())
    .filter(Boolean);
  const clientAddress = (o.client.address?.trim() || addrParts.join(", ") || "—").trim();

  const bonusQtyByProduct = new Map<number, Prisma.Decimal>();
  for (const it of o.items) {
    if (!it.is_bonus) continue;
    const prev = bonusQtyByProduct.get(it.product_id) ?? new Prisma.Decimal(0);
    bonusQtyByProduct.set(it.product_id, prev.add(it.qty));
  }

  const groupTitleOf = (it: (typeof o.items)[0]) =>
    it.product.product_group?.name?.trim() ||
    it.product.category?.name?.trim() ||
    "Прочее";

  const lines: NakladnoyLine[] = [];
  const paidLines: NakladnoyLine[] = [];
  const bonusLines: NakladnoyLine[] = [];

  for (const it of o.items) {
    if (it.is_bonus) {
      const ln: NakladnoyLine = {
        productId: it.product_id,
        sku: it.product.sku,
        barcode: it.product.barcode,
        name: it.product.name,
        qty: Number(it.qty.toString()),
        bonusQty: 0,
        price: Number(it.price.toString()),
        sum: Number(it.total.toString()),
        groupTitle: groupTitleOf(it),
        qtyPerBlock: it.product.qty_per_block
      };
      bonusLines.push(ln);
      continue;
    }
    let bonusQty = 0;
    if (bonusQtyByProduct.has(it.product_id)) {
      const bdec = bonusQtyByProduct.get(it.product_id)!;
      bonusQty = Number(bdec.toString());
      bonusQtyByProduct.delete(it.product_id);
    }
    const ln: NakladnoyLine = {
      productId: it.product_id,
      sku: it.product.sku,
      barcode: it.product.barcode,
      name: it.product.name,
      qty: Number(it.qty.toString()),
      bonusQty,
      price: Number(it.price.toString()),
      sum: Number(it.total.toString()),
      groupTitle: groupTitleOf(it),
      qtyPerBlock: it.product.qty_per_block
    };
    lines.push(ln);
    paidLines.push(ln);
  }

  for (const it of o.items) {
    if (!it.is_bonus) continue;
    const hasPaid = o.items.some((x) => !x.is_bonus && x.product_id === it.product_id);
    if (hasPaid) continue;
    lines.push({
      productId: it.product_id,
      sku: it.product.sku,
      barcode: it.product.barcode,
      name: it.product.name,
      qty: 0,
      bonusQty: Number(it.qty.toString()),
      price: 0,
      sum: 0,
      groupTitle: groupTitleOf(it),
      qtyPerBlock: it.product.qty_per_block
    });
  }

  return {
    id: o.id,
    number: o.number,
    createdAt: o.created_at,
    agentId: o.agent_id,
    expeditorUserId: o.expeditor_user_id,
    tenantName: o.tenant.name,
    tenantPhone: o.tenant.phone,
    clientName: o.client.name,
    clientBalanceNum: bal,
    clientAddress,
    currencyLabel: "So'm (UZS)",
    agentLine,
    expeditorLine,
    territory,
    warehouseName: o.warehouse?.name ?? null,
    lines,
    paidLines,
    bonusLines
  };
}

export async function requestBulkOrderNakladnoy(
  tenantId: number,
  orderIds: number[],
  template: string,
  buildOptions: NakladnoyBuildOptions = DEFAULT_NAKLADNOY_BUILD_OPTIONS,
  format: "xlsx" | "pdf" = "xlsx",
  warehouseLayout?: string | null,
  expeditorLoadingLayout?: string | null
): Promise<BulkNakladnoyFileResult> {
  if (!NAKLADNOY_TEMPLATE_IDS.includes(template as NakladnoyTemplateId)) {
    throw new Error("INVALID_NAKLADNOY_TEMPLATE");
  }
  const tid = template as NakladnoyTemplateId;
  let layoutId: WarehouseLayoutId | null = null;
  let expLayoutId: ExpeditorLoadingLayoutId | null = null;
  if (warehouseLayout != null && warehouseLayout !== "") {
    if (!isWarehouseLayoutId(warehouseLayout)) {
      throw new Error("INVALID_WAREHOUSE_LAYOUT");
    }
    layoutId = warehouseLayout;
    if (tid !== "nakladnoy_warehouse") {
      throw new Error("INVALID_WAREHOUSE_LAYOUT");
    }
    if (format === "pdf") {
      throw new Error("WAREHOUSE_LAYOUT_XLSX_ONLY");
    }
  }
  if (expeditorLoadingLayout != null && expeditorLoadingLayout !== "") {
    if (!isExpeditorLoadingLayoutId(expeditorLoadingLayout)) {
      throw new Error("INVALID_EXPEDITOR_LOADING_LAYOUT");
    }
    expLayoutId = expeditorLoadingLayout;
    if (layoutId != null) {
      throw new Error("INVALID_EXPEDITOR_LOADING_LAYOUT");
    }
    if (format === "pdf") {
      throw new Error("EXPEDITOR_LOADING_LAYOUT_XLSX_ONLY");
    }
  }
  const ids = [...new Set(orderIds.filter((id) => Number.isFinite(id) && id > 0))].sort((a, b) => a - b);
  if (ids.length === 0) {
    throw new Error("EMPTY_ORDER_IDS");
  }
  if (ids.length > 500) {
    throw new Error("TOO_MANY_ORDERS");
  }
  const rows = await prisma.order.findMany({
    where: { tenant_id: tenantId, id: { in: ids } },
    select: { id: true }
  });
  const found = new Set(rows.map((r) => r.id));
  const missing = ids.filter((id) => !found.has(id));
  if (missing.length > 0) {
    const err = new Error("ORDERS_NOT_FOUND") as Error & { missing_ids: number[] };
    err.missing_ids = missing;
    throw err;
  }

  const loaded = await prisma.order.findMany({
    where: { tenant_id: tenantId, id: { in: ids } },
    orderBy: { id: "asc" },
    include: {
      tenant: { select: { name: true, phone: true } },
      warehouse: { select: { name: true } },
      agent: {
        select: {
          login: true,
          name: true,
          code: true,
          phone: true,
          territory: true,
          branch: true,
          created_at: true
        }
      },
      expeditor_user: {
        select: {
          login: true,
          name: true,
          code: true,
          phone: true,
          branch: true,
          created_at: true
        }
      },
      client: {
        select: {
          name: true,
          address: true,
          region: true,
          city: true,
          district: true,
          neighborhood: true,
          street: true,
          house_number: true,
          phone: true,
          client_balances: {
            where: { tenant_id: tenantId },
            take: 1,
            select: { balance: true }
          }
        }
      },
      items: {
        orderBy: { id: "asc" },
        include: {
          product: {
            select: {
              sku: true,
              barcode: true,
              name: true,
              qty_per_block: true,
              category: { select: { name: true } },
              product_group: { select: { name: true } }
            }
          }
        }
      }
    }
  });

  const byId = new Map(loaded.map((x) => [x.id, x]));
  const ordered = ids.map((id) => byId.get(id)!).map((o) => mapOrderToNakladnoyPayload(o as OrderNakladnoyDb));

  const buffer =
    layoutId != null
      ? await buildWarehouseLoadXlsx(layoutId, ordered, buildOptions)
      : expLayoutId != null
        ? await buildExpeditorLoadingXlsx(expLayoutId, ordered, buildOptions)
        : format === "pdf"
          ? await buildNakladnoyPdf(tid, ordered)
          : await buildNakladnoyXlsx(tid, ordered, buildOptions);
  const day = new Date().toISOString().slice(0, 10);
  const filename =
    layoutId != null
      ? warehouseLayoutDownloadFilename(layoutId)
      : expLayoutId != null
        ? expeditorLoadingDownloadFilename(expLayoutId)
        : tid === "nakladnoy_warehouse"
          ? `zagruz_zav_sklda_5_1_8_${day}.${format}`
          : `nakladnye_2_1_0_${day}.${format}`;

  return {
    buffer,
    filename,
    template: tid,
    format,
    order_ids: ids
  };
}


