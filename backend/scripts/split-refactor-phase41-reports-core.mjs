/**
 * v4 — reports.service (core dashboard reports) bo‘linishi.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const mod = path.join(root, "../src/modules/reports");
const mainPath = path.join(mod, "reports.service.ts");
const backupPath = path.join(mod, "reports.service.backup.ts");

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
  fs.copyFileSync(mainPath, backupPath);
}
const lines = read(backupPath);

const hdr = `import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { ORDER_STATUSES_OUTSTANDING_RECEIVABLE } from "../orders/order-status";
`;

const hdrXlsx = `import { Prisma } from "@prisma/client";
import * as XLSX from "xlsx";
import { prisma } from "../../config/database";
import { ORDER_STATUSES_OUTSTANDING_RECEIVABLE } from "../orders/order-status";
`;

w(
  path.join(mod, "reports.shared.ts"),
  `${slice(lines, 1, 5)}
${hdr}
${slice(lines, 13, 25)}`.replace(/^function parseDateRange/m, "export function parseDateRange")
);

w(
  path.join(mod, "reports.sales.ts"),
  `${hdr}
import { parseDateRange } from "./reports.shared";

${slice(lines, 27, 145)}
`
);

w(
  path.join(mod, "reports.product-sales.ts"),
  `${hdr}
import { parseDateRange } from "./reports.shared";

${slice(lines, 147, 211)}
`
);

w(
  path.join(mod, "reports.client-analytics.ts"),
  `${hdr}
import { parseDateRange } from "./reports.shared";

${slice(lines, 213, 283)}
`
);

w(
  path.join(mod, "reports.agent-kpi.ts"),
  `${hdr}
import { parseDateRange } from "./reports.shared";

${slice(lines, 285, 426)}
`
);

w(
  path.join(mod, "reports.analysis.ts"),
  `${hdr}
import { parseDateRange } from "./reports.shared";

${slice(lines, 427, 595)}
`
);

w(
  path.join(mod, "reports.client-churn.ts"),
  `${hdr}
import { parseDateRange } from "./reports.shared";

${slice(lines, 596, 680)}
`
);

w(
  path.join(mod, "reports.client-receivables.ts"),
  `${hdr}
import { parseDateRange } from "./reports.shared";

${slice(lines, 682, 857)}
`
);

w(
  path.join(mod, "reports.client-receivables-export.ts"),
  `${hdrXlsx}
import { getClientReceivables } from "./reports.client-receivables";

${slice(lines, 858, 919)}
`
);

w(
  path.join(mod, "reports.service.ts"),
  `/**
 * Domain: Reports (sotuv, qarz, analytics).
 */
export * from "./reports.shared";
export * from "./reports.sales";
export * from "./reports.product-sales";
export * from "./reports.client-analytics";
export * from "./reports.agent-kpi";
export * from "./reports.analysis";
export * from "./reports.client-churn";
export * from "./reports.client-receivables";
export * from "./reports.client-receivables-export";
`
);

console.log("Phase 41 reports.service split done.");
