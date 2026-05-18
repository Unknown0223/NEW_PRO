/**
 * Reja 2-bosqich (qolgan): detail-mappers, create-lines, supervisor, staff.patches
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "../src/modules");

function read(p) {
  return fs.readFileSync(p, "utf8").split(/\r?\n/);
}
function slice(lines, a, b) {
  return lines.slice(a - 1, b).join("\n");
}
function write(p, c) {
  fs.writeFileSync(p, c.endsWith("\n") ? c : `${c}\n`);
}

// --- order.detail-* ---
const dmPath = path.join(root, "orders/domain/order.detail-mappers.ts");
const dm = read(dmPath);
const dmHeader = slice(dm, 1, 62);

write(
  path.join(root, "orders/domain/order.detail-bonus.ts"),
  `${dmHeader}
import {
  type BonusGiftOverrideInput,
  type BonusGiftSwapOptionRow,
  type OrderDetailLoaded,
  type OrderDetailRow,
  type OrderItemRow,
  type OrderListRow
} from "./order.types";

${slice(dm, 63, 170)}
`
);

write(
  path.join(root, "orders/domain/order.detail-row.ts"),
  `${dmHeader}
import { statusContributesToDeliveredReceivableDebt } from "../order-status";
import {
  allowedNextForRole,
  roundOrderMoney,
  sumBonusQty
} from "./order.detail-bonus";
import {
  type OrderDetailLoaded,
  type OrderDetailRow,
  type OrderItemRow,
  type OrderListRow
} from "./order.types";

${slice(dm, 172, 381)}
`
);

write(
  path.join(root, "orders/domain/order.detail-finance.ts"),
  `${dmHeader}
import { statusContributesToDeliveredReceivableDebt } from "../order-status";
import {
  loadDeliveryDebtByClient,
  mergeLedgerWithUnpaidDelivered
} from "../../client-balances/client-balances.service";
import { enrichOrderDetailRow } from "./order.detail-row";

${slice(dm, 383, dm.length)}
`
);

write(
  path.join(root, "orders/domain/order.detail-mappers.ts"),
  `/** Order detail helpers — barrel. */
export * from "./order.detail-bonus";
export * from "./order.detail-row";
export * from "./order.detail-finance";
`
);

// Fix detail-row: enrich shouldn't import from finance; finance imports enrich - remove bad import from finance file
let fin = fs.readFileSync(path.join(root, "orders/domain/order.detail-finance.ts"), "utf8");
fin = fin.replace(/import \{ enrichOrderDetailRow \} from "\.\/order\.detail-row";\n\n/, "");
write(path.join(root, "orders/domain/order.detail-finance.ts"), fin);

// detail-row needs enrich to use loadOrdersFinance - enrich calls loadOrdersFinance? grep
// enrich might call loadOrdersFinanceEnrichment - if so detail-row imports from finance - circular
// Check enrich function in original - line 322

// --- order.create-lines ---
const crPath = path.join(root, "orders/domain/order.create.ts");
const cr = read(crPath);
const crHeader = slice(cr, 1, 72);

const linesHelper = `${crHeader}
import type { CreateOrderInput, OrderViewerContext } from "./order.types";
import type { OrderAgentBonusContext } from "../order-bonus-apply";

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
${slice(cr, 169, 257).replace(/^  /gm, "  ")}
}
`;

write(path.join(root, "orders/domain/order.create-lines.ts"), linesHelper);

const createBody = `${crHeader}
import { buildCreateOrderLineData } from "./order.create-lines";
import {
  orderDetailInclude,
  type BonusGiftOverrideInput,
  type CreateOrderInput,
  type OrderDetailLoaded,
  type OrderDetailRow
} from "./order.types";

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

${slice(cr, 95, 168)}

  const priceType = (input.price_type ?? "").trim() || "retail";

  const {
    lineData,
    totalSum,
    qtyByProduct,
    productById,
    orderedProductIds,
    exchangeMetaJson
  } = await buildCreateOrderLineData(tenantId, input, orderTypeEarly, priceType);

${slice(cr, 259, cr.length)}
}
`;

write(path.join(root, "orders/domain/order.create.ts"), createBody);

// --- dashboard.supervisor ---
const supPath = path.join(root, "orders/domain/../../dashboard/dashboard.supervisor.ts");
const supPath2 = path.join(root, "dashboard/dashboard.supervisor.ts");
const sup = read(supPath2);
const supHeader = slice(sup, 1, 32);

write(
  path.join(root, "dashboard/dashboard.supervisor.scope.ts"),
  `${supHeader}
${slice(sup, 33, 360)}
`
);

write(
  path.join(root, "dashboard/dashboard.supervisor.snapshot.ts"),
  `${supHeader}
import {
  orderScopeSql,
  planScopeSql,
  visitScopeSql,
  type SupervisorDashboardFilters,
  type SupervisorDashboardSnapshot
} from "./dashboard.supervisor.scope";

${slice(sup, 362, sup.length)}
`
);

write(
  path.join(root, "dashboard/dashboard.supervisor.ts"),
  `/** Supervisor dashboard — barrel. */
export * from "./dashboard.supervisor.scope";
export * from "./dashboard.supervisor.snapshot";
`
);

// scope file needs types exported - types are in lines 33-168, scope slice 33-360 includes types + functions - good

// --- staff.patches ---
const patPath = path.join(root, "staff/staff.patches.ts");
const pat = read(patPath);
const patHeader = slice(pat, 1, 59);

write(
  path.join(root, "staff/staff.patches.field.ts"),
  `${patHeader}
import { listStaff, type PatchAgentInput, type SessionRowDto } from "./staff.crud";

${slice(pat, 61, 606)}
`
);

write(
  path.join(root, "staff/staff.patches.sessions.ts"),
  `${patHeader}
import { listStaff, type PatchAgentInput, type SessionRowDto } from "./staff.crud";

${slice(pat, 608, 924)}
`
);

write(
  path.join(root, "staff/staff.patches.web.ts"),
  `${patHeader}
import { listStaff, type PatchAgentInput, type SessionRowDto } from "./staff.crud";

${slice(pat, 926, pat.length)}
`
);

write(
  path.join(root, "staff/staff.patches.ts"),
  `/** Staff patch / sessions / web admin — barrel. */
export * from "./staff.patches.field";
export * from "./staff.patches.sessions";
export * from "./staff.patches.web";
`
);

// domain index - detail-mappers is barrel already
write(
  path.join(root, "orders/domain/index.ts"),
  `export * from "./order.types";
export * from "./order.detail-mappers";
export * from "./order.query";
export * from "./order.lifecycle";
export * from "./order.lines";
export * from "./order.meta";
export * from "./order.nakladnoy";
export * from "./order.create";
export * from "./order.create-lines";
`
);

console.log("Phase 3 split done.");
