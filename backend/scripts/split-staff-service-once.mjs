import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dir = path.join(__dirname, "../src/modules/staff");
const backup = path.join(dir, "staff.service.backup.ts");
const lines = fs.readFileSync(backup, "utf8").split(/\r?\n/);
const slice = (a, b) => lines.slice(a - 1, b).join("\n");
const importHeader = slice(1, 27);

const exportInShared = [
  "kindRole",
  "normalizePositiveIntIds",
  "assertWarehousesBelongToTenant",
  "tradeDirectionDisplayFromRef",
  "applyTradeDirectionPatch",
  "tradeDirectionForCreate",
  "toFio",
  "normalizePriceTypes",
  "parsePriceTypesJson",
  "parseEntitlements",
  "normalizeAgentEntitlementsInput",
  "mergePriceTypesForUser",
  "refStringListFromTenantSettings",
  "asTenantSettingsRecord",
  "syncSkladchikWarehouseLinks"
];

let sharedBody = slice(28, 747);
sharedBody = sharedBody.replace(/^const STAFF_KINDS_WITH_WORK_SLOT/m, "export const STAFF_KINDS_WITH_WORK_SLOT");
for (const name of exportInShared) {
  sharedBody = sharedBody.replace(
    new RegExp(`^(async )?function ${name}\\b`, "m"),
    `export $1function ${name}`
  );
}

fs.writeFileSync(path.join(dir, "staff.shared.ts"), `${importHeader}\n${sharedBody}\n`);

const crudImports = `
import type {
  AgentEntitlements,
  CreateStaffInput,
  ExpeditorAssignmentRules,
  ListStaffFilters,
  StaffCreateResult,
  StaffKind,
  StaffRow
} from "./staff.shared";
import {
  SKLADCHIK_WAREHOUSE_LINK_ROLE,
  STAFF_KINDS_WITH_WORK_SLOT,
  applyTradeDirectionPatch,
  assertExpeditorMobileTradeDirections,
  assertWarehousesBelongToTenant,
  kindRole,
  mergePriceTypesForUser,
  normalizeAgentEntitlementsInput,
  normalizePositiveIntIds,
  normalizePriceTypes,
  parseEntitlements,
  parseExpeditorAssignmentRules,
  parsePriceTypesJson,
  refStringListFromTenantSettings,
  syncSkladchikWarehouseLinks,
  toFio,
  tradeDirectionDisplayFromRef,
  tradeDirectionForCreate,
  validateAgentEntitlements,
  validateExpeditorAssignmentRules
} from "./staff.shared";
`;

fs.writeFileSync(path.join(dir, "staff.crud.ts"), `${importHeader}${crudImports}\n${slice(748, lines.length)}\n`);

fs.writeFileSync(
  path.join(dir, "staff.service.ts"),
  `/** Staff domain — shared + CRUD. Kind: staff.agent.ts … (ixtiyoriy re-export). */
export * from "./staff.shared";
export * from "./staff.crud";
`
);

console.log("Staff split done.");
