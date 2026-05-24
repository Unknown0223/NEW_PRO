/**
 * territory.service bo‘linishi.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const mod = path.join(path.dirname(fileURLToPath(import.meta.url)), "../src/modules/territory");
const backupPath = path.join(mod, "territory.service.backup.ts");
const srcPath = path.join(mod, "territory.service.ts");

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

const hdr = slice(lines, 1, 3);

w(
  path.join(mod, "territory.helpers.ts"),
  `${hdr}

${exportFns(slice(lines, 8, 40))}
`
);

w(
  path.join(mod, "territory.crud.ts"),
  `${hdr}
import { validatePolygon } from "./territory.helpers";

${slice(lines, 46, 220)}
`
);

w(
  path.join(mod, "territory.assign.ts"),
  `${hdr}

${slice(lines, 230, 283)}
`
);

w(
  path.join(mod, "territory.checkin.ts"),
  `${hdr}

${slice(lines, 294, 435)}
`
);

w(
  path.join(mod, "territory.stats.ts"),
  `${hdr}

${slice(lines, 441, 546)}
`
);

w(
  path.join(mod, "territory.service.ts"),
  `export * from "./territory.helpers";
export * from "./territory.crud";
export * from "./territory.assign";
export * from "./territory.checkin";
export * from "./territory.stats";
`
);

console.log("Phase 62 territory split done.");
