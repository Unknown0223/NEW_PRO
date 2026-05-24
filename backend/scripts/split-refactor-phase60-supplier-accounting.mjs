/**
 * supplier-accounting.service bo‘linishi.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const stock = path.join(path.dirname(fileURLToPath(import.meta.url)), "../src/modules/stock");
const backupPath = path.join(stock, "supplier-accounting.service.backup.ts");
const srcPath = path.join(stock, "supplier-accounting.service.ts");

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

const hdr = slice(lines, 1, 5);

w(
  path.join(stock, "supplier-accounting.types.ts"),
  `${hdr}
${slice(lines, 80, 104)}
`
);

w(
  path.join(stock, "supplier-accounting.shared.ts"),
  `${hdr}
import type { ListSupplierPaymentsOpts, SupplierPaymentSortKey } from "./supplier-accounting.types";

${slice(lines, 6, 8)}

${exportFns(slice(lines, 106, 168))}
`
);

w(
  path.join(stock, "supplier-accounting.balances.ts"),
  `${hdr}
import { decimalStr } from "./supplier-accounting.shared";

${slice(lines, 10, 78)}
`
);

w(
  path.join(stock, "supplier-accounting.payments.ts"),
  `${hdr}
import type { ListSupplierPaymentsOpts } from "./supplier-accounting.types";
import { getCashDeskAvailableCash } from "./supplier-payment-cash.service";
import {
  buildSupplierPaymentOrderBy,
  buildSupplierPaymentWhere,
  decimalStr
} from "./supplier-accounting.shared";

${slice(lines, 170, 312)}
`
);

w(
  path.join(stock, "supplier-accounting.reconciliation.ts"),
  `${hdr}
import { decimalStr } from "./supplier-accounting.shared";

${slice(lines, 314, 525)}
`
);

w(
  path.join(stock, "supplier-accounting.service.ts"),
  `export * from "./supplier-accounting.types";
export * from "./supplier-accounting.shared";
export * from "./supplier-accounting.balances";
export * from "./supplier-accounting.payments";
export * from "./supplier-accounting.reconciliation";
`
);

console.log("Phase 60 supplier-accounting split done.");
