/**
 * v4 — income-report + opening-balances bo‘linishi.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));

function read(p) {
  return fs.readFileSync(p, "utf8").split(/\r?\n/);
}
function slice(lines, a, b) {
  return lines.slice(a - 1, b).join("\n");
}
function w(p, c) {
  const full = path.join(root, "..", p);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, c.endsWith("\n") ? c : `${c}\n`);
}
function backupIfNeeded(mainRel, backupRel) {
  const main = path.join(root, "..", mainRel);
  const backup = path.join(root, "..", backupRel);
  if (!fs.existsSync(backup)) fs.copyFileSync(main, backup);
  return read(backupRel);
}

// income-report
{
  const mod = "src/modules/reports";
  const lines = backupIfNeeded(`${mod}/income-report.service.ts`, `${mod}/income-report.service.backup.ts`);

  w(
    `${mod}/income-report.types.ts`,
    `import type { Prisma } from "@prisma/client";

${slice(lines, 13, 50)}
`
  );

  w(
    `${mod}/income-report.query.ts`,
    `import type { IncomeReportQuery } from "./income-report.types";
import { parseDate } from "./income-report.types";

${slice(lines, 53, 84)}
`
  );

  w(
    `${mod}/income-report.fetch.ts`,
    `import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import type { AccessCtx, IncomeReportQuery, IncomeRow } from "./income-report.types";

${slice(lines, 86, 166)}
`
  );

  w(
    `${mod}/income-report.report.ts`,
    `import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import {
  paymentMethodStorageKey,
  resolveCurrencyEntries,
  resolvePaymentMethodEntries,
  resolvePaymentMethodRefToLabel
} from "../tenant-settings/finance-refs";
import type { AccessCtx, IncomeReportQuery } from "./income-report.types";
import { KNOWN_SUMMARY_KEYS } from "./income-report.types";
import { asNum, fetchIncomeRows } from "./income-report.fetch";

${slice(lines, 168, 268)}
`
  );

  w(
    `${mod}/income-report.filters.ts`,
    `import { prisma } from "../../config/database";
import { mergeTerritoryFilterOptions } from "./territory-nodes";

${slice(lines, 270, 330)}
`
  );

  w(
    `${mod}/income-report.xlsx.ts`,
    `import * as XLSX from "xlsx";
import type { AccessCtx, IncomeReportQuery } from "./income-report.types";
import { getIncomeReport } from "./income-report.report";

${slice(lines, 332, 376)}
`
  );

  w(
    `${mod}/income-report.service.ts`,
    `export { parseIncomeReportQuery } from "./income-report.query";
export { getIncomeReport } from "./income-report.report";
export { getIncomeReportFilterOptions } from "./income-report.filters";
export { exportIncomeReportXlsx } from "./income-report.xlsx";
`
  );
}

// opening-balances
{
  const mod = "src/modules/opening-balances";
  const lines = backupIfNeeded(`${mod}/opening-balances.service.ts`, `${mod}/opening-balances.service.backup.ts`);

  const hdr = `import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
`;

  w(
    `${mod}/opening-balances.types.ts`,
    `${slice(lines, 6, 57)}

${slice(lines, 190, 199)}
`
  );

  w(
    `${mod}/opening-balances.shared.ts`,
    `${hdr}import type { OpeningBalanceListQuery, OpeningBalanceListRow } from "./opening-balances.types";

${slice(lines, 59, 165)}
`
  );

  w(
    `${mod}/opening-balances.list.ts`,
    `${hdr}import type { OpeningBalanceListQuery, OpeningBalanceListRow } from "./opening-balances.types";
import { buildWhere, listInclude, mapRow } from "./opening-balances.shared";

${slice(lines, 167, 188)}
`
  );

  w(
    `${mod}/opening-balances.write.ts`,
    `${hdr}
import { appendClientAuditLog } from "../clients/clients.service";
import { invalidateDashboard } from "../../lib/redis-cache";
import type { CreateOpeningBalanceInput, OpeningBalanceListRow } from "./opening-balances.types";
import { listInclude, mapRow } from "./opening-balances.shared";

${slice(lines, 201, 393)}
`
  );

  w(
    `${mod}/opening-balances.service.ts`,
    `export type {
  OpeningBalanceListQuery,
  OpeningBalanceListRow,
  CreateOpeningBalanceInput
} from "./opening-balances.types";
export { listOpeningBalances } from "./opening-balances.list";
export { createOpeningBalance, deleteOpeningBalance, restoreOpeningBalance } from "./opening-balances.write";
`
  );
}

console.log("phase68 done");
