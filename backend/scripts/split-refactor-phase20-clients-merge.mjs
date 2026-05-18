/**
 * v3 — clients bosqich 4: merge.
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

w(
  path.join(clients, "clients.merge.ts"),
  `import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { loadClientPreviewsMap } from "./client-dedupe.service";
import { appendClientAuditLog } from "./clients.audit";

${slice(lines, 87, 438)}
`
);

const head = slice(lines, 1, 86);
const tail = slice(lines, 439, lines.length);

w(
  mainPath,
  `${head}
export * from "./clients.merge";
${tail}
`
);

console.log("Phase 20 clients merge done.");
