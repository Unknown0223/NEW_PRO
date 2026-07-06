#!/usr/bin/env node
/**
 * Monorepo: har bir manba fayl ≤ MAX_FILE_LINES (default 400).
 * Ishlatish: node scripts/audit-max-file-lines.mjs [--backend] [--frontend] [--docs]
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const MAX = Number.parseInt(process.env.MAX_FILE_LINES ?? "400", 10);
const args = process.argv.slice(2);
const flags = {
  backend: args.includes("--backend") || args.length === 0,
  frontend: args.includes("--frontend") || args.length === 0,
  docs: args.includes("--docs") || args.length === 0
};
const extraRoots = args.filter((a) => !a.startsWith("--")).map((p) => path.resolve(p));

const SKIP_DIR = new Set(["node_modules", ".next", "dist", "build", "coverage", ".git", "archive"]);
const SKIP_REL =
  /(?:^|\/)(?:.*\.backup\.|openapi\.bundle\.yaml$|package-lock\.json$|components\.json$|\.woff2?$)|\.monolith\.tsx?$/i;
const SKIP_TEST = /\.(backup|test|spec)\.(ts|tsx)$/i;

function loadLegacyAllowlist(filename) {
  const p = path.join(repoRoot, "scripts", filename);
  if (!existsSync(p)) return new Set();
  return new Set(
    readFileSync(p, "utf8")
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
  );
}

function buildLegacySet() {
  const set = new Set();
  if (flags.frontend) {
    for (const f of loadLegacyAllowlist("legacy-max-loc-frontend.txt")) set.add(f);
  }
  if (flags.backend) {
    for (const f of loadLegacyAllowlist("legacy-max-loc-backend.txt")) set.add(f);
  }
  return set;
}

function defaultRoots() {
  const roots = [...extraRoots];
  if (flags.backend) {
    roots.push(
      path.join(repoRoot, "backend", "src"),
      path.join(repoRoot, "backend", "prisma"),
      path.join(repoRoot, "backend", "scripts"),
      path.join(repoRoot, "backend", "tests"),
      path.join(repoRoot, "backend", "openapi")
    );
  }
  if (flags.frontend) {
    roots.push(
      path.join(repoRoot, "frontend", "components"),
      path.join(repoRoot, "frontend", "app"),
      path.join(repoRoot, "frontend", "lib"),
      path.join(repoRoot, "frontend", "scripts")
    );
  }
  if (flags.docs) {
    for (const name of readdirSync(repoRoot, { withFileTypes: true })) {
      if (!name.isFile()) continue;
      if (/\.(md|html)$/i.test(name.name)) roots.push(path.join(repoRoot, name.name));
    }
    roots.push(path.join(repoRoot, "docs"));
  }
  return roots;
}

function extOk(name) {
  return /\.(ts|tsx|sql|prisma|yaml|yml|md|html|mjs|cjs)$/i.test(name);
}

function walk(dir, out) {
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (SKIP_DIR.has(ent.name)) continue;
      walk(full, out);
      continue;
    }
    if (!ent.isFile() || !extOk(ent.name)) continue;
    out.push(full);
  }
}

const violations = [];
const scanRoots = defaultRoots().filter((r) => existsSync(r));

for (const root of scanRoots) {
  const st = statSync(root, { throwIfNoEntry: false });
  if (!st) continue;
  const files = [];
  if (st.isDirectory()) walk(root, files);
  else files.push(root);

  for (const file of files) {
    const rel = path.relative(repoRoot, file).replace(/\\/g, "/");
    if (SKIP_REL.test(rel) || SKIP_TEST.test(rel)) continue;
    if (rel.includes("/openapi/") && rel.endsWith("openapi.bundle.yaml")) continue;
    const lines = readFileSync(file, "utf8").split(/\r?\n/).length;
    if (lines > MAX) violations.push({ file: rel, lines });
  }
}

const legacy = buildLegacySet();
const unexpected = violations.filter((v) => !legacy.has(v.file));
const legacyHits = violations.filter((v) => legacy.has(v.file));

if (unexpected.length === 0) {
  const legacyNote =
    legacyHits.length > 0 ? ` (${legacyHits.length} legacy allowlist, ${unexpected.length} new)` : "";
  console.log(`OK max file lines ≤${MAX} (${scanRoots.length} root(s))${legacyNote}`);
  process.exit(0);
}

unexpected.sort((a, b) => b.lines - a.lines);
console.error(`FAIL ${unexpected.length} file(s) exceed ${MAX} lines (not in legacy allowlist):`);
for (const v of unexpected) {
  console.error(`  ${v.lines}\t${v.file}`);
}
if (legacyHits.length > 0) {
  const legacyFiles = [
    flags.frontend ? "scripts/legacy-max-loc-frontend.txt" : null,
    flags.backend ? "scripts/legacy-max-loc-backend.txt" : null
  ]
    .filter(Boolean)
    .join(", ");
  console.error(`(${legacyHits.length} additional legacy file(s) still >${MAX} — see ${legacyFiles})`);
}
process.exit(1);
