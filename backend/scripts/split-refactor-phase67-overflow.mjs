/**
 * audit:max-loc dan oshgan fayllarni bo‘lish.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const src = path.join(path.dirname(fileURLToPath(import.meta.url)), "../src");

function read(p) {
  return fs.readFileSync(p, "utf8").split(/\r?\n/);
}
function slice(lines, a, b) {
  return lines.slice(a - 1, b).join("\n");
}
function w(p, c) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, c.endsWith("\n") ? c : `${c}\n`);
}
function backupOnce(filePath) {
  const bp = filePath.replace(/\.ts$/, ".backup.ts");
  if (!fs.existsSync(bp)) fs.copyFileSync(filePath, bp);
  return read(filePath);
}

function splitRoute(rel, readSlice, writeSlice, registerFn, readFn, writeFn) {
  const filePath = path.join(src, rel);
  const lines = backupOnce(filePath);
  const hdr = slice(lines, 1, readSlice[0] - 1);
  const dir = path.dirname(filePath);
  const base = path.basename(rel, ".route.ts");
  w(
    path.join(dir, `${base}.route.read.ts`),
    `${hdr}
export async function ${readFn}(app: FastifyInstance) {
${slice(lines, readSlice[0], readSlice[1])}
}
`
  );
  w(
    path.join(dir, `${base}.route.write.ts`),
    `${hdr}
export async function ${writeFn}(app: FastifyInstance) {
${slice(lines, writeSlice[0], writeSlice[1])}
}
`
  );
  w(
    filePath,
    `import type { FastifyInstance } from "fastify";
import { ${readFn} } from "./${base}.route.read";
import { ${writeFn} } from "./${base}.route.write";

export async function ${registerFn}(app: FastifyInstance) {
  await ${readFn}(app);
  await ${writeFn}(app);
}
`
  );
}

// payments
{
  const fp = path.join(src, "modules/payments/payments.route.ts");
  const lines = backupOnce(fp);
  const hdr = slice(lines, 1, 37);
  w(
    path.join(src, "modules/payments/payments.route.read.ts"),
    `${hdr}
export async function registerPaymentReadRoutes(app: FastifyInstance) {
${slice(lines, 40, 178)}
}
`
  );
  w(
    path.join(src, "modules/payments/payments.route.write.ts"),
    `${hdr}
export async function registerPaymentWriteRoutes(app: FastifyInstance) {
${slice(lines, 180, 401)}
}
`
  );
  w(
    fp,
    `import type { FastifyInstance } from "fastify";
import { registerPaymentReadRoutes } from "./payments.route.read";
import { registerPaymentWriteRoutes } from "./payments.route.write";

export async function registerPaymentRoutes(app: FastifyInstance) {
  await registerPaymentReadRoutes(app);
  await registerPaymentWriteRoutes(app);
}
`
  );
}

// staff schemas
{
  const fp = path.join(src, "modules/staff/staff.route.schemas.ts");
  const lines = backupOnce(fp);
  w(path.join(src, "modules/staff/staff.route.schemas.forms.ts"), slice(lines, 1, 205));
  w(path.join(src, "modules/staff/staff.route.schemas.parsers.ts"), `${slice(lines, 1, 2)}\n${slice(lines, 206, 401)}`);
  w(fp, `export * from "./staff.route.schemas.forms";
export * from "./staff.route.schemas.parsers";
`);
}

splitRoute(
  "modules/work-slots/work-slots.route.ts",
  [76, 218],
  [219, 405],
  "registerWorkSlotRoutes",
  "registerWorkSlotListRoutes",
  "registerWorkSlotDetailRoutes"
);
splitRoute(
  "modules/stock/suppliers.route.ts",
  [88, 229],
  [230, 406],
  "registerSupplierRoutes",
  "registerSupplierCrudRoutes",
  "registerSupplierPaymentRoutes"
);
splitRoute(
  "modules/returns/sales-returns.route.ts",
  [127, 270],
  [271, 418],
  "registerSalesReturnRoutes",
  "registerSalesReturnReadRoutes",
  "registerSalesReturnWriteRoutes"
);

// expeditor-returns.helpers
{
  const fp = path.join(src, "modules/reports/expeditor-returns.helpers.ts");
  const lines = backupOnce(fp);
  w(
    path.join(src, "modules/reports/expeditor-returns.helpers.filters.ts"),
    `${slice(lines, 1, 26)}
${slice(lines, 27, 213)}
`
  );
  w(
    path.join(src, "modules/reports/expeditor-returns.helpers.aggs.ts"),
    `${slice(lines, 1, 25)}
${slice(lines, 214, 409)}
`
  );
  w(fp, `export * from "./expeditor-returns.helpers.filters";
export * from "./expeditor-returns.helpers.aggs";
`);
}

// warehouse-correction
{
  const fp = path.join(src, "modules/stock/warehouse-correction.service.ts");
  const lines = backupOnce(fp);
  const hdr = slice(lines, 1, 10);
  w(path.join(src, "modules/stock/warehouse-correction.list.ts"), `${hdr}\n${slice(lines, 11, 236)}`);
  w(path.join(src, "modules/stock/warehouse-correction.create.ts"), `${hdr}\n${slice(lines, 238, 413)}`);
  w(fp, `export * from "./warehouse-correction.list";
export * from "./warehouse-correction.create";
`);
}

console.log("Phase 67 overflow splits done (ledger + create-batch separate).");
