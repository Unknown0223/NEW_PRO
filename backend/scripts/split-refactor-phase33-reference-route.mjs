/**
 * v4 — reference.route bo‘linishi.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const mod = path.join(root, "../src/modules/reference");
const src = path.join(mod, "reference.route.ts");
const backup = path.join(mod, "reference.route.backup.ts");

function read(p) {
  return fs.readFileSync(p, "utf8").split(/\r?\n/);
}
function slice(lines, a, b) {
  return lines.slice(a - 1, b).join("\n");
}
function w(p, c) {
  fs.writeFileSync(p, c.endsWith("\n") ? c : `${c}\n`);
}

if (!fs.existsSync(backup)) {
  fs.copyFileSync(src, backup);
}

const lines = read(backup);

w(
  path.join(mod, "reference.route.shared.ts"),
  `import { ADMIN_AND_OPERATOR_LIKE_ROLES } from "../../lib/tenant-user-roles";

export const catalogRoles = ADMIN_AND_OPERATOR_LIKE_ROLES;
export const adminRoles = ["admin"] as const;
`
);

let schemasBody = slice(lines, 33, 94);
for (const name of ["createCategoryBody", "patchCategoryBody", "createWarehouseBody", "patchWarehouseBody"]) {
  schemasBody = schemasBody.replace(new RegExp(`^const ${name}`, "m"), `export const ${name}`);
}
w(
  path.join(mod, "reference.route.schemas.ts"),
  `import { z } from "zod";

${schemasBody}
`
);

function routeFile(name, fnName, range, extraImports) {
  w(
    path.join(mod, name),
    `import type { FastifyInstance } from "fastify";
${extraImports}

export async function ${fnName}(app: FastifyInstance) {
${slice(lines, range[0], range[1])}
}
`
  );
}

routeFile(
  "reference.route.warehouses.ts",
  "registerReferenceWarehouseRoutes",
  [97, 260],
  `import { sendApiError, zodValidationExtras } from "../../lib/api-error";
import { ensureTenantContext } from "../../lib/tenant-context";
import { actorUserIdOrNull } from "../../lib/request-actor";
import { jwtAccessVerify, requireRoles } from "../auth/auth.prehandlers";
import {
  requireRolesOrSkladchikAnyEntitlement,
  SKLADCHIK_ALL_ENTITLEMENT_KEYS
} from "../staff/skladchik-access.prehandler";
import { parseSelectedMastersFromQuery, resolveConstraintScope } from "../linkage/linkage.service";
import { catalogRoles } from "./reference.route.shared";
import { createWarehouseBody, patchWarehouseBody } from "./reference.route.schemas";
import {
  createWarehouseRow,
  deleteWarehouseRow,
  getWarehouseDetail,
  listWarehousePickers,
  listWarehousesForTenant,
  listWarehousesTable,
  updateWarehouseRow
} from "./reference.service";
`
);

routeFile(
  "reference.route.users.ts",
  "registerReferenceUserRoutes",
  [262, 270],
  `import { ensureTenantContext } from "../../lib/tenant-context";
import { jwtAccessVerify, requireRoles, DIRECTORY_READ_ROLES } from "../auth/auth.prehandlers";
import { listUsersForOrderAgent } from "./reference.service";
`
);

routeFile(
  "reference.route.categories.ts",
  "registerReferenceCategoryRoutes",
  [272, 384],
  `import { sendApiError, zodValidationExtras } from "../../lib/api-error";
import { ensureTenantContext } from "../../lib/tenant-context";
import { actorUserIdOrNull } from "../../lib/request-actor";
import { jwtAccessVerify, requireRoles } from "../auth/auth.prehandlers";
import { adminRoles, catalogRoles } from "./reference.route.shared";
import { createCategoryBody, patchCategoryBody } from "./reference.route.schemas";
import {
  createProductCategoryRow,
  deleteProductCategoryRow,
  listProductCategoriesForTenant,
  updateProductCategoryRow
} from "./reference.service";
`
);

routeFile(
  "reference.route.price.ts",
  "registerReferencePriceRoutes",
  [386, 408],
  `import { ensureTenantContext } from "../../lib/tenant-context";
import { jwtAccessVerify, requireRoles } from "../auth/auth.prehandlers";
import { catalogRoles } from "./reference.route.shared";
import { listDistinctPriceTypesForTenant, listFinancePriceOverview } from "./reference.service";
`
);

w(
  path.join(mod, "reference.route.ts"),
  `import type { FastifyInstance } from "fastify";
import { registerReferenceCategoryRoutes } from "./reference.route.categories";
import { registerReferencePriceRoutes } from "./reference.route.price";
import { registerReferenceUserRoutes } from "./reference.route.users";
import { registerReferenceWarehouseRoutes } from "./reference.route.warehouses";

export async function registerReferenceRoutes(app: FastifyInstance) {
  await registerReferenceWarehouseRoutes(app);
  await registerReferenceUserRoutes(app);
  await registerReferenceCategoryRoutes(app);
  await registerReferencePriceRoutes(app);
}
`
);

console.log("Phase 33 reference.route split done.");
