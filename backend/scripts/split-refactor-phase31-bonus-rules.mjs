/**
 * v4 — bonus-rules.service bo‘linishi.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const mod = path.join(root, "../src/modules/bonus-rules");
const mainPath = path.join(mod, "bonus-rules.service.ts");
const backupPath = path.join(mod, "bonus-rules.service.backup.ts");

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

const hdr = `import type { BonusRule, BonusRuleCondition } from "@prisma/client";
import { prisma } from "../../config/database";
import { appendTenantAuditEvent, AuditEntityType } from "../../lib/tenant-audit";

type RuleWithConditions = BonusRule & { conditions: BonusRuleCondition[] };
`;

w(path.join(mod, "bonus-rules.types.ts"), slice(lines, 7, 108));

w(
  path.join(mod, "bonus-rules.mappers.ts"),
  `${hdr}
import type { BonusConditionRow, BonusRuleRow } from "./bonus-rules.types";
import { bonusRuleInclude } from "./bonus-rules.types";

${slice(lines, 110, 224)}
`
);

let validateBody = slice(lines, 226, 433);
w(
  path.join(mod, "bonus-rules.validate.ts"),
  `${hdr}
import type { BonusConditionInput, CreateBonusRuleInput } from "./bonus-rules.types";

${validateBody}
`
);

w(
  path.join(mod, "bonus-rules.crud.create.ts"),
  `${hdr}
import type { BonusRuleRow, CreateBonusRuleInput } from "./bonus-rules.types";
import { fetchBonusRuleFull, mapBonusRuleFull } from "./bonus-rules.mappers";
import {
  normalizeConditions,
  parseOptionalDate,
  ruleScalarsFromInput,
  validateAutoBonusProductScope,
  validateForType,
  validatePrerequisiteRuleIds
} from "./bonus-rules.validate";

${slice(lines, 435, 497)}
`
);

w(
  path.join(mod, "bonus-rules.crud.update.ts"),
  `${hdr}
import type { BonusRuleRow, CreateBonusRuleInput, UpdateBonusRuleInput } from "./bonus-rules.types";
import { bonusRuleInclude } from "./bonus-rules.types";
import { fetchBonusRuleFull } from "./bonus-rules.mappers";
import {
  normalizeConditions,
  parseOptionalDate,
  ruleScalarsFromInput,
  validateAutoBonusProductScope,
  validateForType,
  validatePrerequisiteRuleIds
} from "./bonus-rules.validate";

${slice(lines, 499, 730)}
`
);

w(
  path.join(mod, "bonus-rules.crud.lifecycle.ts"),
  `${hdr}
import type { BonusRuleRow } from "./bonus-rules.types";
import { fetchBonusRuleFull } from "./bonus-rules.mappers";

${slice(lines, 732, 787)}
`
);

const hdrQty = `import type { BonusRule, BonusRuleCondition } from "@prisma/client";
import { prisma } from "../../config/database";

type RuleWithConditions = BonusRule & { conditions: BonusRuleCondition[] };
`;

w(
  path.join(mod, "bonus-rules.qty.ts"),
  `${hdrQty}
import type { BonusConditionRow, BonusRuleRow } from "./bonus-rules.types";
import { fetchBonusRuleFull } from "./bonus-rules.mappers";

${slice(lines, 789, 908)}
`
);

// Export fetchBonusRuleFull from mappers
let mappers = fs.readFileSync(path.join(mod, "bonus-rules.mappers.ts"), "utf8");
mappers = mappers.replace(/^async function fetchBonusRuleFull/m, "export async function fetchBonusRuleFull");
w(path.join(mod, "bonus-rules.mappers.ts"), mappers);

// Export validate helpers used only internally - export what's needed by crud
let val = fs.readFileSync(path.join(mod, "bonus-rules.validate.ts"), "utf8");
val = val.replace(
  /^import type \{ BonusConditionInput, CreateBonusRuleInput \} from "\.\/bonus-rules\.types";/m,
  `import type { BonusConditionInput, CreateBonusRuleInput } from "./bonus-rules.types";
import { normalizeScopeBranchCodes, normalizeScopePositiveIds } from "./bonus-rules.mappers";`
);
val = val.replace(/^function /gm, "export function ");
val = val.replace(/^async function validatePrerequisiteRuleIds/gm, "export async function validatePrerequisiteRuleIds");
w(path.join(mod, "bonus-rules.validate.ts"), val);

let mappers2 = fs.readFileSync(path.join(mod, "bonus-rules.mappers.ts"), "utf8");
for (const fn of ["normalizeScopeBranchCodes", "normalizeScopePositiveIds", "parseOptionalDate"]) {
  mappers2 = mappers2.replace(new RegExp(`^function ${fn}`), `export function ${fn}`);
}
w(path.join(mod, "bonus-rules.mappers.ts"), mappers2);

w(
  path.join(mod, "bonus-rules.service.ts"),
  `/**
 * Domain: Bonus rules (qty / sum / discount).
 */
export * from "./bonus-rules.types";
export * from "./bonus-rules.mappers";
export * from "./bonus-rules.validate";
export * from "./bonus-rules.crud.create";
export * from "./bonus-rules.crud.update";
export * from "./bonus-rules.crud.lifecycle";
export * from "./bonus-rules.qty";
`
);

console.log("Phase 31 bonus-rules split done.");
