/**
 * v4 — expenses.service bo‘linishi.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const mod = path.join(root, "../src/modules/expenses");
const mainPath = path.join(mod, "expenses.service.ts");
const backupPath = path.join(mod, "expenses.service.backup.ts");

function read(p) {
  return fs.readFileSync(p, "utf8").split(/\r?\n/);
}
function slice(lines, a, b) {
  return lines.slice(a - 1, b).join("\n");
}
function w(p, c) {
  fs.writeFileSync(p, c.endsWith("\n") ? c : `${c}\n`);
}

const lines = read(mainPath);
if (!fs.existsSync(backupPath)) {
  fs.copyFileSync(mainPath, backupPath);
}

const hdrAudit = `import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { appendTenantAuditEvent, AuditEntityType } from "../../lib/tenant-audit";
`;

w(path.join(mod, "expenses.types.ts"), slice(lines, 7, 71));

let sharedBody = slice(lines, 75, 157);
sharedBody = sharedBody
  .replace(/^async function assertTenantAccess/m, "export async function assertTenantAccess")
  .replace(/^async function resolveNames/m, "export async function resolveNames")
  .replace(/^function enrichExpense/m, "export function enrichExpense");

w(
  path.join(mod, "expenses.shared.ts"),
  `import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import type { ExpenseListRow } from "./expenses.types";

${sharedBody}
`
);

function audited(name, range) {
  w(
    path.join(mod, name),
    `${hdrAudit}import type { ExpenseListRow${name.includes("crud") ? ", CreateExpenseInput" : name.includes("list") ? ", ExpenseListQuery" : name.includes("summary") ? ", ExpenseSummaryByAgent, ExpenseSummaryByType" : name.includes("pnl") ? ", PnlReport" : ""} } from "./expenses.types";
import { assertTenantAccess, enrichExpense, resolveNames } from "./expenses.shared";

${slice(lines, range[0], range[1])}
`
  );
}

w(
  path.join(mod, "expenses.list.ts"),
  `${hdrAudit}import type { ExpenseListQuery, ExpenseListRow } from "./expenses.types";
import { assertTenantAccess, enrichExpense, resolveNames } from "./expenses.shared";

${slice(lines, 161, 204)}
`
);

w(
  path.join(mod, "expenses.crud.ts"),
  `${hdrAudit}import type { CreateExpenseInput, ExpenseListRow } from "./expenses.types";
import { assertTenantAccess, enrichExpense, resolveNames } from "./expenses.shared";

${slice(lines, 208, 335)}
`
);

w(
  path.join(mod, "expenses.lifecycle.ts"),
  `${hdrAudit}import type { ExpenseListRow } from "./expenses.types";
import { assertTenantAccess, enrichExpense, resolveNames } from "./expenses.shared";

${slice(lines, 339, 501)}
`
);

w(
  path.join(mod, "expenses.read.ts"),
  `${hdrAudit}import type { ExpenseListRow } from "./expenses.types";
import { assertTenantAccess, enrichExpense, resolveNames } from "./expenses.shared";

${slice(lines, 505, 525)}
`
);

w(
  path.join(mod, "expenses.summary.ts"),
  `${hdrAudit}import type { ExpenseSummaryByAgent, ExpenseSummaryByType } from "./expenses.types";
import { assertTenantAccess } from "./expenses.shared";

${slice(lines, 529, 608)}
`
);

w(
  path.join(mod, "expenses.pnl.ts"),
  `${hdrAudit}import type { PnlReport } from "./expenses.types";
import { assertTenantAccess } from "./expenses.shared";

${slice(lines, 612, 663)}
`
);

w(
  path.join(mod, "expenses.service.ts"),
  `/**
 * Domain: tenant expenses (draft / approve / P&L).
 */
export * from "./expenses.types";
export * from "./expenses.shared";
export * from "./expenses.list";
export * from "./expenses.crud";
export * from "./expenses.lifecycle";
export * from "./expenses.read";
export * from "./expenses.summary";
export * from "./expenses.pnl";
`
);

console.log("Phase 36 expenses split done.");
