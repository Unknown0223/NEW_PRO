/**
 * v4 — clients.route.schemas bo‘linishi (forms + parsers).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const mod = path.join(root, "../src/modules/clients");
const mainPath = path.join(mod, "clients.route.schemas.ts");
const backupPath = path.join(mod, "clients.route.schemas.backup.ts");

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
  fs.copyFileSync(mainPath, backupPath);
}
const lines = read(backupPath);

w(
  path.join(mod, "clients.route.schemas.forms.ts"),
  `import { z } from "zod";
import { clientAgentAssignmentSlotSchema } from "../../contracts/clients.schemas";

${slice(lines, 75, 87)}

${slice(lines, 179, 229)}
`
);

w(
  path.join(mod, "clients.route.schemas.parsers.ts"),
  `import type { FastifyReply, FastifyRequest } from "fastify";
import type { ListClientsQuery } from "./clients.service";
import { buildClientUpdateImportTemplateBuffer } from "./clients.service";

${slice(lines, 60, 73)}

${slice(lines, 89, 177)}

const CLIENT_LIST_ALLOWED_SORT = new Set<string>([
  "name",
  "phone",
  "id",
  "created_at",
  "region",
  "legal_name",
  "address",
  "responsible_person",
  "landmark",
  "inn",
  "client_pinfl",
  "sales_channel",
  "category",
  "client_type_code",
  "client_format",
  "district",
  "neighborhood",
  "zone",
  "city",
  "client_code",
  "latitude",
  "longitude"
]);

${slice(lines, 256, 395)}
`
);

w(
  path.join(mod, "clients.route.schemas.ts"),
  `export {
  createClientEquipmentBodySchema,
  createClientPhotoBodySchema,
  createClientBodySchema,
  mergeBodySchema,
  savedDupGroupBodySchema,
  balanceMovementBodySchema,
  bulkActiveBodySchema
} from "./clients.route.schemas.forms";
export {
  sendClientUpdateImportTemplateXlsx,
  parseClientImportMultipart,
  parseLocalYmd,
  endOfLocalDay,
  defaultReconciliationRange,
  parseClientListQuery,
  parseReconciliationDateRange
} from "./clients.route.schemas.parsers";
`
);

console.log("phase70 done");
