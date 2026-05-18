/**
 * goods-receipt.service bo‘linishi.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const stock = path.join(path.dirname(fileURLToPath(import.meta.url)), "../src/modules/stock");
const backupPath = path.join(stock, "goods-receipt.service.backup.ts");
const srcPath = path.join(stock, "goods-receipt.service.ts");

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

const hdr = slice(lines, 1, 5);

w(
  path.join(stock, "goods-receipt.types.ts"),
  `${slice(lines, 6, 27)}

${slice(lines, 116, 132).replace(/^type UpsertGoodsReceiptInput /m, "export type UpsertGoodsReceiptInput ")}
`
);

w(
  path.join(stock, "goods-receipt.list.ts"),
  `${slice(lines, 1, 5)}
import type { GoodsReceiptListRow } from "./goods-receipt.types";

${slice(lines, 29, 114)}
`
);

w(
  path.join(stock, "goods-receipt.create.ts"),
  `${hdr}
import type { UpsertGoodsReceiptInput } from "./goods-receipt.types";

${slice(lines, 134, 276)}
`
);

w(
  path.join(stock, "goods-receipt.update.ts"),
  `${hdr}
import type { UpsertGoodsReceiptInput } from "./goods-receipt.types";

${slice(lines, 277, 417)}
`
);

w(
  path.join(stock, "goods-receipt.lifecycle.ts"),
  `${hdr}
${slice(lines, 419, 582)}
`
);

w(
  path.join(stock, "goods-receipt.service.ts"),
  `export * from "./goods-receipt.types";
export * from "./goods-receipt.list";
export * from "./goods-receipt.create";
export * from "./goods-receipt.update";
export * from "./goods-receipt.lifecycle";
`
);

console.log("Phase 58 goods-receipt split done.");
