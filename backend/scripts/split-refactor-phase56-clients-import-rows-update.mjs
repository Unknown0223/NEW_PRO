/**
 * clients.import.rows-update.ts — scalar build ajratish.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const clients = path.join(path.dirname(fileURLToPath(import.meta.url)), "../src/modules/clients");
const backupPath = path.join(clients, "clients.import.rows-update.backup.ts");
const srcPath = path.join(clients, "clients.import.rows-update.ts");

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

const buildHdr = `import { Prisma } from "@prisma/client";
import { ClientImportRefResolver } from "./client-import-ref-resolve";
import { filterClientUpdateInputByApplyFields } from "./client-import-masks";
import { normalizePhoneDigits } from "./clients.types";
import { IMPORT_CONTACT_PERSON_SLOTS, contactPersonsToJson } from "./clients.helpers";
import type { ContactPersonSlot } from "./clients.types";
import {
  isPlaceholderCell,
  parseCreditLimit,
  parseIsActive,
  parseOptionalDate,
  parseOptionalLatitudeImport,
  parseOptionalLongitudeImport,
  readArrayCell,
  readImportRefCell,
  trimImportClientCode,
  trimImportPinfl
} from "./clients.import.parse";
import { importColPresent } from "./clients.import.scalar";
`;

const mainHdr = slice(lines, 1, 43);

let buildBody = slice(lines, 201, 394);

w(
  path.join(clients, "clients.import.rows-update.build.ts"),
  `${buildHdr}
export function buildImportUpdateScalarData(
  row: unknown[],
  colIndexByKey: Record<string, number>,
  refResolver: ClientImportRefResolver,
  applySet: Set<string> | null
): Prisma.ClientUpdateInput {
  let data: Prisma.ClientUpdateInput = {};
${buildBody}
  return data;
}
`
);

let mainBody = slice(lines, 44, 486);
mainBody = mainBody.replace(
  /      let data: Prisma\.ClientUpdateInput = \{\};\n\n[\s\S]*?      if \(applySet != null\) \{\n        data = filterClientUpdateInputByApplyFields\(data, applySet\);\n      \}\n/,
  "      let data = buildImportUpdateScalarData(row, colIndexByKey, refResolver, applySet);\n"
);

w(
  path.join(clients, "clients.import.rows-update.ts"),
  `${mainHdr}
import { buildImportUpdateScalarData } from "./clients.import.rows-update.build";

${mainBody}
`
);

console.log("Phase 56 clients.import.rows-update split done.");
