/**
 * cash-flow-report.service bo‘linishi.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const mod = path.join(path.dirname(fileURLToPath(import.meta.url)), "../src/modules/reports");
const backupPath = path.join(mod, "cash-flow-report.service.backup.ts");
const srcPath = path.join(mod, "cash-flow-report.service.ts");

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
  return body
    .replace(/^function /gm, "export function ")
    .replace(/^async function /gm, "export async function ")
    .replace(/^type /gm, "export type ")
    .replace(/^const ZERO/gm, "export const ZERO");
}

if (!fs.existsSync(backupPath)) {
  fs.copyFileSync(srcPath, backupPath);
}
const lines = read(backupPath);

const hdr = `import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import type { PaymentMethodEntryDto } from "../tenant-settings/finance-refs";
import {
  paymentMethodStorageKey,
  resolveCurrencyEntries,
  resolvePaymentMethodEntries
} from "../tenant-settings/finance-refs";
`;

w(
  path.join(mod, "cash-flow.types.ts"),
  `import { Prisma } from "@prisma/client";
import type { PaymentMethodEntryDto } from "../tenant-settings/finance-refs";

${slice(lines, 17, 67)}

${slice(lines, 108, 110)}

${slice(lines, 200, 200)}
`.replace(/^type Split/m, "export type Split").replace(/^const ZERO/m, "export const ZERO").replace(/^type AggRow/m, "export type AggRow")
);

w(
  path.join(mod, "cash-flow.resolve.ts"),
  `${hdr}import type { CashFlowReportPayload } from "./cash-flow.types";

${slice(lines, 70, 106)}
`
);

w(
  path.join(mod, "cash-flow.helpers.ts"),
  `${hdr}import type { CashFlowMoney, CashFlowTableChild } from "./cash-flow.types";
import type { Split } from "./cash-flow.types";
import { ZERO } from "./cash-flow.types";

${exportFns(slice(lines, 112, 313))}
`
);

w(
  path.join(mod, "cash-flow.report.ts"),
  `${hdr}import type { CashFlowReportPayload, CashFlowTableChild, CashFlowTableRow, Split } from "./cash-flow.types";
import {
  add,
  aggregateExpensesApproved,
  aggregatePaymentsDesk,
  decStr,
  foldOpeningOnly,
  foldPeriodIncomeExpense,
  parseDayEndUtc,
  parseDayStartUtc,
  splitTotal,
  sub
} from "./cash-flow.helpers";
import { resolveCashDeskIdForReport } from "./cash-flow.resolve";

${slice(lines, 314, 503)}
`
);

w(
  path.join(mod, "cash-flow-report.service.ts"),
  `export * from "./cash-flow.types";
export * from "./cash-flow.helpers";
export * from "./cash-flow.resolve";
export * from "./cash-flow.report";
`
);

console.log("Phase 49 cash-flow split done.");
