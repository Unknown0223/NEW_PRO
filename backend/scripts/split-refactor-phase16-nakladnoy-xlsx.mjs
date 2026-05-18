import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ord = path.join(path.dirname(fileURLToPath(import.meta.url)), "../src/modules/orders");
const lines = fs.readFileSync(path.join(ord, "order-nakladnoy-xlsx.backup.ts"), "utf8").split(/\r?\n/);
const slice = (a, b) => lines.slice(a - 1, b).join("\n");

fs.writeFileSync(path.join(ord, "order-nakladnoy-xlsx.types.ts"), `${slice(1, 57)}\n`);

let fmt = slice(59, 266);
for (const name of [
  "lineCodeDisplay",
  "fmtDate",
  "fmtDateTime",
  "fmtMoneyInt",
  "fmtMoney2",
  "blockCount",
  "sanitizeSheetName",
  "applyBorderRange",
  "mergeLoadingLines",
  "uniqJoin",
  "buildMergedLoadingPayload",
  "groupKeyForOrder",
  "sheetNameForGroup",
  "expandLoadingSheetPayloads",
  "expandConsignmentSheetGroups"
]) {
  fmt = fmt.replace(new RegExp(`^function ${name}\\b`, "m"), `export function ${name}`);
}
fmt = fmt
  .replace(/^const BORDER_THIN/gm, "export const BORDER_THIN")
  .replace(/^const FILL_GROUP/gm, "export const FILL_GROUP")
  .replace(/^const FILL_HEADER_GREY/gm, "export const FILL_HEADER_GREY");

fs.writeFileSync(
  path.join(ord, "order-nakladnoy-xlsx.format.ts"),
  `import ExcelJS from "exceljs";
import type {
  NakladnoyBuildOptions,
  NakladnoyCodeColumn,
  NakladnoyGroupBy,
  NakladnoyLine,
  NakladnoyOrderPayload
} from "./order-nakladnoy-xlsx.types";

${fmt}
`
);

fs.writeFileSync(
  path.join(ord, "order-nakladnoy-xlsx.loading.ts"),
  `import ExcelJS from "exceljs";
import type { NakladnoyBuildOptions, NakladnoyOrderPayload } from "./order-nakladnoy-xlsx.types";
import { expandLoadingSheetPayloads } from "./order-nakladnoy-xlsx.format";

${slice(269, 479)}
`
);

fs.writeFileSync(
  path.join(ord, "order-nakladnoy-xlsx.consignment.ts"),
  `import ExcelJS from "exceljs";
import type { NakladnoyBuildOptions, NakladnoyOrderPayload } from "./order-nakladnoy-xlsx.types";
import {
  applyBorderRange,
  expandConsignmentSheetGroups,
  fmtDate,
  fmtDateTime,
  fmtMoney2,
  fmtMoneyInt,
  lineCodeDisplay,
  sanitizeSheetName,
  sheetNameForGroup
} from "./order-nakladnoy-xlsx.format";

${slice(481, 729)}
`
);

fs.writeFileSync(
  path.join(ord, "order-nakladnoy-xlsx.ts"),
  `/** Nakladnoy Excel — barrel. */
export * from "./order-nakladnoy-xlsx.types";
export { buildLoadingSheetWorkbook } from "./order-nakladnoy-xlsx.loading";
export { buildConsignmentWorkbook } from "./order-nakladnoy-xlsx.consignment";

import type { NakladnoyBuildOptions, NakladnoyOrderPayload } from "./order-nakladnoy-xlsx.types";
import { DEFAULT_NAKLADNOY_BUILD_OPTIONS } from "./order-nakladnoy-xlsx.types";
import { buildConsignmentWorkbook } from "./order-nakladnoy-xlsx.consignment";
import { buildLoadingSheetWorkbook } from "./order-nakladnoy-xlsx.loading";

${slice(731, lines.length)}
`
);

console.log("phase16 nakladnoy-xlsx split done");
