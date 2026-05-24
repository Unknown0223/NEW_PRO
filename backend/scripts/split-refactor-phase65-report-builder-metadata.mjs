/**
 * report-builder.metadata bo‘linishi.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const mod = path.join(path.dirname(fileURLToPath(import.meta.url)), "../src/modules/report-builder");
const backupPath = path.join(mod, "report-builder.metadata.backup.ts");
const srcPath = path.join(mod, "report-builder.metadata.ts");

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

const hdr = slice(lines, 1, 10);

w(
  path.join(mod, "report-builder.field-registry.part1.ts"),
  `${hdr}

export const FIELD_REGISTRY_PART1: Record<
  string,
  { label: string; allowRow: boolean; allowCol: boolean; expr: () => import("@prisma/client").Prisma.Sql }
> = {
${slice(lines, 15, 220)}
};
`
);

w(
  path.join(mod, "report-builder.field-registry.part2.ts"),
  `${slice(lines, 1, 2)}

export const FIELD_REGISTRY_PART2: Record<
  string,
  { label: string; allowRow: boolean; allowCol: boolean; expr: () => import("@prisma/client").Prisma.Sql }
> = {
${slice(lines, 221, 442)}
};
`
);

w(
  path.join(mod, "report-builder.field-registry.ts"),
  `${hdr}
import { FIELD_REGISTRY_PART1 } from "./report-builder.field-registry.part1";
import { FIELD_REGISTRY_PART2 } from "./report-builder.field-registry.part2";

const FIELD_REGISTRY: Record<
  string,
  { label: string; allowRow: boolean; allowCol: boolean; expr: () => import("@prisma/client").Prisma.Sql }
> = { ...FIELD_REGISTRY_PART1, ...FIELD_REGISTRY_PART2 };

${slice(lines, 445, 523)}
`
);

w(
  path.join(mod, "report-builder.metadata.ts"),
  `export * from "./report-builder.field-registry";
`
);

console.log("Phase 65 report-builder.metadata split done.");
