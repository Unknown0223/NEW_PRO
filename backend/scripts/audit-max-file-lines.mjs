#!/usr/bin/env node
/**
 * Refaktoring rejasi: bir fayl ≤ MAX_FILE_LINES (default 400).
 * `*.backup.ts` va `*.test.ts` hisobga olinmaydi.
 *
 * Ishlatish: node scripts/audit-max-file-lines.mjs [root...]
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.join(__dirname, "..");
const defaultRoots = [path.join(backendRoot, "src")];
const roots = process.argv.slice(2).map((p) => path.resolve(p));
const scanRoots = roots.length ? roots : defaultRoots;

const MAX = Number.parseInt(process.env.MAX_FILE_LINES ?? "400", 10);
if (!Number.isFinite(MAX) || MAX < 1) {
  console.error("Invalid MAX_FILE_LINES");
  process.exit(2);
}

const SKIP_NAME = /\.(backup|test)\.ts$/i;

function walk(dir, out) {
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === "node_modules" || ent.name === "dist") continue;
      walk(full, out);
      continue;
    }
    if (!ent.isFile() || !ent.name.endsWith(".ts") || SKIP_NAME.test(ent.name)) continue;
    out.push(full);
  }
}

const violations = [];

for (const root of scanRoots) {
  if (!statSync(root, { throwIfNoEntry: false })?.isDirectory()) {
    console.error(`Not a directory: ${root}`);
    process.exit(2);
  }
  const files = [];
  walk(root, files);
  for (const file of files) {
    const lines = readFileSync(file, "utf8").split(/\r?\n/).length;
    if (lines > MAX) {
      violations.push({ file: path.relative(backendRoot, file).replace(/\\/g, "/"), lines });
    }
  }
}

if (violations.length === 0) {
  console.log(`OK max file lines ≤${MAX} (${scanRoots.map((r) => path.relative(backendRoot, r)).join(", ")})`);
  process.exit(0);
}

violations.sort((a, b) => b.lines - a.lines);
console.error(`FAIL ${violations.length} file(s) exceed ${MAX} lines:`);
for (const v of violations) {
  console.error(`  ${v.lines}\t${v.file}`);
}
process.exit(1);
