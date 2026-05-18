/**
 * Reja 2-bosqich (qolgan): order-bonus-context, dashboard.supervisor.snapshot, order.create tx
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const orders = path.join(__dirname, "../src/modules/orders");
const ordersDomain = path.join(orders, "domain");
const dashboard = path.join(__dirname, "../src/modules/dashboard");

function read(p) {
  return fs.readFileSync(p, "utf8").split(/\r?\n/);
}
function slice(lines, a, b) {
  return lines.slice(a - 1, b).join("\n");
}
function write(p, c) {
  fs.writeFileSync(p, c.endsWith("\n") ? c : `${c}\n`);
}

// --- order-bonus-context ---
const ctxPath = path.join(orders, "order-bonus-context.ts");
const ctx = read(ctxPath);
const ctxHeader = slice(ctx, 1, 12);

write(
  path.join(orders, "order-bonus-context.fetch.ts"),
  `${ctxHeader}

${slice(ctx, 14, 211)}
`
);

write(
  path.join(orders, "order-bonus-context.match.ts"),
  `${ctxHeader}
import type { ProductLite, PaidLineDraft } from "./order-bonus-context.fetch";
import {
  BONUS_SUM_THRESHOLD_TIMEZONE,
  effectivePurchasedQtyForQtyRule,
  effectiveSubtotalForSumMinRule,
  fetchClientMonthMerchandiseSubtotalExclOrder,
  fetchClientMonthPaidQtyAggregateExclOrder,
  fetchClientMonthPaidQtyByProductExclOrder,
  fetchClientUsedAutoBonusRuleIds,
  fetchClientUsedAutoBonusRuleIdsExcludingOrder,
  ruleBlockedByOncePerClient,
  ruleHasPurchaseScope,
  ruleMatchesClient,
  ruleNeedsOrderContext,
  type OrderAgentBonusContext
} from "./order-bonus-context.fetch";

${slice(ctx, 213, 505)}
`
);

write(
  path.join(orders, "order-bonus-context.prereq.ts"),
  `${ctxHeader}
import {
  computeQtyBonusForRuleRow,
  mapBonusRuleFull,
  type BonusRuleRow
} from "../bonus-rules/bonus-rules.service";
import { Prisma as PrismaClient } from "@prisma/client";
import {
  effectivePurchasedQtyForQtyRule,
  effectiveSubtotalForSumMinRule,
  ruleHasPurchaseScope,
  ruleMatchesClient,
  ruleMatchesOrderAgentScope,
  ruleMatchesOrderProductScope,
  ruleMatchesProduct,
  ruleNeedsOrderContext,
  type OrderAgentBonusContext,
  type ProductLite
} from "./order-bonus-context.fetch";
import {
  QTY_AGGREGATE_PURCHASED_PID,
  resolveQtyGiftProductId,
  resolveSumRuleGiftProductId,
  ruleBlockedByOncePerClient,
  type QtyGiftResolveContext
} from "./order-bonus-context.match";
${slice(ctx, 507, ctx.length)}
`
);

// Fix prereq - QtyGiftResolveContext is exported from match, import from match not duplicate
// ruleTree uses ensurePrereqRule from same file - good

write(
  path.join(orders, "order-bonus-context.ts"),
  `/** Bonus context — barrel (fetch + match + prereq). */
export * from "./order-bonus-context.fetch";
export * from "./order-bonus-context.match";
export * from "./order-bonus-context.prereq";
`
);

// --- dashboard supervisor snapshot products ---
const snapPath = path.join(dashboard, "dashboard.supervisor.snapshot.ts");
const snap = read(snapPath);
const snapHeader = slice(snap, 1, 47);

write(
  path.join(dashboard, "dashboard.supervisor.snapshot-products.ts"),
  `${snapHeader}
import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { bigToNum, clampPct, decToString } from "./dashboard.helpers";
import type {
  SupervisorProductMatrixBlock,
  SupervisorProductMatrixRow,
  SupervisorProductRow
} from "./dashboard.supervisor.scope";

export type SupervisorProductAnalyticsBlocks = {
  product_analytics: {
    by_category: SupervisorProductRow[];
    by_group: SupervisorProductRow[];
    by_brand: SupervisorProductRow[];
  };
  product_matrix: {
    by_category: SupervisorProductMatrixBlock;
    by_group: SupervisorProductMatrixBlock;
    by_brand: SupervisorProductMatrixBlock;
  };
};

