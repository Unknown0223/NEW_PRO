/**
 * v4 — bonus-rules.route bo‘linishi.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const mod = path.join(root, "../src/modules/bonus-rules");
const src = path.join(mod, "bonus-rules.route.ts");
const backup = path.join(mod, "bonus-rules.route.backup.ts");

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
  path.join(mod, "bonus-rules.route.shared.ts"),
  `import { ADMIN_AND_OPERATOR_LIKE_ROLES } from "../../lib/tenant-user-roles";

export const catalogRoles = ADMIN_AND_OPERATOR_LIKE_ROLES;
`
);

let schemasBody = slice(lines, 22, 79);
for (const name of ["createBodySchema", "updateBodySchema", "activeBodySchema", "previewQtyBodySchema"]) {
  schemasBody = schemasBody.replace(new RegExp(`^const ${name}`, "m"), `export const ${name}`);
}
w(
  path.join(mod, "bonus-rules.route.schemas.ts"),
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
  "bonus-rules.route.list.ts",
  "registerBonusRuleListRoutes",
  [84, 202],
  `import type { Prisma } from "@prisma/client";
import { ensureTenantContext } from "../../lib/tenant-context";
import { prisma } from "../../config/database";
import { jwtAccessVerify } from "../auth/auth.prehandlers";
import {
  bonusRuleConditionSummary,
  bonusRuleInclude,
  mapBonusRuleFull
} from "./bonus-rules.service";
`
);

routeFile(
  "bonus-rules.route.read.ts",
  "registerBonusRuleReadRoutes",
  [204, 256],
  `import { sendApiError, zodValidationExtras } from "../../lib/api-error";
import { ensureTenantContext } from "../../lib/tenant-context";
import { jwtAccessVerify } from "../auth/auth.prehandlers";
import { fetchBonusRuleFull, previewQtyBonus } from "./bonus-rules.service";
import { previewQtyBodySchema } from "./bonus-rules.route.schemas";
`
);

routeFile(
  "bonus-rules.route.write.ts",
  "registerBonusRuleWriteRoutes",
  [258, 333],
  `import { sendApiError, zodValidationExtras } from "../../lib/api-error";
import { actorUserIdOrNull } from "../../lib/request-actor";
import { ensureTenantContext } from "../../lib/tenant-context";
import { jwtAccessVerify, requireRoles } from "../auth/auth.prehandlers";
import { catalogRoles } from "./bonus-rules.route.shared";
import { createBodySchema, updateBodySchema } from "./bonus-rules.route.schemas";
import { createBonusRule, updateBonusRule } from "./bonus-rules.service";
`
);

routeFile(
  "bonus-rules.route.lifecycle.ts",
  "registerBonusRuleLifecycleRoutes",
  [335, 388],
  `import { sendApiError, zodValidationExtras } from "../../lib/api-error";
import { actorUserIdOrNull } from "../../lib/request-actor";
import { ensureTenantContext } from "../../lib/tenant-context";
import { jwtAccessVerify, requireRoles } from "../auth/auth.prehandlers";
import { catalogRoles } from "./bonus-rules.route.shared";
import { activeBodySchema } from "./bonus-rules.route.schemas";
import { setBonusRuleActive, softDeactivateBonusRule } from "./bonus-rules.service";
`
);

w(
  path.join(mod, "bonus-rules.route.ts"),
  `import type { FastifyInstance } from "fastify";
import { registerBonusRuleLifecycleRoutes } from "./bonus-rules.route.lifecycle";
import { registerBonusRuleListRoutes } from "./bonus-rules.route.list";
import { registerBonusRuleReadRoutes } from "./bonus-rules.route.read";
import { registerBonusRuleWriteRoutes } from "./bonus-rules.route.write";

export async function registerBonusRuleRoutes(app: FastifyInstance) {
  await registerBonusRuleListRoutes(app);
  await registerBonusRuleReadRoutes(app);
  await registerBonusRuleWriteRoutes(app);
  await registerBonusRuleLifecycleRoutes(app);
}
`
);

console.log("Phase 34 bonus-rules.route split done.");
