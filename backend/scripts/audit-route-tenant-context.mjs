#!/usr/bin/env node
/**
 * Har bir `app.(get|post|...)(` marshruti uchun `ensureTenantContext` borligini tekshiradi.
 * Umumiy handler — handler tanasida ensure qidiriladi.
 *
 * Ishlatish: node scripts/audit-route-tenant-context.mjs [fayl...]
 * Fayl berilmasa: src ostidagi barcha route TypeScript fayllari.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const SKIP_PATHS = new Set([
  "/api/mobile/app-release",
  "/api/mobile/apk-download"
]);

function skipPath(path) {
  if (SKIP_PATHS.has(path)) return true;
  if (path.includes("/metrics/web-vitals")) return true;
  if (path.startsWith("/metrics/")) return true;
  if (path.includes("/health")) return true;
  return false;
}

function isRouteSource(name) {
  if (!name.endsWith(".ts")) return false;
  if (name.includes(".test.")) return false;
  if (name.includes(".schemas.")) return false;
  if (name.includes(".parsers.")) return false;
  if (name.includes(".shared.")) return false;
  if (name.includes(".mappers.")) return false;
  if (name.includes(".helpers.")) return false;
  if (name.includes(".types.")) return false;
  return /\.route(\.[a-z0-9_-]+)?\.ts$/i.test(name);
}

function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    let st;
    try {
      st = statSync(p);
    } catch {
      continue;
    }
    if (st.isDirectory()) {
      if (name === "node_modules" || name === "dist") continue;
      walk(p, acc);
    } else if (isRouteSource(name)) {
      acc.push(p.replace(/\\/g, "/"));
    }
  }
  return acc;
}

const files = process.argv.slice(2).length
  ? process.argv.slice(2)
  : walk("src");

let exitCode = 0;
let totalRoutes = 0;

function auditFile(file) {
  let s;
  try {
    s = readFileSync(file, "utf8");
  } catch (err) {
    exitCode = 1;
    console.error(`XATO: ${file} o‘qilmadi`);
    return;
  }
  const routeRe = /^\s*app\.(get|post|patch|put|delete)\(\s*["']([^"']+)["']/gm;
  const missing = [];
  let count = 0;
  const isBarrel = /register[A-Za-z0-9]+Routes\s*\(/.test(s);

  for (const match of s.matchAll(routeRe)) {
    count += 1;
    const path = match[2];
    if (skipPath(path)) continue;
    const start = match.index ?? 0;
    const head = s.slice(start, start + 500);
    const named = head.match(/,\s*([a-zA-Z]+Handler)\s*\)/);
    if (named) {
      const name = named[1];
      const def = s.indexOf(`const ${name}`);
      if (def === -1) {
        missing.push(`${path} → ${name} (topilmadi)`);
        continue;
      }
      const block = s.slice(def, def + 800);
      if (!block.includes("ensureTenantContext")) missing.push(`${path} → ${name}`);
    } else if (!head.includes("ensureTenantContext")) {
      missing.push(path);
    }
  }

  totalRoutes += count;

  if (count === 0 && !isBarrel) {
    exitCode = 1;
    console.error(`XATO: ${file} da marshrut topilmadi`);
    return;
  }

  if (missing.length) {
    exitCode = 1;
    console.log(`FAIL ${file} (${count} marshrut):`);
    for (const m of missing) console.log(`  - ${m}`);
  } else {
    console.log(`OK ${file}: ${count} marshrut`);
  }
}

for (const file of files) auditFile(file);
console.log(`Jami: ${files.length} fayl, ${totalRoutes} marshrut`);
process.exit(exitCode);
