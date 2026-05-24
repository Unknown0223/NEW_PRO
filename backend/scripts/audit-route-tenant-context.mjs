#!/usr/bin/env node
/**
 * Har bir `app.(get|post|...)(` marshruti uchun `ensureTenantContext` borligini tekshiradi.
 * Umumiy handler — handler tanasida ensure qidiriladi.
 *
 * Ishlatish: node scripts/audit-route-tenant-context.mjs [fayl...]
 */
import { readFileSync } from "node:fs";

const DEFAULT_FILES = [
  "src/modules/clients/clients.route.ts",
  "src/modules/reports/reports.route.ts",
  "src/modules/orders/orders.route.ts",
  "src/modules/dashboard/dashboard.route.ts",
  "src/modules/stock/stock.route.ts",
  "src/modules/stock/goods-receipt.route.ts",
  "src/modules/stock/warehouse-transfers.route.ts",
  "src/modules/stock/retail-stock.route.ts",
  "src/modules/stock/suppliers.route.ts",
  "src/modules/stock/warehouse-blocks.route.ts",
  "src/modules/stock/stock-takes.route.ts",
  "src/modules/linkage/linkage.route.ts",
  "src/modules/mobile/mobile.route.ts",
  "src/modules/access/access.route.ts",
  "src/modules/products/products.route.ts",
  "src/modules/products/product-catalog.route.ts",
  "src/modules/products/product-prices.route.ts",
  "src/modules/products/price-matrix.route.ts",
  "src/modules/payments/payments.route.ts",
  "src/modules/field/field.route.ts",
  "src/modules/staff/staff.route.ts",
  "src/modules/cash-desks/cash-desks.route.ts"
];

const files = process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT_FILES;

let exitCode = 0;

function auditFile(file) {
  const s = readFileSync(file, "utf8");
  const routeRe = /^\s*app\.(get|post|patch|put|delete)\(\s*["']([^"']+)["']/gm;
  const missing = [];
  let count = 0;

  for (const match of s.matchAll(routeRe)) {
    count += 1;
    const path = match[2];
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

  if (missing.length) {
    exitCode = 1;
    console.log(`FAIL ${file} (${count} marshrut):`);
    for (const m of missing) console.log(`  - ${m}`);
  } else {
    console.log(`OK ${file}: ${count} marshrut`);
  }
}

for (const file of files) auditFile(file);
process.exit(exitCode);
