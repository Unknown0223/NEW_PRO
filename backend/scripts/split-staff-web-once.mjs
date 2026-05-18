import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "../src/modules/staff");
const lines = fs.readFileSync(path.join(dir, "staff.patches.web.ts"), "utf8").split(/\r?\n/);

const presetsHeader = `import { randomUUID } from "node:crypto";
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

const agentsHeader = `import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { appendTenantAuditEvent, AuditEntityType } from "../../lib/tenant-audit";
import { parseMobileConfigV1, type AgentMobileConfigV1 } from "./agent-mobile-config";
import type { AgentEntitlements, ExpeditorAssignmentRules, StaffRow } from "./staff.shared";
import {
  applyTradeDirectionPatch,
  assertExpeditorMobileTradeDirections,
  normalizeAgentEntitlementsInput,
  normalizePriceTypes,
  parseEntitlements,
  parsePriceTypesJson,
  validateAgentEntitlements,
  validateExpeditorAssignmentRules
} from "./staff.shared";
import { applyAgentPatchInDb } from "./staff.patches.field";
import { listStaff, type PatchAgentInput } from "./staff.crud";
`;

const presetsBody = lines.slice(27, 522).join("\n");
const agentsBody = lines.slice(523).join("\n");

fs.writeFileSync(path.join(dir, "staff.patches.web-presets.ts"), `${presetsHeader}\n${presetsBody}\n`);
fs.writeFileSync(path.join(dir, "staff.patches.web-agents.ts"), `${agentsHeader}\n${agentsBody}\n`);
fs.writeFileSync(
  path.join(dir, "staff.patches.web.ts"),
  `/** Web staff presets + agent bulk — barrel. */\nexport * from "./staff.patches.web-presets";\nexport * from "./staff.patches.web-agents";\n`
);
console.log("ok");
