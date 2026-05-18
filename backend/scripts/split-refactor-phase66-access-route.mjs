/**
 * access.route bo‘linishi (barrel import yo‘li saqlanadi).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const mod = path.join(path.dirname(fileURLToPath(import.meta.url)), "../src/modules/access");
const backupPath = path.join(mod, "access.route.backup.ts");
const srcPath = path.join(mod, "access.route.ts");

function read(p) {
  return fs.readFileSync(p, "utf8").split(/\r?\n/);
}
function slice(lines, a, b) {
  return lines.slice(a - 1, b).join("\n");
}
function w(p, c) {
  fs.writeFileSync(p, c.endsWith("\n") ? c : `${c}\n`);
}

if (!fs.existsSync(backupPath)) {
  fs.copyFileSync(srcPath, backupPath);
}
const lines = read(backupPath);

w(
  path.join(mod, "access.route.shared.ts"),
  slice(lines, 1, 177)
    .replace(
      "const adminOrAccessManager = [jwtAccessVerify, requireAnyAccessManage()] as const;",
      "export const adminOrAccessManager = [jwtAccessVerify, requireAnyAccessManage()] as const;"
    )
    .replace(/^function pickBranchDimensionKey/gm, "export function pickBranchDimensionKey")
    .replace(/^function sumBranchLinkCounts/gm, "export function sumBranchLinkCounts")
    .replace(/^function pickPaymentDimensionKey/gm, "export function pickPaymentDimensionKey")
    .replace(/^function sumPaymentLinkCounts/gm, "export function sumPaymentLinkCounts")
    .replace(/^const listUsersQuerySchema/gm, "export const listUsersQuerySchema")
    .replace(/^const patchAccessBodySchema/gm, "export const patchAccessBodySchema")
    .replace(/^const bulkAccessPatchBodySchema/gm, "export const bulkAccessPatchBodySchema")
);

const hdr = slice(lines, 1, 59);

const slices = [
  ["access.route.me.ts", "registerAccessRouteMe", 180, 190],
  ["access.route.dimensions.ts", "registerAccessDimensionsRoutes", 192, 358],
  ["access.route.dimensions-users.ts", "registerAccessDimensionsUsersRoutes", 360, 630],
  ["access.route.catalog.ts", "registerAccessCatalogRoutes", 632, 683],
  ["access.route.users-list.ts", "registerAccessUsersListRoutes", 685, 801],
  ["access.route.users-bulk.ts", "registerAccessUsersBulkRoutes", 802, 1007],
  ["access.route.users-write.ts", "registerAccessUsersWriteRoutes", 1009, 1233],
  ["access.route.roles-history.ts", "registerAccessRolesHistoryRoutes", 1235, 1330]
];

for (const [file, fn, a, b] of slices) {
  w(
    path.join(mod, file),
    `${hdr}
import { adminOrAccessManager${file.includes("dimensions.ts") && !file.includes("dimensions-users") ? ", pickBranchDimensionKey, pickPaymentDimensionKey, sumBranchLinkCounts, sumPaymentLinkCounts" : ""}${file === "access.route.users-list.ts" ? ", listUsersQuerySchema" : ""}${file === "access.route.users-write.ts" ? ", patchAccessBodySchema" : ""}${file === "access.route.users-bulk.ts" ? ", bulkAccessPatchBodySchema" : ""} } from "./access.route.shared";

export async function ${fn}(app: FastifyInstance) {
${slice(lines, a, b)}
}
`
  );
}

const registrations = slices
  .map(([, fn]) => `  await ${fn}(app);`)
  .join("\n");

w(
  path.join(mod, "access.route.ts"),
  `import type { FastifyInstance } from "fastify";
import { registerAccessCatalogRoutes } from "./access.route.catalog";
import { registerAccessDimensionsRoutes } from "./access.route.dimensions";
import { registerAccessDimensionsUsersRoutes } from "./access.route.dimensions-users";
import { registerAccessRouteMe } from "./access.route.me";
import { registerAccessRolesHistoryRoutes } from "./access.route.roles-history";
import { registerAccessUsersBulkRoutes } from "./access.route.users-bulk";
import { registerAccessUsersListRoutes } from "./access.route.users-list";
import { registerAccessUsersWriteRoutes } from "./access.route.users-write";

export async function registerAccessRoutes(app: FastifyInstance) {
${registrations}
}
`
);

console.log("Phase 66 access.route split done.");
