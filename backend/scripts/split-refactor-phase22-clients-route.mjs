/**
 * v3 — clients.route bo‘linishi.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const mod = path.join(root, "../src/modules/clients");
const src = path.join(mod, "clients.route.ts");
const backup = path.join(mod, "clients.route.backup.ts");

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
import { catalogRoles } from "./clients.route.shared";
`;

const schemasBody = `${slice(lines, 1, 59).replace("const catalogRoles = ADMIN_AND_OPERATOR_LIKE_ROLES;\n\n", "import { catalogRoles } from \"./clients.route.shared\";\n\n")}
${slice(lines, 62, 370)}
${slice(lines, 920, 945).replace(/^  const parseReconciliationDateRange = \(/m, "export function parseReconciliationDateRange(")}
`;

w(
  path.join(mod, "clients.route.shared.ts"),
  `import { ADMIN_AND_OPERATOR_LIKE_ROLES } from "../../lib/tenant-user-roles";

export const catalogRoles = ADMIN_AND_OPERATOR_LIKE_ROLES;
`
);

w(path.join(mod, "clients.route.schemas.ts"), schemasBody);

function routeFile(name, fnName, ranges, extraImports = "") {
  const body = ranges
    .map(([a, b]) => slice(lines, a, b))
    .join("\n\n")
    .replace(/^export async function registerClientRoutes\(app: FastifyInstance\) \{\n/, "");
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

routeFile("clients.route.list.ts", "registerClientListRoutes", [
  [384, 438],
  [618, 626],
  [717, 761]
], `import { z } from "zod";
import { sendApiError, zodValidationExtras } from "../../lib/api-error";
import { ensureTenantContext } from "../../lib/tenant-context";
import { jwtAccessVerify, requireRoles, getAccessUser } from "../auth/auth.prehandlers";
import {
  bulkSetClientsActive,
  exportClientsFilteredCsv,
  getClientReferences,
  listClientsForTenantPaged
} from "./clients.service";
import { listDuplicateCandidates } from "./client-dedupe.service";
import {
  bulkActiveBodySchema,
  parseClientListQuery,
  sendClientUpdateImportTemplateXlsx
} from "./clients.route.schemas";
`);

routeFile("clients.route.dedupe.ts", "registerClientDedupeRoutes", [
  [440, 524],
  [763, 831]
], `import { sendApiError, zodValidationExtras } from "../../lib/api-error";
import { ensureTenantContext } from "../../lib/tenant-context";
import { jwtAccessVerify, requireRoles, getAccessUser } from "../auth/auth.prehandlers";
import { mergeClientsIntoOne, previewMergeClients } from "./clients.service";
import {
  createSavedDuplicateGroup,
  deleteSavedDuplicateGroup,
  listClientMergeHistory,
  listMergeSessionsForTenant,
  listSavedDuplicateGroups
} from "./client-dedupe.service";
import { mergeBodySchema, savedDupGroupBodySchema } from "./clients.route.schemas";
`);

routeFile("clients.route.write.ts", "registerClientWriteRoutes", [
  [526, 616],
  [1465, 1509]
], `import { z } from "zod";
import { patchClientBodySchema } from "../../contracts/clients.schemas";
import { sendApiError, zodValidationExtras } from "../../lib/api-error";
import { ensureTenantContext } from "../../lib/tenant-context";
import { jwtAccessVerify, requireRoles, getAccessUser } from "../auth/auth.prehandlers";
import { createClientMinimal, updateClientFields } from "./clients.service";
import { bulkActiveBodySchema, createClientBodySchema } from "./clients.route.schemas";
`);

routeFile("clients.route.import.ts", "registerClientImportRoutes", [
  [374, 382],
  [628, 715]
], `import { unlink } from "fs/promises";
import { writeClientImportTempFile } from "../../jobs/import-temp-file";
import { sendApiError } from "../../lib/api-error";
import { ensureTenantContext } from "../../lib/tenant-context";
import { enqueueClientsImportJob } from "../jobs/jobs.service";
import { jwtAccessVerify, requireRoles, getAccessUser } from "../auth/auth.prehandlers";
import {
  buildClientImportTemplateBuffer,
  importClientsFromXlsx
} from "./clients.service";
import {
  parseClientImportMultipart,
  parseClientListQuery,
  sendClientUpdateImportTemplateXlsx
} from "./clients.route.schemas";
`);

routeFile("clients.route.detail.ts", "registerClientDetailRoutes", [
  [833, 919],
  [947, 1099]
], `import { positiveIntPathIdParamsSchema } from "../../contracts/route-params.schemas";
import { sendApiError } from "../../lib/api-error";
import { ensureTenantContext } from "../../lib/tenant-context";
import { jwtAccessVerify, requireRoles } from "../auth/auth.prehandlers";
import { getClientSalesAnalytics } from "./client-sales-analytics.service";
import {
  buildClientReconciliationXlsxBuffer,
  loadClientReconciliation,
  toClientReconciliationJson
} from "./client-reconciliation-data";
import {
  getClientDetail,
  getClientReconciliationPdfBuffer,
  listClientAuditLogs
} from "./clients.service";
import {
  defaultReconciliationRange,
  endOfLocalDay,
  parseLocalYmd,
  parseReconciliationDateRange
} from "./clients.route.schemas";
`);

routeFile("clients.route.assets.ts", "registerClientAssetsRoutes", [
  [1101, 1283]
], `import { z } from "zod";
import { sendApiError, zodValidationExtras } from "../../lib/api-error";
import { ensureTenantContext } from "../../lib/tenant-context";
import { jwtAccessVerify, requireRoles, getAccessUser } from "../auth/auth.prehandlers";
import {
  createClientEquipmentRow,
  createClientPhotoReportRow,
  deleteClientPhotoReport,
  listTenantEquipmentPaged,
  listClientEquipmentSplit,
  listClientPhotoReports,
  markClientEquipmentRemoved
} from "./client-assets.service";
import {
  createClientEquipmentBodySchema,
  createClientPhotoBodySchema
} from "./clients.route.schemas";
`);

routeFile("clients.route.balance.ts", "registerClientBalanceRoutes", [
  [1285, 1463]
], `import { sendApiError, zodValidationExtras } from "../../lib/api-error";
import { ensureTenantContext } from "../../lib/tenant-context";
import { jwtAccessVerify, requireRoles, getAccessUser } from "../auth/auth.prehandlers";
import { getClientBalanceLedger } from "./client-balance-ledger.service";
import { getClientDebtorCreditorMonthly } from "./client-debtor-creditor-report.service";
import {
  addClientBalanceMovement,
  listClientBalanceMovements
} from "./clients.service";
import {
  balanceMovementBodySchema,
  endOfLocalDay,
  parseLocalYmd
} from "./clients.route.schemas";
`);

w(
  path.join(mod, "clients.route.ts"),
  `import type { FastifyInstance } from "fastify";
import { registerClientAssetsRoutes } from "./clients.route.assets";
import { registerClientBalanceRoutes } from "./clients.route.balance";
import { registerClientDedupeRoutes } from "./clients.route.dedupe";
import { registerClientDetailRoutes } from "./clients.route.detail";
import { registerClientImportRoutes } from "./clients.route.import";
import { registerClientListRoutes } from "./clients.route.list";
import { registerClientWriteRoutes } from "./clients.route.write";

export async function registerClientRoutes(app: FastifyInstance) {
  await registerClientListRoutes(app);
  await registerClientImportRoutes(app);
  await registerClientDedupeRoutes(app);
  await registerClientWriteRoutes(app);
  await registerClientDetailRoutes(app);
  await registerClientAssetsRoutes(app);
  await registerClientBalanceRoutes(app);
}
`
);

// Export schemas used by parse in schemas file
let sch = fs.readFileSync(path.join(mod, "clients.route.schemas.ts"), "utf8");
sch = sch.replace(/^function parseReconciliationDateRange/m, "export function parseReconciliationDateRange");
sch = sch.replace(/^async function parseClientImportMultipart/m, "export async function parseClientImportMultipart");
sch = sch.replace(/^async function sendClientUpdateImportTemplateXlsx/m, "export async function sendClientUpdateImportTemplateXlsx");
sch = sch.replace(/^function parseLocalYmd/m, "export function parseLocalYmd");
sch = sch.replace(/^function endOfLocalDay/m, "export function endOfLocalDay");
sch = sch.replace(/^function defaultReconciliationRange/m, "export function defaultReconciliationRange");
sch = sch.replace(/^function parseClientListQuery/m, "export function parseClientListQuery");
sch = sch.replace(/^const createClientEquipmentBodySchema/m, "export const createClientEquipmentBodySchema");
sch = sch.replace(/^const createClientPhotoBodySchema/m, "export const createClientPhotoBodySchema");
sch = sch.replace(/^const createClientBodySchema/m, "export const createClientBodySchema");
sch = sch.replace(/^const mergeBodySchema/m, "export const mergeBodySchema");
sch = sch.replace(/^const savedDupGroupBodySchema/m, "export const savedDupGroupBodySchema");
sch = sch.replace(/^const balanceMovementBodySchema/m, "export const balanceMovementBodySchema");
sch = sch.replace(/^const bulkActiveBodySchema/m, "export const bulkActiveBodySchema");
w(path.join(mod, "clients.route.schemas.ts"), sch);

console.log("Phase 22 clients.route split done.");
