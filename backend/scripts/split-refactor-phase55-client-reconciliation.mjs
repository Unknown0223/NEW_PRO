/**
 * client-reconciliation-data.ts bo‘linishi.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const clients = path.join(path.dirname(fileURLToPath(import.meta.url)), "../src/modules/clients");
const backupPath = path.join(clients, "client-reconciliation-data.backup.ts");
const srcPath = path.join(clients, "client-reconciliation-data.ts");

function read(p) {
  return fs.readFileSync(p, "utf8").split(/\r?\n/);
}
function slice(lines, a, b) {
  return lines.slice(a - 1, b).join("\n");
}
function w(p, c) {
  fs.writeFileSync(p, c.endsWith("\n") ? c : `${c}\n`);
}
function exportFns(body) {
  return body.replace(/^function /gm, "export function ");
}

if (!fs.existsSync(backupPath)) {
  fs.copyFileSync(srcPath, backupPath);
}
const lines = read(backupPath);

const hdr = slice(lines, 1, 9);

w(path.join(clients, "client-reconciliation.types.ts"), `${hdr}\n${slice(lines, 10, 131)}`);

w(
  path.join(clients, "client-reconciliation.shared.ts"),
  `${hdr}
import type { ClientReconciliationChronoLine, ClientReconciliationLoaded } from "./client-reconciliation.types";

${exportFns(slice(lines, 82, 107))}

${exportFns(slice(lines, 317, 369))}

${exportFns(slice(lines, 427, 431))}
`
);

w(
  path.join(clients, "client-reconciliation.load.ts"),
  `${hdr}
import type { ClientReconciliationLoaded } from "./client-reconciliation.types";

${slice(lines, 132, 270)}
`
);

w(
  path.join(clients, "client-reconciliation.mappers.ts"),
  `import { buildClientReconciliationPdf, type ReconciliationPdfPayload } from "./client-reconciliation-pdf";
import type {
  ClientReconciliationChronoLine,
  ClientReconciliationJsonResponse,
  ClientReconciliationLoaded
} from "./client-reconciliation.types";
import {
  buildChronological,
  decStr,
  formatLocalDateLabel,
  formatLocalDateTimeLabel,
  formatLocalYmd
} from "./client-reconciliation.shared";

${slice(lines, 271, 315)}

${slice(lines, 371, 424)}
`
);

w(
  path.join(clients, "client-reconciliation.xlsx.ts"),
  `${hdr}
import type { ClientReconciliationLoaded } from "./client-reconciliation.types";
import { toClientReconciliationJson } from "./client-reconciliation.mappers";
import { safeExcelSheetName } from "./client-reconciliation.shared";

${slice(lines, 433, 511)}
`
);

w(
  path.join(clients, "client-reconciliation-data.ts"),
  `export * from "./client-reconciliation.types";
export * from "./client-reconciliation.shared";
export * from "./client-reconciliation.load";
export * from "./client-reconciliation.mappers";
export * from "./client-reconciliation.xlsx";
`
);

console.log("Phase 55 client-reconciliation split done.");
