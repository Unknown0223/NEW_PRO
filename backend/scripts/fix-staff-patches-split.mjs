import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "../src/modules/staff");
const sess = fs.readFileSync(path.join(dir, "staff.patches.sessions.ts"), "utf8").split(/\r?\n/);
const web = fs.readFileSync(path.join(dir, "staff.patches.web.ts"), "utf8").split(/\r?\n/);

const header = sess
  .slice(0, 58)
  .join("\n")
  .replace(/\nimport \{ listStaff[^\n]+\nimport \{ listStaff[^\n]+\n/, '\nimport { listStaff, type PatchAgentInput, type SessionRowDto } from "./staff.crud";\n\n');

const sessBody = sess.slice(61, 149).join("\n");
const webHelpers = sess.slice(150).join("\n");
const webBody = web.slice(60).join("\n");

const webHeader = `import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { appendTenantAuditEvent, AuditEntityType } from "../../lib/tenant-audit";
import { listTenantAuditEvents } from "../audit-events/audit-events.service";
import {
  ADMIN_AND_OPERATOR_LIKE_ROLES,
  DISTRIBUTION_WEB_STAFF_ROLES,
  OPERATOR_LIKE_WEB_ROLES,
  WEB_PANEL_STAFF_ROLES
} from "../../lib/tenant-user-roles";
`;

fs.writeFileSync(path.join(dir, "staff.patches.sessions.ts"), `${header}\n${sessBody}\n`);
fs.writeFileSync(path.join(dir, "staff.patches.web.ts"), `${webHeader}\n${webHelpers}\n${webBody}\n`);

let field = fs.readFileSync(path.join(dir, "staff.patches.field.ts"), "utf8");
field = field.replace(/\nimport \{ listStaff[^\n]+\nimport \{ listStaff[^\n]+\n/, '\nimport { listStaff, type PatchAgentInput, type SessionRowDto } from "./staff.crud";\n\n');
fs.writeFileSync(path.join(dir, "staff.patches.field.ts"), field);
console.log("ok");
