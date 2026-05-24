import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const staff = path.join(path.dirname(fileURLToPath(import.meta.url)), "../src/modules/staff");
const srcPath = path.join(staff, "staff.route.ts");
if (!fs.existsSync(path.join(staff, "staff.route.backup.ts"))) {
  fs.copyFileSync(srcPath, path.join(staff, "staff.route.backup.ts"));
}
const lines = fs.readFileSync(path.join(staff, "staff.route.backup.ts"), "utf8").split(/\r?\n/);
const slice = (a, b) => lines.slice(a - 1, b).join("\n");

let schemasBody = slice(43, 440)
  .replace(/^const /gm, "export const ")
  .replace(/^function parse/gm, "export function parse");

const schemas = `import { z } from "zod";
import type { ListStaffFilters } from "./staff.service";

${schemasBody}
`;

const schemaNames = [...schemas.matchAll(/^export (?:const|function) (\w+)/gm)].map((m) => m[1]);
const schemaImport = `import {\n  ${schemaNames.join(",\n  ")}\n} from "./staff.route.schemas";\n`;

fs.writeFileSync(path.join(staff, "staff.route.shared.ts"), `import { ADMIN_AND_OPERATOR_LIKE_ROLES } from "../../lib/tenant-user-roles";

export const catalogRoles = ADMIN_AND_OPERATOR_LIKE_ROLES;
export const adminRoles = ["admin"] as const;
`);

fs.writeFileSync(path.join(staff, "staff.route.schemas.ts"), schemas);

const routeHdrBase = `import type { FastifyInstance } from "fastify";
import { sendApiError, zodValidationExtras } from "../../lib/api-error";
import { ensureTenantContext } from "../../lib/tenant-context";
import { actorUserIdOrNull } from "../../lib/request-actor";
import { DIRECTORY_READ_ROLES, jwtAccessVerify, requireRoles } from "../auth/auth.prehandlers";
import type { BulkAgentsInput, ListStaffFilters } from "./staff.service";
import {
  ADMIN_AND_OPERATOR_LIKE_ROLES,
  bulkPatchAgents,
  bulkPatchWebPanelStaffMaxSessions,
  bulkRevokeWebPanelStaffSessions,
  createStaff,
  getStaffRow,
  listAgentFilterOptions,
  listAgentSessions,
  listAuditorFilterOptions,
  listCollectorFilterOptions,
  listExpeditorFilterOptions,
  listStaff,
  listStaffSessions,
  listSupervisorFilterOptions,
  listWebPanelStaffFilterOptions,
  listWebStaffPositionPresetsAdmin,
  listWebStaffPositionPresetHistory,
  createWebStaffPositionPreset,
  patchWebStaffPositionPreset,
  patchAgent,
  patchAuditor,
  patchCollector,
  patchExpeditor,
  patchOperator,
  patchSkladchik,
  patchSupervisor,
  revokeAgentSessions,
  revokeStaffSessions,
  type StaffKind
} from "./staff.service";
import { catalogRoles, adminRoles } from "./staff.route.shared";
`;
const routeHdr = routeHdrBase + schemaImport;

const parts = [
  ["staff.route.agents.ts", "registerStaffAgentRoutes", [443, 634]],
  ["staff.route.supervisors.ts", "registerStaffSupervisorRoutes", [636, 795]],
  ["staff.route.collectors.ts", "registerStaffCollectorRoutes", [797, 937]],
  ["staff.route.auditors.ts", "registerStaffAuditorRoutes", [939, 1073]],
  ["staff.route.expeditors.ts", "registerStaffExpeditorRoutes", [1075, 1240]],
  ["staff.route.operators.ts", "registerStaffOperatorRoutes", [1242, 1531]],
  ["staff.route.skladchik.ts", "registerStaffSkladchikRoutes", [1533, 1734]]
];

for (const [file, fnName, [a, b]] of parts) {
  fs.writeFileSync(
    path.join(staff, file),
    `${routeHdr}
export async function ${fnName}(app: FastifyInstance) {
${slice(a, b)}
}
`
  );
}

fs.writeFileSync(
  path.join(staff, "staff.route.ts"),
  `import type { FastifyInstance } from "fastify";
import { registerStaffAgentRoutes } from "./staff.route.agents";
import { registerStaffAuditorRoutes } from "./staff.route.auditors";
import { registerStaffCollectorRoutes } from "./staff.route.collectors";
import { registerStaffExpeditorRoutes } from "./staff.route.expeditors";
import { registerStaffOperatorRoutes } from "./staff.route.operators";
import { registerStaffSkladchikRoutes } from "./staff.route.skladchik";
import { registerStaffSupervisorRoutes } from "./staff.route.supervisors";

export async function registerStaffRoutes(app: FastifyInstance) {
  await registerStaffAgentRoutes(app);
  await registerStaffSupervisorRoutes(app);
  await registerStaffCollectorRoutes(app);
  await registerStaffAuditorRoutes(app);
  await registerStaffExpeditorRoutes(app);
  await registerStaffOperatorRoutes(app);
  await registerStaffSkladchikRoutes(app);
}
`
);

console.log("phase14 staff.route split done");
