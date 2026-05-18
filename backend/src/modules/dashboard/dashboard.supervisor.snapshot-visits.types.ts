import type { Prisma } from "@prisma/client";
import type { SupervisorVisitRow } from "./dashboard.supervisor.scope";

export type SupervisorVisitAndSalesBlocks = {
  salesAgg: Array<{ s: Prisma.Decimal }>;
  cashAgg: Array<{ s: Prisma.Decimal }>;
  paymentBreakdownRows: Array<{ method: string; s: Prisma.Decimal }>;
  mappedVisitRows: SupervisorVisitRow[];
  totals: Omit<SupervisorVisitRow, "agent_id" | "agent_name" | "supervisor_id" | "supervisor_name">;
};
