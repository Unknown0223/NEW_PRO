/**
 * v3 — stock.route bo‘linishi.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const mod = path.join(root, "../src/modules/stock");
const src = path.join(mod, "stock.route.ts");
const backup = path.join(mod, "stock.route.backup.ts");

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

const routeHdr = `import type { FastifyInstance } from "fastify";
import { adminRoles, catalogRoles } from "./stock.route.shared";
`;

w(
  path.join(mod, "stock.route.shared.ts"),
  `import { ADMIN_AND_OPERATOR_LIKE_ROLES } from "../../lib/tenant-user-roles";

export const catalogRoles = ADMIN_AND_OPERATOR_LIKE_ROLES;
export const adminRoles = ["admin"] as const;
`
);

const schemasHdr = `import type { FastifyRequest } from "fastify";
import { z } from "zod";
import {
  stockBalancesExportQuerySchema,
  stockBalancesQuerySchema
} from "../../contracts/stock.schemas";

export { stockBalancesExportQuerySchema, stockBalancesQuerySchema };

`;

let schemasBody = slice(lines, 46, 241);
schemasBody = schemasBody.replace(
  /^async function parseStockImportMultipart/m,
  "export async function parseStockImportMultipart"
);

w(path.join(mod, "stock.route.schemas.ts"), schemasHdr + schemasBody);

function routeFile(name, fnName, ranges, extraImports) {
  const body = ranges
    .map(([a, b]) => slice(lines, a, b))
    .join("\n\n")
    .replace(/^export async function registerStockRoutes\(app: FastifyInstance\) \{\n/, "")
    .replace(/^  app\./gm, "  app.");
  w(
    path.join(mod, name),
    `${routeHdr}
${extraImports}

export async function ${fnName}(app: FastifyInstance) {
${body}
}
`
  );
}

routeFile("stock.route.import.ts", "registerStockImportRoutes", [[244, 333]], `import { unlink } from "fs/promises";
import { writeStockImportTempFile } from "../../jobs/import-temp-file";
import { actorUserIdOrNull } from "../../lib/request-actor";
import { sendApiError } from "../../lib/api-error";
import { ensureTenantContext } from "../../lib/tenant-context";
import { enqueueStockImportJob } from "../jobs/jobs.service";
import { jwtAccessVerify, requireRoles } from "../auth/auth.prehandlers";
import {
  buildPostupleniya2StockTemplateBuffer,
  buildStockImportTemplateBuffer,
  importStockReceiptFromXlsx
} from "./stock.service";
import { parseStockImportMultipart } from "./stock.route.schemas";
`);

routeFile(
  "stock.route.receipts-report.ts",
  "registerStockReceiptsReportRoutes",
  [[335, 466]],
  `import { sendApiError, zodValidationExtras } from "../../lib/api-error";
import { ensureTenantContext } from "../../lib/tenant-context";
import { jwtAccessVerify } from "../auth/auth.prehandlers";
import { requireRolesOrSkladchikEntitlement } from "../staff/skladchik-access.prehandler";
import {
  buildStockReceiptReportExportBuffer,
  listStockReceiptReport,
  listStockReceiptReportDaily,
  listStockReceiptTimelineReport
} from "./stock.service";
import {
  stockReceiptsReportExportQuerySchema,
  stockReceiptsReportQuerySchema
} from "./stock.route.schemas";
`
);

routeFile(
  "stock.route.material-report.ts",
  "registerStockMaterialReportRoutes",
  [[468, 534]],
  `import { sendApiError, zodValidationExtras } from "../../lib/api-error";
import { ensureTenantContext } from "../../lib/tenant-context";
import { jwtAccessVerify } from "../auth/auth.prehandlers";
import { requireRolesOrSkladchikEntitlement } from "../staff/skladchik-access.prehandler";
import { buildMaterialReportExportBuffer, listMaterialReport } from "./stock.service";
import {
  materialReportExportQuerySchema,
  materialReportQuerySchema
} from "./stock.route.schemas";
`
);

routeFile(
  "stock.route.analytics.ts",
  "registerStockAnalyticsRoutes",
  [[536, 691]],
  `import { sendApiError, zodValidationExtras } from "../../lib/api-error";
import { ensureTenantContext } from "../../lib/tenant-context";
import { jwtAccessVerify } from "../auth/auth.prehandlers";
import { requireRolesOrSkladchikEntitlement } from "../staff/skladchik-access.prehandler";
import {
  buildRecommendedStockExportBuffer,
  buildStockByDateExportBuffer,
  listRecommendedStock,
  listStockBySpecificDate
} from "./stock.service";
import {
  recommendedExportQuerySchema,
  recommendedQuerySchema,
  stockByDateExportQuerySchema,
  stockByDateQuerySchema
} from "./stock.route.schemas";
`
);

routeFile(
  "stock.route.balances.ts",
  "registerStockBalancesRoutes",
  [[693, 789]],
  `import { sendApiError, zodValidationExtras } from "../../lib/api-error";
import { ensureTenantContext } from "../../lib/tenant-context";
import { jwtAccessVerify } from "../auth/auth.prehandlers";
import { requireRolesOrSkladchikEntitlement } from "../staff/skladchik-access.prehandler";
import { buildStockBalancesExportBuffer, listStockBalances } from "./stock.service";
import {
  stockBalancesExportQuerySchema,
  stockBalancesQuerySchema
} from "./stock.route.schemas";
`
);

routeFile(
  "stock.route.core.ts",
  "registerStockCoreRoutes",
  [[791, 841]],
  `import { actorUserIdOrNull } from "../../lib/request-actor";
import { sendApiError, zodValidationExtras } from "../../lib/api-error";
import { ensureTenantContext } from "../../lib/tenant-context";
import { jwtAccessVerify, requireRoles } from "../auth/auth.prehandlers";
import { requireRolesOrSkladchikEntitlement } from "../staff/skladchik-access.prehandler";
import { applyStockReceipt, listStockForTenant } from "./stock.service";
import { receiptBody } from "./stock.route.schemas";
`
);

routeFile(
  "stock.route.corrections.ts",
  "registerStockCorrectionRoutes",
  [[843, 1026]],
  `import { actorUserIdOrNull } from "../../lib/request-actor";
import { sendApiError, zodValidationExtras } from "../../lib/api-error";
import { ensureTenantContext } from "../../lib/tenant-context";
import { jwtAccessVerify, requireRoles } from "../auth/auth.prehandlers";
import { requireRolesOrSkladchikEntitlement } from "../staff/skladchik-access.prehandler";
import { applyStockAdjustment } from "./stock.service";
import {
  createWarehouseCorrectionBulk,
  listCorrectionWorkspaceRows,
  listDistinctPriceTypesForTenant,
  listWarehouseCorrections
} from "./warehouse-correction.service";
import {
  adjustmentBody,
  correctionBulkBodySchema,
  correctionsQuerySchema,
  correctionWorkspaceQuerySchema
} from "./stock.route.schemas";
`
);

w(
  path.join(mod, "stock.route.ts"),
  `import type { FastifyInstance } from "fastify";
import { registerStockAnalyticsRoutes } from "./stock.route.analytics";
import { registerStockBalancesRoutes } from "./stock.route.balances";
import { registerStockCoreRoutes } from "./stock.route.core";
import { registerStockCorrectionRoutes } from "./stock.route.corrections";
import { registerStockImportRoutes } from "./stock.route.import";
import { registerStockMaterialReportRoutes } from "./stock.route.material-report";
import { registerStockReceiptsReportRoutes } from "./stock.route.receipts-report";

export async function registerStockRoutes(app: FastifyInstance) {
  await registerStockImportRoutes(app);
  await registerStockReceiptsReportRoutes(app);
  await registerStockMaterialReportRoutes(app);
  await registerStockAnalyticsRoutes(app);
  await registerStockBalancesRoutes(app);
  await registerStockCoreRoutes(app);
  await registerStockCorrectionRoutes(app);
}
`
);

// Export schemas used by route slices
let sch = fs.readFileSync(path.join(mod, "stock.route.schemas.ts"), "utf8");
const exportConst = (name) => {
  sch = sch.replace(new RegExp(`^const ${name} =`, "m"), `export const ${name} =`);
};
[
  "recommendedQuerySchema",
  "recommendedExportQuerySchema",
  "stockByDateQuerySchema",
  "stockByDateExportQuerySchema",
  "materialReportQuerySchema",
  "materialReportExportQuerySchema",
  "stockReceiptsReportQuerySchema",
  "stockReceiptsReportExportQuerySchema",
  "receiptBody",
  "adjustmentBody",
  "correctionsQuerySchema",
  "correctionBulkBodySchema"
].forEach(exportConst);
sch = sch.replace(
  /^const correctionWorkspaceQuerySchema/m,
  "export const correctionWorkspaceQuerySchema"
);
w(path.join(mod, "stock.route.schemas.ts"), sch);

console.log("Phase 25 stock.route split done.");
