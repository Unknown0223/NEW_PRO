/**
 * client-qr.service bo‘linishi.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const mod = path.join(path.dirname(fileURLToPath(import.meta.url)), "../src/modules/client-qr");
const backupPath = path.join(mod, "client-qr.service.backup.ts");
const srcPath = path.join(mod, "client-qr.service.ts");

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
  return body
    .replace(/^function /gm, "export function ")
    .replace(/^const MAX_QR/gm, "export const MAX_QR")
    .replace(/^const QR_GENERATE/gm, "export const QR_GENERATE");
}

if (!fs.existsSync(backupPath)) {
  fs.copyFileSync(srcPath, backupPath);
}
const lines = read(backupPath);

const hdr = slice(lines, 1, 5);

w(
  path.join(mod, "client-qr.types.ts"),
  `${hdr}
${slice(lines, 6, 39)}

${slice(lines, 407, 416)}

${slice(lines, 457, 465)}
`
);

w(
  path.join(mod, "client-qr.helpers.ts"),
  `${hdr}
import type { ClientWithoutQrRow, QrListQuery, QrListRow } from "./client-qr.types";

${exportFns(slice(lines, 41, 169))}
`
);

w(
  path.join(mod, "client-qr.list.ts"),
  `${hdr}
import type { QrListQuery, QrListRow } from "./client-qr.types";
import { buildWhere, toCsv } from "./client-qr.helpers";

${slice(lines, 171, 246)}
`
);

w(
  path.join(mod, "client-qr.write.ts"),
  `${hdr}
import {
  MAX_QR_GENERATE_PER_REQUEST,
  QR_GENERATE_CHUNK,
  uniqueQrCodes
} from "./client-qr.helpers";

${slice(lines, 248, 405)}
`
);

w(
  path.join(mod, "client-qr.stats.ts"),
  `${hdr}
import type { ClientQrStats } from "./client-qr.types";

${slice(lines, 418, 455)}
`
);

w(
  path.join(mod, "client-qr.clients-without.ts"),
  `${hdr}
import type { ClientWithoutQrRow } from "./client-qr.types";
import { toClientsWithoutQrCsv } from "./client-qr.helpers";

${slice(lines, 467, 552)}
`
);

w(
  path.join(mod, "client-qr.service.ts"),
  `export * from "./client-qr.types";
export * from "./client-qr.helpers";
export * from "./client-qr.list";
export * from "./client-qr.write";
export * from "./client-qr.stats";
export * from "./client-qr.clients-without";
`
);

console.log("Phase 61 client-qr split done.");
