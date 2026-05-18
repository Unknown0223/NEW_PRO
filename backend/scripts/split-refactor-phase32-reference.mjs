/**
 * v4 — reference.service bo‘linishi.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const mod = path.join(root, "../src/modules/reference");
const mainPath = path.join(mod, "reference.service.ts");
const backupPath = path.join(mod, "reference.service.backup.ts");

function read(p) {
  return fs.readFileSync(p, "utf8").split(/\r?\n/);
}
function slice(lines, a, b) {
  return lines.slice(a - 1, b).join("\n");
}
function w(p, c) {
  fs.writeFileSync(p, c.endsWith("\n") ? c : `${c}\n`);
}

const lines = read(mainPath);
if (!fs.existsSync(backupPath)) {
  fs.copyFileSync(mainPath, backupPath);
}

const hdrDb = `import type { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
`;

const hdrAudit = `${hdrDb}import { appendTenantAuditEvent, AuditEntityType } from "../../lib/tenant-audit";
`;

w(
  path.join(mod, "reference.shared.ts"),
  `${hdrDb}
${slice(lines, 14, 27)}
`.replace(/^function settingsRefRecord/m, "export function settingsRefRecord")
);

w(path.join(mod, "reference.warehouse.types.ts"), slice(lines, 54, 88));

w(
  path.join(mod, "reference.warehouse.constants.ts"),
  `export const STOCK_PURPOSE_VALUES = ["sales", "return", "reserve"] as const;

export const warehouseDetailSelect = {
  id: true,
  name: true,
  type: true,
  stock_purpose: true,
  code: true,
  address: true,
  payment_method: true,
  van_selling: true,
  is_active: true,
  links: {
    select: {
      link_role: true,
      user: { select: { id: true, name: true, login: true } }
    }
  }
} as const;
`
);

w(
  path.join(mod, "reference.warehouse.list.ts"),
  `${hdrDb}
${slice(lines, 29, 52)}
`
);

w(
  path.join(mod, "reference.warehouse.links.ts"),
  `${hdrDb}import { WAREHOUSE_LINK_ROLES, type WarehouseLinkRole } from "./reference.warehouse.types";

const ROLE_FOR_WAREHOUSE_LINK: Record<WarehouseLinkRole, string> = {
  agent: "agent",
  cashier: "operator",
  manager: "operator",
  operator: "operator",
  storekeeper: "operator",
  supervisor: "supervisor",
  expeditor: "expeditor"
};

${slice(lines, 90, 109)}
`
);

w(
  path.join(mod, "reference.warehouse.pickers.ts"),
  `${hdrDb}import { OPERATOR_LIKE_WEB_ROLES } from "../../lib/tenant-user-roles";
import { warehouseDetailSelect } from "./reference.warehouse.constants";

${slice(lines, 111, 136)}

export async function getWarehouseDetail(tenantId: number, id: number) {
  return prisma.warehouse.findFirst({
    where: { id, tenant_id: tenantId },
    select: warehouseDetailSelect
  });
}
`
);

w(
  path.join(mod, "reference.warehouse.table.ts"),
  `${hdrDb}import type { WarehouseTableRow } from "./reference.warehouse.types";

${slice(lines, 163, 243)}
`
);

w(
  path.join(mod, "reference.warehouse.crud.ts"),
  `${hdrAudit}import { STOCK_PURPOSE_VALUES, warehouseDetailSelect } from "./reference.warehouse.constants";
import { getWarehouseDetail } from "./reference.warehouse.pickers";
import type { WarehouseTableRow } from "./reference.warehouse.types";
import { assertWarehouseLinkRoles } from "./reference.warehouse.links";

${slice(lines, 244, 454)}
`
);

w(
  path.join(mod, "reference.users.ts"),
  `${hdrDb}
${slice(lines, 456, 462)}
`
);

w(path.join(mod, "reference.category.types.ts"), slice(lines, 464, 474));

let catHelpers = slice(lines, 476, 522);
catHelpers = catHelpers
  .replace(/^async function depthFromRoot/m, "export async function depthFromRoot")
  .replace(/^async function maxDepthBelow/m, "export async function maxDepthBelow")
  .replace(/^async function assertParentAllowed/m, "export async function assertParentAllowed")
  .replace(/^function normalizeCategoryCode/m, "export function normalizeCategoryCode");

w(
  path.join(mod, "reference.category.helpers.ts"),
  `${hdrDb}
${catHelpers}
`
);

w(
  path.join(mod, "reference.category.list.ts"),
  `${hdrDb}import type { ProductCategoryListRow } from "./reference.category.types";

${slice(lines, 524, 545)}
`
);

w(
  path.join(mod, "reference.price-types.ts"),
  `${hdrDb}import { getRedisForApp } from "../../lib/redis-cache";
import {
  priceTypeEntriesFromUnknown,
  priceTypeKey,
  uniqueSortedPriceTypeKeys
} from "../tenant-settings/finance-refs";
import { settingsRefRecord } from "./reference.shared";

${slice(lines, 547, 626)}
`.replace(/^async function computeDistinctPriceTypesForTenant/m, "async function computeDistinctPriceTypesForTenant")
);

w(
  path.join(mod, "reference.finance-overview.ts"),
  `${hdrDb}import {
  priceTypeEntriesFromUnknown,
  priceTypeKey,
  resolveCurrencyEntries,
  resolvePaymentMethodEntries
} from "../tenant-settings/finance-refs";
import { settingsRefRecord } from "./reference.shared";

${slice(lines, 628, 675)}
`
);

w(
  path.join(mod, "reference.category.crud.ts"),
  `${hdrAudit}import type { ProductCategoryListRow } from "./reference.category.types";
import {
  assertParentAllowed,
  depthFromRoot,
  maxDepthBelow,
  normalizeCategoryCode
} from "./reference.category.helpers";

${slice(lines, 677, 888)}
`
);

w(
  path.join(mod, "reference.service.ts"),
  `/**
 * Domain: warehouses, product categories, price types (reference data).
 */
export * from "./reference.shared";
export * from "./reference.warehouse.types";
export * from "./reference.warehouse.constants";
export * from "./reference.warehouse.list";
export * from "./reference.warehouse.links";
export * from "./reference.warehouse.pickers";
export * from "./reference.warehouse.table";
export * from "./reference.warehouse.crud";
export * from "./reference.users";
export * from "./reference.category.types";
export * from "./reference.category.helpers";
export * from "./reference.category.list";
export * from "./reference.price-types";
export * from "./reference.finance-overview";
export * from "./reference.category.crud";
`
);

console.log("Phase 32 reference split done.");
