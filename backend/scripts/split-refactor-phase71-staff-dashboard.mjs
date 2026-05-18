/**
 * v4 — staff.crud.create + dashboard.sales.snapshot bo‘linishi.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));

function read(p) {
  return fs.readFileSync(path.join(root, "..", p), "utf8").split(/\r?\n/);
}
function slice(lines, a, b) {
  return lines.slice(a - 1, b).join("\n");
}
function w(p, c) {
  fs.writeFileSync(path.join(root, "..", p), c.endsWith("\n") ? c : `${c}\n`);
}

const staffLines = read("src/modules/staff/staff.crud.create.backup.ts");
const dashLines = read("src/modules/dashboard/dashboard.sales.snapshot.backup.ts");

// --- staff ---
w(
  "src/modules/staff/staff.crud.create.shared.ts",
  `import { prisma } from "../../config/database";

export async function syncStaffUserRoleLink(
  tenantId: number,
  userId: number,
  roleKey: string
): Promise<void> {
  const role = await prisma.role.upsert({
    where: { tenant_id_key: { tenant_id: tenantId, key: roleKey } },
    create: { tenant_id: tenantId, key: roleKey, name: roleKey },
    update: { name: roleKey }
  });
  await prisma.userRole.createMany({
    data: [{ user_id: userId, role_id: role.id }],
    skipDuplicates: true
  });
}
`
);

w(
  "src/modules/staff/staff.crud.create.web.ts",
  `import bcrypt from "bcryptjs";
import { prisma } from "../../config/database";
import { createCashDeskUserLink } from "../cash-desks/cash-desks.service";
import { appendTenantAuditEvent, AuditEntityType } from "../../lib/tenant-audit";
import { DISTRIBUTION_WEB_STAFF_ROLES } from "../../lib/tenant-user-roles";
import type { CreateStaffInput, StaffKind, StaffRow } from "./staff.shared";
import { kindRole } from "./staff.shared";
import { listStaff } from "./staff.crud.list";
import { syncStaffUserRoleLink } from "./staff.crud.create.shared";

export async function createWebStaff(
  tenantId: number,
  kind: StaffKind,
  input: CreateStaffInput,
  actorUserId: number | null,
  login: string,
  firstName: string
): Promise<StaffRow> {
${slice(staffLines, 90, 169).replace(/syncUserRoleLink/g, "syncStaffUserRoleLink")}
}
`
);

w(
  "src/modules/staff/staff.crud.create.skladchik.ts",
  `import bcrypt from "bcryptjs";
import { prisma } from "../../config/database";
import { appendTenantAuditEvent, AuditEntityType } from "../../lib/tenant-audit";
import type { CreateStaffInput, StaffRow } from "./staff.shared";
import {
  SKLADCHIK_WAREHOUSE_LINK_ROLE,
  assertWarehousesBelongToTenant,
  normalizePositiveIntIds,
  toPrismaJsonEntitlements
} from "./staff.shared";
import { listStaff } from "./staff.crud.list";
import { syncStaffUserRoleLink } from "./staff.crud.create.shared";

export async function createSkladchikStaff(
  tenantId: number,
  input: CreateStaffInput,
  actorUserId: number | null,
  login: string,
  firstName: string
): Promise<StaffRow> {
${slice(staffLines, 173, 252).replace(/syncUserRoleLink/g, "syncStaffUserRoleLink")}
}
`
);

w(
  "src/modules/staff/staff.crud.create.field.ts",
  `import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { appendTenantAuditEvent, AuditEntityType } from "../../lib/tenant-audit";
import type { CreateStaffInput, StaffCreateResult, StaffKind } from "./staff.shared";
import {
  STAFF_KINDS_WITH_WORK_SLOT,
  kindRole,
  normalizeAgentEntitlementsInput,
  normalizePriceTypes,
  tradeDirectionForCreate,
  validateAgentEntitlements
} from "./staff.shared";
import { listStaff } from "./staff.crud.list";
import { syncStaffUserRoleLink } from "./staff.crud.create.shared";

export async function createFieldStaff(
  tenantId: number,
  kind: StaffKind,
  input: CreateStaffInput,
  actorUserId: number | null,
  login: string,
  firstName: string
): Promise<StaffCreateResult> {
${slice(staffLines, 255, 375).replace(/syncUserRoleLink/g, "syncStaffUserRoleLink")}
}
`
);

w("src/modules/staff/staff.crud.create.types.ts", slice(staffLines, 378, 386));

w(
  "src/modules/staff/staff.crud.create.ts",
  `import { prisma } from "../../config/database";
import { DISTRIBUTION_WEB_STAFF_ROLES } from "../../lib/tenant-user-roles";
import type { CreateStaffInput, StaffCreateResult, StaffKind } from "./staff.shared";
import { createFieldStaff } from "./staff.crud.create.field";
import { createSkladchikStaff } from "./staff.crud.create.skladchik";
import { createWebStaff } from "./staff.crud.create.web";

export type { SessionRowDto } from "./staff.crud.create.types";

export async function createStaff(
  tenantId: number,
  kind: StaffKind,
  input: CreateStaffInput,
  actorUserId: number | null = null
): Promise<StaffCreateResult> {
  const login = input.login.trim().toLowerCase();
  if (!login) throw new Error("BAD_LOGIN");
  if (input.password.length < 6) throw new Error("BAD_PASSWORD");
  const firstName = input.first_name.trim();
  if (!firstName) throw new Error("BAD_FIRST_NAME");

  const exists = await prisma.user.findFirst({ where: { tenant_id: tenantId, login } });
  if (exists) throw new Error("LOGIN_EXISTS");

  if (kind === "operator" || (DISTRIBUTION_WEB_STAFF_ROLES as readonly string[]).includes(kind)) {
    return createWebStaff(tenantId, kind, input, actorUserId, login, firstName);
  }
  if (kind === "skladchik") {
    return createSkladchikStaff(tenantId, input, actorUserId, login, firstName);
  }
  return createFieldStaff(tenantId, kind, input, actorUserId, login, firstName);
}
`
);

// --- dashboard ---
const dashHdr = `import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { clampPct } from "./dashboard.helpers";
import {
  buildSalesTerritoryAliasClause,
  salesDateExprByType,
  salesProductJoinFilter
} from "./dashboard.sales.scope";
import type { SalesSnapshotQueryCtx } from "./dashboard.sales.snapshot.types";
`;

w(
  "src/modules/dashboard/dashboard.sales.snapshot.types.ts",
  `import type { Prisma } from "@prisma/client";
import type { SalesDashboardFilters } from "./dashboard.sales.types";
import type { resolveSalesTerritoryTerms } from "./dashboard.sales.scope";

export type SalesSnapshotQueryCtx = {
  tenantId: number;
  filters: SalesDashboardFilters;
  salesScope: Prisma.Sql;
  allScope: Prisma.Sql;
  productFilter: Prisma.Sql;
  territoryTerms: Awaited<ReturnType<typeof resolveSalesTerritoryTerms>>;
};
`
);

w(
  "src/modules/dashboard/dashboard.sales.snapshot.products.ts",
  `${dashHdr}
export async function fetchSalesSnapshotProductBlock(ctx: SalesSnapshotQueryCtx) {
  const { salesScope, productFilter } = ctx;
${slice(dashLines, 57, 174)}
  return {
    total_sales_summary: {
      total_sales_sum: totalSales.toString(),
      orders_count: Number(totalRow[0]?.orders_count ?? 0n)
    },
    payment_method_analytics,
    product_category_analytics,
    product_group_analytics,
    category_performance_table
  };
}
`
);

w(
  "src/modules/dashboard/dashboard.sales.snapshot.orders.ts",
  `${dashHdr}
export async function fetchSalesSnapshotOrdersBlock(ctx: SalesSnapshotQueryCtx) {
  const { filters, salesScope, allScope, productFilter } = ctx;
${slice(dashLines, 176, 243)}
  return {
    orders_refusals,
    refusal_reason_analytics,
    sales_dynamics: sales_dynamics.map((r) => ({
      period: r.period,
      sales_sum: r.sales_sum.toString(),
      orders_count: Number(r.orders_count)
    })),
    akb: Number(akbRows[0]?.c ?? 0n)
  };
}
`
);

w(
  "src/modules/dashboard/dashboard.sales.snapshot.coverage.ts",
  `${dashHdr}
export async function fetchSalesSnapshotCoverageBlock(
  ctx: SalesSnapshotQueryCtx,
  akb: number
) {
  const { tenantId, filters, salesScope, productFilter, territoryTerms } = ctx;
${slice(dashLines, 245, 350)}
  return {
    akb_okb_block: {
      akb,
      okb,
      coverage_pct: coverage
    },
    territory_analytics,
    agent_analytics
  };
}
`
);

w(
  "src/modules/dashboard/dashboard.sales.snapshot.ts",
  `${slice(dashLines, 1, 41)}
import type { SalesDashboardFilters, SalesDashboardSnapshot } from "./dashboard.sales.types";
import {
  resolveSalesTerritoryTerms,
  salesOrderScopeSql,
  salesProductJoinFilter
} from "./dashboard.sales.scope";
import type { SalesSnapshotQueryCtx } from "./dashboard.sales.snapshot.types";
import { fetchSalesSnapshotCoverageBlock } from "./dashboard.sales.snapshot.coverage";
import { fetchSalesSnapshotOrdersBlock } from "./dashboard.sales.snapshot.orders";
import { fetchSalesSnapshotProductBlock } from "./dashboard.sales.snapshot.products";

export async function getSalesDashboardSnapshot(
  tenantId: number,
  filters: SalesDashboardFilters
): Promise<SalesDashboardSnapshot> {
  const snapshotKey = \`tenant:\${tenantId}:dashboard:sales:\${stableJsonStringify(filters)}\`;
  const cached = await getSnapshotCache<SalesDashboardSnapshot>(snapshotKey);
  if (cached) return cached;

  const from = new Date(\`\${filters.from}T00:00:00.000Z\`);
  const to = new Date(\`\${filters.to}T23:59:59.999Z\`);
  const territoryTerms = await resolveSalesTerritoryTerms(tenantId, filters.territory_ids);
  const ctx: SalesSnapshotQueryCtx = {
    tenantId,
    filters,
    territoryTerms,
    salesScope: salesOrderScopeSql(tenantId, from, to, filters, territoryTerms, { forSales: true }),
    allScope: salesOrderScopeSql(tenantId, from, to, filters, territoryTerms, { forSales: false }),
    productFilter: salesProductJoinFilter("p", filters)
  };

  const productBlock = await fetchSalesSnapshotProductBlock(ctx);
  const ordersBlock = await fetchSalesSnapshotOrdersBlock(ctx);
  const coverageBlock = await fetchSalesSnapshotCoverageBlock(ctx, ordersBlock.akb);

  const result: SalesDashboardSnapshot = {
    filters,
    total_sales_summary: productBlock.total_sales_summary,
    payment_method_analytics: productBlock.payment_method_analytics,
    product_category_analytics: productBlock.product_category_analytics,
    product_group_analytics: productBlock.product_group_analytics,
    category_performance_table: productBlock.category_performance_table,
    orders_refusals: ordersBlock.orders_refusals,
    refusal_reason_analytics: ordersBlock.refusal_reason_analytics,
    sales_dynamics: ordersBlock.sales_dynamics,
    akb_okb_block: coverageBlock.akb_okb_block,
    territory_analytics: coverageBlock.territory_analytics,
    agent_analytics: coverageBlock.agent_analytics
  };
  await setSnapshotCache(snapshotKey, result);
  return result;
}
`
);

console.log("phase71 done");
