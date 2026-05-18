import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "../src/modules/dashboard");
const lines = fs.readFileSync(path.join(dir, "dashboard.supervisor.snapshot-visits.ts"), "utf8").split(/\r?\n/);

const header = `import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import type { SupervisorDashboardFilters } from "./dashboard.supervisor.scope";
`;

const mapHeader = `import { Prisma } from "@prisma/client";
import { bigToNum, clampPct, decToString } from "./dashboard.helpers";
import type {
  SupervisorVisitOutsideDetail,
  SupervisorVisitPlanDetail,
  SupervisorVisitRow
} from "./dashboard.supervisor.scope";
import type { SupervisorVisitRawRow } from "./dashboard.supervisor.snapshot-visits.query";
`;

const queryBody = lines.slice(27, 327).join("\n");
const mapBody = lines.slice(328, 449).join("\n");

fs.writeFileSync(
  path.join(dir, "dashboard.supervisor.snapshot-visits.query.ts"),
  `${header}
export type SupervisorVisitRawRow = {
  agent_id: number;
  agent_name: string;
  agent_code: string | null;
  supervisor_id: number | null;
  supervisor_name: string | null;
  planned_visits: bigint;
  visited_planned: bigint;
  visited_total: bigint;
  gps_visits: bigint;
  photo_reports: bigint;
  visits_with_orders: bigint;
  sales_sum: Prisma.Decimal;
  sales_qty: Prisma.Decimal;
  cancelled_count: bigint;
  plan_vis_ord_sum: Prisma.Decimal;
  plan_vis_ord_qty: Prisma.Decimal;
  plan_vis_no_order: bigint;
  plan_novis_ord_sum: Prisma.Decimal;
  plan_novis_ord_qty: Prisma.Decimal;
  plan_photo: bigint;
  out_vis_ord_sum: Prisma.Decimal;
  out_vis_ord_qty: Prisma.Decimal;
  out_vis_no_order: bigint;
  out_novis_ord_sum: Prisma.Decimal;
  out_novis_ord_qty: Prisma.Decimal;
  out_photo: bigint;
};

export type SupervisorVisitQueryResult = {
  salesAgg: Array<{ s: Prisma.Decimal }>;
  cashAgg: Array<{ s: Prisma.Decimal }>;
  paymentBreakdownRows: Array<{ method: string; s: Prisma.Decimal }>;
  visitRows: SupervisorVisitRawRow[];
};

export async function fetchSupervisorVisitAndSalesRaw(
  tenantId: number,
  dayStart: Date,
  dayEnd: Date,
  filters: SupervisorDashboardFilters,
  orderScope: Prisma.Sql,
  visitScope: Prisma.Sql,
  planScope: Prisma.Sql
): Promise<SupervisorVisitQueryResult> {
${queryBody.replace(/^  const \[\[salesAgg/, "  const [[salesAgg").replace(/visitRows\]/, "visitRows]:")}
  return { salesAgg, cashAgg, paymentBreakdownRows, visitRows };
}
`
);

