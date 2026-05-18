import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "../src/modules/dashboard");
const backup = fs.readFileSync(path.join(dir, "dashboard.service.backup.ts"), "utf8").split(/\r?\n/);
const body = backup.slice(555, 977).join("\n");

const header = `import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { bigToNum, clampPct, decToString } from "./dashboard.helpers";
import type {
  SupervisorVisitOutsideDetail,
  SupervisorVisitPlanDetail,
  SupervisorVisitRow
} from "./dashboard.supervisor.scope";

export type SupervisorVisitAndSalesBlocks = {
  salesAgg: Array<{ s: Prisma.Decimal }>;
  cashAgg: Array<{ s: Prisma.Decimal }>;
  paymentBreakdownRows: Array<{ method: string; s: Prisma.Decimal }>;
  mappedVisitRows: SupervisorVisitRow[];
  totals: Omit<SupervisorVisitRow, "agent_id" | "agent_name" | "supervisor_id" | "supervisor_name">;
};

export async function loadSupervisorVisitAndSalesBlocks(
  orderScope: Prisma.Sql,
  visitScope: Prisma.Sql,
  planScope: Prisma.Sql
): Promise<SupervisorVisitAndSalesBlocks> {
`;

fs.writeFileSync(
  path.join(dir, "dashboard.supervisor.snapshot-visits.ts"),
  `${header}${body}\n  return { salesAgg, cashAgg, paymentBreakdownRows, mappedVisitRows, totals };\n}\n`
);
console.log("ok");