export async function loadSupervisorProductAnalyticsBlocks(
  orderScope: Prisma.Sql
): Promise<SupervisorProductAnalyticsBlocks> {
${slice(snap, 487, 737).replace(/^/gm, "  ")}
  return {
    product_analytics: {
      by_category: mapProductRows(productRowsCategory),
      by_group: mapProductRows(productRowsGroup),
      by_brand: mapProductRows(productRowsBrand)
    },
    product_matrix: {
      by_category: withBySupervisors(categoryMatrixByAgents, categoryMatrixBySupervisors),
      by_group: withBySupervisors(groupMatrixByAgents, groupMatrixBySupervisors),
      by_brand: withBySupervisors(brandMatrixByAgents, brandMatrixBySupervisors)
    }
  };
}
`
);

// Replace snapshot main: inject import + call, remove product block
const snapNew = `${snapHeader}
import { loadSupervisorProductAnalyticsBlocks } from "./dashboard.supervisor.snapshot-products";

export async function getSupervisorDashboardSnapshot(
  tenantId: number,
  filters: SupervisorDashboardFilters
): Promise<SupervisorDashboardSnapshot> {
${slice(snap, 53, 486)}

  const { product_analytics, product_matrix } = await loadSupervisorProductAnalyticsBlocks(orderScope);

${slice(snap, 740, 806)}

  const result: SupervisorDashboardSnapshot = {
    filters,
    kpi,
    product_analytics,
    product_matrix,
${slice(snap, 820, 827)}
  };
  await setSnapshotCache(snapshotKey, result);
  return result;
}
`;

write(snapPath, snapNew);

// --- order.create transaction ---
const createPath = path.join(ordersDomain, "order.create.ts");
const create = read(createPath);
const createHeader = slice(create, 1, 67);

write(
  path.join(ordersDomain, "order.create-tx.ts"),
  `${createHeader}
import type { OrderAgentBonusContext } from "../order-bonus-apply";
import type { BonusGiftOverrideInput, CreateOrderInput, OrderDetailLoaded } from "./order.types";

export type CreateOrderTxParams = {
  tenantId: number;
  input: CreateOrderInput;
  client: {
    id: number;
    category: string | null;
    credit_limit: Prisma.Decimal;
  };
  orderTypeEarly: ReturnType<typeof normalizeOrderType>;
  orderType: ReturnType<typeof normalizeOrderType>;
  priceType: string;
  lineData: Awaited<ReturnType<typeof buildCreateOrderLineData>>["lineData"];
  totalSum: Prisma.Decimal;
  qtyByProduct: Map<number, number>;
  productById: Map<number, { id: number; category_id: number | null }>;
  orderedProductIds: Set<number>;
  exchangeMetaJson: Prisma.InputJsonValue | null;
  orderAgentForBonus: OrderAgentBonusContext | null;
  validatedGiftOverrides: Map<number, number>;
  tempOrderNumber: string;
  isInboundShelfReturn: boolean;
  stackPolicy: import("../bonus-stack-policy").BonusStackPolicy;
};

export async function runCreateOrderTransaction(
  tx: Prisma.TransactionClient,
  p: CreateOrderTxParams
) {
  const {
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
    exchangeMetaJson,
    orderAgentForBonus,
    validatedGiftOverrides,
    tempOrderNumber,
    isInboundShelfReturn,
    stackPolicy
  } = p;

${slice(create, 201, 568)}
}
`
);

write(
  createPath,
  `${createHeader}
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
      credit_limit: true
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

  const priceType = (input.price_type ?? "").trim() || "retail";

  const {
    lineData,
    totalSum,
    qtyByProduct,
    productById,
    orderedProductIds,
    exchangeMetaJson
  } = await buildCreateOrderLineData(tenantId, input, orderTypeEarly, priceType);

  const tempOrderNumber = \`__\${tenantId}_\${Date.now()}_\${randomBytes(5).toString("hex")}\`;

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

  const order = await prisma.$transaction((tx) =>
    runCreateOrderTransaction(tx, {
      tenantId,
      input,
      client,
      orderTypeEarly,
      orderType,
      priceType,
      lineData,
      totalSum,
      qtyByProduct,
      productById,
      orderedProductIds,
      exchangeMetaJson,
      orderAgentForBonus,
      validatedGiftOverrides,
      tempOrderNumber,
      isInboundShelfReturn,
      stackPolicy
    })
  );

${slice(create, 571, create.length)}
`
);

console.log("phase4 split done");
