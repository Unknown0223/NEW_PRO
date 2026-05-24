/**
 * v4 — stock.receipt-report + stock.material-report bo‘linishi.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));

function read(p) {
  return fs.readFileSync(path.join(root, "..", p), "utf8").split(/\r?\n/);
}
function slice(lines, a, b) {
  return lines.slice(a - 1, b).join("\n");
}
function w(p, c) {
  const full = path.join(root, "..", p);
  fs.writeFileSync(full, c.endsWith("\n") ? c : `${c}\n`);
}
function backupIfNeeded(mainRel, backupRel) {
  const main = path.join(root, "..", mainRel);
  const backup = path.join(root, "..", backupRel);
  if (!fs.existsSync(backup)) fs.copyFileSync(main, backup);
  return read(backupRel);
}

// receipt-report
{
  const mod = "src/modules/stock";
  const lines = backupIfNeeded(`${mod}/stock.receipt-report.ts`, `${mod}/stock.receipt-report.backup.ts`);

  w(
    `${mod}/stock.receipt-report.shared.ts`,
    `import { parseYmdToDateEnd, parseYmdToDateStart } from "./stock.shared";

${slice(lines, 25, 27).replace(/^function /, "export function ")}
`
  );

  const listHdr = `import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { fmt, toNum } from "./stock.shared";
import type { StockReceiptReportOpts, StockReceiptReportRow } from "./stock.receipt-report.types";
import { parseReceiptRange } from "./stock.receipt-report.shared";
`;

  w(`${mod}/stock.receipt-report.list.ts`, `${listHdr}\n${slice(lines, 29, 143)}\n`);

  const dailyHdr = `import { prisma } from "../../config/database";
import { fmt, toNum } from "./stock.shared";
import type { StockReceiptDailyOpts, StockReceiptDailyRow } from "./stock.receipt-report.types";
import { parseReceiptRange } from "./stock.receipt-report.shared";
`;

  w(`${mod}/stock.receipt-report.daily.ts`, `${dailyHdr}\n${slice(lines, 145, 220)}\n`);

  const timelineHdr = `import { prisma } from "../../config/database";
import { fmt, toNum } from "./stock.shared";
import type {
  StockReceiptTimelineColumn,
  StockReceiptTimelineOpts,
  StockReceiptTimelineRow
} from "./stock.receipt-report.types";
import { parseReceiptRange } from "./stock.receipt-report.shared";
`;

  w(`${mod}/stock.receipt-report.timeline.ts`, `${timelineHdr}\n${slice(lines, 222, 359)}\n`);

  const exportHdr = `import ExcelJS from "exceljs";
import type { StockReceiptReportOpts } from "./stock.receipt-report.types";
import { listStockReceiptReport } from "./stock.receipt-report.list";
`;

  w(`${mod}/stock.receipt-report.export.ts`, `${exportHdr}\n${slice(lines, 361, 398)}\n`);

  w(
    `${mod}/stock.receipt-report.ts`,
    `export type {
  StockReceiptDailyRow,
  StockReceiptReportRow,
  StockReceiptTimelineColumn,
  StockReceiptTimelineRow
} from "./stock.receipt-report.types";
export { listStockReceiptReport } from "./stock.receipt-report.list";
export { listStockReceiptReportDaily } from "./stock.receipt-report.daily";
export { listStockReceiptTimelineReport } from "./stock.receipt-report.timeline";
export { buildStockReceiptReportExportBuffer } from "./stock.receipt-report.export";
`
  );
}

// material-report
{
  const mod = "src/modules/stock";
  const lines = backupIfNeeded(`${mod}/stock.material-report.ts`, `${mod}/stock.material-report.backup.ts`);

  const listHdr = `import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { fixed, ymdEnd, ymdStart } from "./stock.shared";
import type { MaterialReportOpts, MaterialReportRow } from "./stock.material-report.types";
`;

  w(`${mod}/stock.material-report.list.ts`, `${listHdr}\n${slice(lines, 12, 268)}\n`);

  const exportHdr = `import XLSX from "xlsx";
import { fixed } from "./stock.shared";
import type { MaterialReportExportOpts } from "./stock.material-report.types";
import { listMaterialReport } from "./stock.material-report.list";
`;

  w(`${mod}/stock.material-report.export.ts`, `${exportHdr}\n${slice(lines, 270, 392)}\n`);

  w(
    `${mod}/stock.material-report.ts`,
    `export type { MaterialReportRow } from "./stock.material-report.types";
export { listMaterialReport } from "./stock.material-report.list";
export { buildMaterialReportExportBuffer } from "./stock.material-report.export";
`
  );
}

console.log("phase69 done");
