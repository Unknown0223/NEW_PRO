/**
 * v3 — clients.import: service dan ajratish + kichik fayllar.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const clients = path.join(root, "../src/modules/clients");
const mainPath = path.join(clients, "clients.service.ts");

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
const importBody = slice(lines, 88, 2476);

const sharedImports = `import { existsSync, readFileSync } from "fs";
import { join } from "path";
import ExcelJS from "exceljs";
import { Prisma } from "@prisma/client";
import * as XLSX from "xlsx";
import { prisma } from "../../config/database";
import { applyTerritoryAutoAssignAfterAddressChange } from "../work-slots/work-slots.territory-auto";
import { ClientImportRefResolver } from "./client-import-ref-resolve";
import {
  buildDuplicateCompositeKey,
  duplicateKeyFromExistingRow,
  filterClientUpdateInputByApplyFields,
  normalizeDuplicateKeyFields,
  normalizeUpdateApplyFields
} from "./client-import-masks";
import type { AgentAssignmentPatch, ContactPersonSlot } from "./clients.types";
import { normalizePhoneDigits, parseVisitWeekdaysJson } from "./clients.types";
import {
  CONTACT_SLOTS,
  IMPORT_CONTACT_PERSON_SLOTS,
  parseContactPersonsJson,
  contactPersonsToJson
} from "./clients.helpers";
import { replaceClientAgentAssignments } from "./clients.agent-assignments";
import { appendClientAuditLog } from "./clients.audit";
import { buildClientListWhereInput, clientListOrderBy } from "./clients.list";
`;

const parts = [
  { file: "clients.import.keys.ts", from: 88, to: 327 },
  { file: "clients.import.parse.ts", from: 328, to: 428 },
  { file: "clients.import.templates.ts", from: 429, to: 653 },
  { file: "clients.import.runtime.ts", from: 655, to: 883 },
  { file: "clients.import.rows-create.ts", from: 885, to: 1152 },
  { file: "clients.import.scalar.ts", from: 1154, to: 1333 },
  { file: "clients.import.rows-update.ts", from: 1335, to: 1778 },
  { file: "clients.import.assign.ts", from: 1779, to: 2136 },
  { file: "clients.import.main.ts", from: 2138, to: 2476 }
];

for (const { file, from, to } of parts) {
  w(path.join(clients, file), `${sharedImports}\n${slice(lines, from, to)}\n`);
}

w(
  path.join(clients, "clients.import.ts"),
  `/** Clients XLSX import — barrel. */
export * from "./clients.import.keys";
export * from "./clients.import.parse";
export * from "./clients.import.templates";
export * from "./clients.import.runtime";
export * from "./clients.import.rows-create";
export * from "./clients.import.scalar";
export * from "./clients.import.rows-update";
export * from "./clients.import.assign";
export * from "./clients.import.main";
`
);

const head = slice(lines, 1, 86);
w(
  mainPath,
  `${head}
export * from "./clients.import";
`
);

// Cross-module exports (used by siblings)
const exportRules = [
  {
    file: "clients.import.keys.ts",
    from: /^function (normalizeHeaderLabel|parseImportSlotFromHeader|parseImportAgentDaysSlotFromHeader|headerToClientImportKey|excelHeaderToImportKey)/m,
    to: "export function $1"
  },
  {
    file: "clients.import.parse.ts",
    from: /^function (isPlaceholderCell|parseOptionalDate|parseIsActive|parseCreditLimit|parseOptionalLatitudeImport|parseOptionalLongitudeImport|trimImportClientCode|trimImportPinfl|xlsxCellToString|readArrayCell|readImportRefCell|headerLabelFromCell)/m,
    to: "export function $1"
  },
  {
    file: "clients.import.templates.ts",
    from: /^function (lalakuNewClientTemplateHeaders|lalakuClientUpdateTemplateHeaders|formatVisitWeekdaysRussian)/m,
    to: "export function $1"
  },
  {
    file: "clients.import.runtime.ts",
    from: /^function (buildColIndexFromHeaderRow|createImportWarningCollector|normalizeProgressPercent|emitClientImportProgress|sheetToRowsMatrix|findImportTableInWorkbook|reportImportRowProgress|estimateImportTotalRows)/m,
    to: "export function $1"
  },
  {
    file: "clients.import.runtime.ts",
    from: /^type (ClientImportProgressSink|ImportWarningCollector|ImportFlowContext)/m,
    to: "export type $1"
  },
  {
    file: "clients.import.rows-create.ts",
    from: /^async function importClientDataRows/m,
    to: "export async function importClientDataRows"
  },
  {
    file: "clients.import.scalar.ts",
    from: /^function (importColPresent|normalizeImportContactSlots|normalizeImportDateIso|normalizeImportDecimalString|filterUnchangedImportScalarData|normalizeExistingImportAssignments|normalizeIncomingImportAssignments|importAssignmentsEqual)/m,
    to: "export function $1"
  },
  {
    file: "clients.import.rows-update.ts",
    from: /^async function importClientUpdateRows/m,
    to: "export async function importClientUpdateRows"
  },
  {
    file: "clients.import.assign.ts",
    from: /^function (buildManualColumnMap|isAssignmentClearToken|parseRussianVisitDaysDetailed|indexImportStaffLookup|pickImportStaffByAllowedRoles|resolveStaffByRefForImport|colMapHasAgentSlots|buildAgentAssignmentPatchesFromImportRow|parseClientDbIdFromCell)/m,
    to: "export function $1"
  },
  {
    file: "clients.import.assign.ts",
    from: /^async function loadImportStaffLookup/m,
    to: "export async function loadImportStaffLookup"
  },
  {
    file: "clients.import.assign.ts",
    from: /^type ImportStaffLookup/m,
    to: "export type ImportStaffLookup"
  }
];

for (const { file, from, to } of exportRules) {
  const p = path.join(clients, file);
  let c = fs.readFileSync(p, "utf8");
  c = c.replace(from, to);
  w(p, c);
}

// Trim shared imports per file (best-effort: keys only needs CONTACT_SLOTS)
const keysOnly = `import { CONTACT_SLOTS } from "./clients.helpers";\n\n`;
let keysContent = fs.readFileSync(path.join(clients, "clients.import.keys.ts"), "utf8");
keysContent = keysContent.replace(sharedImports, keysOnly);
w(path.join(clients, "clients.import.keys.ts"), keysContent);

console.log("Phase 21 clients import split done. Run tsc to fix cross-imports.");
