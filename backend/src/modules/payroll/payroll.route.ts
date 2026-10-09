import type { FastifyInstance } from "fastify";
import { registerPayrollCatalogRoutes } from "./payroll.route.catalog";
import { registerPayrollFormulaRoutes } from "./payroll.route.formulas";
import { registerPayrollRecordRoutes } from "./payroll.route.records";
import { registerPayrollBonusRoutes } from "./payroll.route.bonus";
import { registerPayrollAdvanceRoutes } from "./payroll.route.advances";
import { registerPayrollCashierRoutes } from "./payroll.route.cashier";
import { registerPayrollHealthRoutes } from "./payroll.route.health";

export async function registerPayrollRoutes(app: FastifyInstance) {
  await registerPayrollCatalogRoutes(app);
  await registerPayrollFormulaRoutes(app);
  await registerPayrollRecordRoutes(app);
  await registerPayrollBonusRoutes(app);
  await registerPayrollAdvanceRoutes(app);
  await registerPayrollCashierRoutes(app);
  await registerPayrollHealthRoutes(app);
}
