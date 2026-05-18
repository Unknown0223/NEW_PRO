/**
 * work-slots.query bo‘linishi.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const mod = path.join(path.dirname(fileURLToPath(import.meta.url)), "../src/modules/work-slots");
const backupPath = path.join(mod, "work-slots.query.backup.ts");
const srcPath = path.join(mod, "work-slots.query.ts");

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
    .replace(/^const slotInclude/gm, "export const slotInclude");
}

if (!fs.existsSync(backupPath)) {
  fs.copyFileSync(srcPath, backupPath);
}
const lines = read(backupPath);

w(
  path.join(mod, "work-slots.query.helpers.ts"),
  `${slice(lines, 1, 3)}
import type { SlotHistoryRow, WorkSlotRow } from "./work-slots.types";

${exportFns(slice(lines, 6, 121))}
`
);

w(
  path.join(mod, "work-slots.query.filters.ts"),
  `${slice(lines, 1, 4)}

${slice(lines, 123, 328).replace(/^function /gm, "export function ")}
`
);

w(
  path.join(mod, "work-slots.query.read.ts"),
  `${slice(lines, 1, 3)}
import type { SlotHistoryRow, WorkSlotRow } from "./work-slots.types";
import { mapSlotRow, slotInclude } from "./work-slots.query.helpers";
import { buildListWhere, type ListWorkSlotsFilters } from "./work-slots.query.filters";

${slice(lines, 330, 460)}
`
);

w(
  path.join(mod, "work-slots.query.ts"),
  `export * from "./work-slots.query.helpers";
export * from "./work-slots.query.filters";
export * from "./work-slots.query.read";
`
);

console.log("Phase 63 work-slots.query split done.");
