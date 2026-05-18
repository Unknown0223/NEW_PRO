/**
 * clients.write.ts bo‘linishi.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const clients = path.join(path.dirname(fileURLToPath(import.meta.url)), "../src/modules/clients");
const backupPath = path.join(clients, "clients.write.backup.ts");
const srcPath = path.join(clients, "clients.write.ts");

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

const hdr = slice(lines, 1, 17);

w(path.join(clients, "clients.write.types.ts"), `${hdr}\n${slice(lines, 18, 98)}`);

w(
  path.join(clients, "clients.write.helpers.ts"),
  `${hdr}\n${exportFns(slice(lines, 63, 80))}`
);

w(
  path.join(clients, "clients.write.create.ts"),
  `${hdr}\nimport type { CreateClientMinimalInput } from "./clients.write.types";
import { parseOptionalLatitude, parseOptionalLongitude } from "./clients.write.helpers";

${slice(lines, 99, 192)}
`
);

w(
  path.join(clients, "clients.write.audit.ts"),
  `${hdr}\n${slice(lines, 193, 238)}
`
);

w(
  path.join(clients, "clients.write.update.ts"),
  `${hdr}import type { UpdateClientInput } from "./clients.write.types";
import { parseOptionalLatitude, parseOptionalLongitude } from "./clients.write.helpers";

${slice(lines, 240, 445)}
`
);

w(
  path.join(clients, "clients.write.ts"),
  `export * from "./clients.write.types";
export * from "./clients.write.helpers";
export * from "./clients.write.create";
export * from "./clients.write.audit";
export * from "./clients.write.update";
`
);

console.log("Phase 54 clients.write split done.");
