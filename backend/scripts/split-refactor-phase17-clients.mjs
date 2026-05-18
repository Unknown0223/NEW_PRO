/**
 * v3 — clients.service.ts bosqich 1: types, helpers, agent-assignments.
 * Barrel: clients.service.ts (import yo‘llari o‘zgarmaydi).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const clients = path.join(root, "../src/modules/clients");
const mainPath = path.join(clients, "clients.service.ts");
const backupPath = path.join(clients, "clients.service.backup.ts");

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
  console.log("Wrote clients.service.backup.ts");
}

const fileHeader = slice(lines, 1, 50);

const typesHeader = `import type { Prisma } from "@prisma/client";
import type { CityTerritoryHintDto } from "../tenant-settings/tenant-settings.service";
`;

w(
  path.join(clients, "clients.types.ts"),
  `${typesHeader}
${slice(lines, 51, 358)}
${slice(lines, 440, 447)}
`
);

const helpersHeader = `import { Prisma } from "@prisma/client";
import type { ClientRefEntryDto } from "../tenant-settings/tenant-settings.service";
import { salesRefStoredValue } from "../sales-directions/sales-directions.service";
import type { ClientRefOptionDto, ContactPersonSlot } from "./clients.types";

export const CONTACT_SLOTS = 10;
/** Excel import: faqat kontakt 1–2 (UI da uchinchi kontakt yo‘q). */
export const IMPORT_CONTACT_PERSON_SLOTS = 2;
`;

w(
  path.join(clients, "clients.helpers.ts"),
  `${helpersHeader}
${slice(lines, 239, 347)}
`
);

const assignHeader = `import { Prisma } from "@prisma/client";
import {
  type AgentAssignmentPatch,
  type ClientAgentAssignmentApi,
  parseVisitWeekdaysJson
} from "./clients.types";
import { CONTACT_SLOTS } from "./clients.helpers";

`;

w(
  path.join(clients, "clients.agent-assignments.ts"),
  `${assignHeader}
${slice(lines, 360, 626)}
`
);

// Remove CONTACT_SLOTS block from types (moved to helpers) — types had lines 207-209
let typesContent = fs.readFileSync(path.join(clients, "clients.types.ts"), "utf8");
typesContent = typesContent.replace(
  /\nconst CONTACT_SLOTS = 10;\n\/\*\* Excel import[\s\S]*?const IMPORT_CONTACT_PERSON_SLOTS = 2;\n/,
  "\n"
);
w(path.join(clients, "clients.types.ts"), typesContent);

// Export assignment helpers used by main service
let assignContent = fs.readFileSync(path.join(clients, "clients.agent-assignments.ts"), "utf8");
assignContent = assignContent
  .replace(/^function visitWeekdaysToPrismaJson/m, "function visitWeekdaysToPrismaJson")
  .replace(/^function mapAgentAssignmentsToApi/m, "export function mapAgentAssignmentsToApi")
  .replace(/^const agentAssignmentSelectFields/m, "export const agentAssignmentSelectFields")
  .replace(/^function mergeAgentDisplayFromAssignments/m, "export function mergeAgentDisplayFromAssignments")
  .replace(/^async function replaceClientAgentAssignments/m, "export async function replaceClientAgentAssignments")
  .replace(/^async function syncAssignmentSlotOneWithClientRow/m, "export async function syncAssignmentSlotOneWithClientRow");
w(path.join(clients, "clients.agent-assignments.ts"), assignContent);

// Export helpers used outside
let helpersContent = fs.readFileSync(path.join(clients, "clients.helpers.ts"), "utf8");
helpersContent = helpersContent
  .replace(/^function parseContactPersonsJson/m, "export function parseContactPersonsJson")
  .replace(/^function contactPersonsToJson/m, "export function contactPersonsToJson");
w(path.join(clients, "clients.helpers.ts"), helpersContent);

const mainImports = `${fileHeader}
export * from "./clients.types";
export * from "./clients.helpers";
export * from "./clients.agent-assignments";
import {
  mapAgentAssignmentsToApi,
  agentAssignmentSelectFields,
  mergeAgentDisplayFromAssignments,
  replaceClientAgentAssignments,
  syncAssignmentSlotOneWithClientRow
} from "./clients.agent-assignments";
import {
  CONTACT_SLOTS,
  IMPORT_CONTACT_PERSON_SLOTS,
  parseContactPersonsJson,
  contactPersonsToJson,
  mergeClientRefSelectOpts,
  mergeSalesChannelSelectOpts,
  mergeCitySelectOpts,
  normalizeDistinct
} from "./clients.helpers";
`;

w(path.join(clients, "clients.service.ts"), `${mainImports}
${slice(lines, 628, lines.length)}
`);

console.log("Phase 17 clients split done.");