// Fix query file - the replace might be wrong. Let me build query file manually from slice
const querySlice = lines.slice(27, 327).join("\n");
fs.writeFileSync(
  path.join(dir, "dashboard.supervisor.snapshot-visits.query.ts"),
  `${header}
export type SupervisorVisitRawRow = {
  agent_id: number;
  agent_name: string;
  agent_code: string | null;
  supervisor_id: number | null;
  supervisor_name: string | null;
  planned_visits: bigint;
  visited_planned: bigint;
  visited_total: bigint;
  gps_visits: bigint;
  photo_reports: bigint;
  visits_with_orders: bigint;
  sales_sum: Prisma.Decimal;
  sales_qty: Prisma.Decimal;
  cancelled_count: bigint;
  plan_vis_ord_sum: Prisma.Decimal;
  plan_vis_ord_qty: Prisma.Decimal;
  plan_vis_no_order: bigint;
  plan_novis_ord_sum: Prisma.Decimal;
  plan_novis_ord_qty: Prisma.Decimal;
  plan_photo: bigint;
  out_vis_ord_sum: Prisma.Decimal;
  out_vis_ord_qty: Prisma.Decimal;
  out_vis_no_order: bigint;
  out_novis_ord_sum: Prisma.Decimal;
  out_novis_ord_qty: Prisma.Decimal;
  out_photo: bigint;
};

export type SupervisorVisitQueryResult = {
  salesAgg: Array<{ s: Prisma.Decimal }>;
  cashAgg: Array<{ s: Prisma.Decimal }>;
  paymentBreakdownRows: Array<{ method: string; s: Prisma.Decimal }>;
  visitRows: SupervisorVisitRawRow[];
};

export async function fetchSupervisorVisitAndSalesRaw(
  tenantId: number,
  dayStart: Date,
  dayEnd: Date,
  filters: SupervisorDashboardFilters,
  orderScope: Prisma.Sql,
  visitScope: Prisma.Sql,
  planScope: Prisma.Sql
): Promise<SupervisorVisitQueryResult> {
${querySlice}
  return { salesAgg, cashAgg, paymentBreakdownRows, visitRows };
}
`
);

fs.writeFileSync(
  path.join(dir, "dashboard.supervisor.snapshot-visits.map.ts"),
  `${mapHeader}
export function mapSupervisorVisitRows(visitRows: SupervisorVisitRawRow[]): {
  mappedVisitRows: SupervisorVisitRow[];
  totals: Omit<SupervisorVisitRow, "agent_id" | "agent_name" | "supervisor_id" | "supervisor_name">;
} {
${mapBody}
  return { mappedVisitRows, totals };
}
`
);

fs.writeFileSync(
  path.join(dir, "dashboard.supervisor.snapshot-visits.ts"),
  `import type { Prisma } from "@prisma/client";
import type { SupervisorDashboardFilters } from "./dashboard.supervisor.scope";
import type { SupervisorVisitAndSalesBlocks } from "./dashboard.supervisor.snapshot-visits.types";
import { fetchSupervisorVisitAndSalesRaw } from "./dashboard.supervisor.snapshot-visits.query";
import { mapSupervisorVisitRows } from "./dashboard.supervisor.snapshot-visits.map";

export type { SupervisorVisitAndSalesBlocks } from "./dashboard.supervisor.snapshot-visits.types";

export async function loadSupervisorVisitAndSalesBlocks(
  tenantId: number,
  dayStart: Date,
  dayEnd: Date,
  filters: SupervisorDashboardFilters,
  orderScope: Prisma.Sql,
  visitScope: Prisma.Sql,
  planScope: Prisma.Sql
): Promise<SupervisorVisitAndSalesBlocks> {
  const { salesAgg, cashAgg, paymentBreakdownRows, visitRows } = await fetchSupervisorVisitAndSalesRaw(
    tenantId,
    dayStart,
    dayEnd,
    filters,
    orderScope,
    visitScope,
    planScope
  );
  const { mappedVisitRows, totals } = mapSupervisorVisitRows(visitRows);
  return { salesAgg, cashAgg, paymentBreakdownRows, mappedVisitRows, totals };
}
`
);

fs.writeFileSync(
  path.join(dir, "dashboard.supervisor.snapshot-visits.types.ts"),
  `import type { Prisma } from "@prisma/client";
import type { SupervisorVisitRow } from "./dashboard.supervisor.scope";

export type SupervisorVisitAndSalesBlocks = {
  salesAgg: Array<{ s: Prisma.Decimal }>;
  cashAgg: Array<{ s: Prisma.Decimal }>;
  paymentBreakdownRows: Array<{ method: string; s: Prisma.Decimal }>;
  mappedVisitRows: SupervisorVisitRow[];
  totals: Omit<SupervisorVisitRow, "agent_id" | "agent_name" | "supervisor_id" | "supervisor_name">;
};
`
);

console.log("ok");
