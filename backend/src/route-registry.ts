import type { FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import { registerAccessRoutes } from "./modules/access/access.route";
import { registerActivityRoutes } from "./modules/activity/activity.route";
import { registerAuditEventRoutes } from "./modules/audit-events/audit-events.route";
import { registerAuthRoutes } from "./modules/auth/auth.route";
import { registerBonusRuleRoutes } from "./modules/bonus-rules/bonus-rules.route";
import { registerCashDeskRoutes } from "./modules/cash-desks/cash-desks.route";
import { registerClientBalanceRoutes } from "./modules/client-balances/client-balances.route";
import { registerClientRoutes } from "./modules/clients/clients.route";
import { registerConsignmentRoutes } from "./modules/consignment/consignment.route";
import { registerCurrencyExchangeRateRoutes } from "./modules/currency-rates/currency-exchange-rates.route";
import { registerDashboardRoutes } from "./modules/dashboard/dashboard.route";
import { registerExpenseRoutes } from "./modules/expenses/expenses.route";
import { registerFieldRoutes } from "./modules/field/field.route";
import { registerGeoBoundaryRoutes } from "./modules/geo-boundaries/geo-boundaries.route";
import { registerJobRoutes } from "./modules/jobs/jobs.route";
import { registerLinkageRoutes } from "./modules/linkage/linkage.route";
import { registerMobileRoutes } from "./modules/mobile/mobile.route";
import { registerNotificationRoutes } from "./modules/notifications/notifications.route";
import { registerOpeningBalanceRoutes } from "./modules/opening-balances/opening-balances.route";
import { registerOrderAutomationRoutes } from "./modules/order-automation/order-automation.route";
import { registerOrderRoutes } from "./modules/orders/orders.route";
import { registerOrderStreamRoutes } from "./modules/orders/order-stream.route";
import { registerPaymentRoutes } from "./modules/payments/payments.route";
import { registerPlansRoutes } from "./modules/plans/plans.route";
import { registerProductCatalogRoutes } from "./modules/products/product-catalog.route";
import { registerProductPriceRoutes } from "./modules/products/product-prices.route";
import { registerProductRoutes } from "./modules/products/products.route";
import { registerPriceMatrixRoutes } from "./modules/products/price-matrix.route";
import { registerReferenceRoutes } from "./modules/reference/reference.route";
import { registerRefusalRoutes } from "./modules/refusals/refusals.route";
import { registerReportRoutes } from "./modules/reports/reports.route";
import { registerSalesDirectionRoutes } from "./modules/sales-directions/sales-directions.route";
import { registerSalesReturnRoutes } from "./modules/returns/sales-returns.route";
import { registerStaffRoutes } from "./modules/staff/staff.route";
import { registerStockRoutes } from "./modules/stock/stock.route";
import { registerRetailStockRoutes } from "./modules/stock/retail-stock.route";
import { registerWarehouseBlockRoutes } from "./modules/stock/warehouse-blocks.route";
import { registerSupplierRoutes } from "./modules/stock/suppliers.route";
import { registerGoodsReceiptRoutes } from "./modules/stock/goods-receipt.route";
import { registerStockTakeRoutes } from "./modules/stock/stock-takes.route";
import { registerWarehouseTransferRoutes } from "./modules/stock/warehouse-transfers.route";
import { registerSystemMigrationRoutes } from "./modules/system-migration/system-migration.route";
import { registerTenantSettingsRoutes } from "./modules/tenant-settings/tenant-settings.route";
import { registerDocumentEditLockRoutes } from "./modules/document-edit-lock/document-edit-lock.route";
import { registerTerritoryRoutes } from "./modules/territory/territory.route";
import { registerTimesheetRoutes } from "./modules/timesheet/timesheet.route";
import { registerUserUiRoutes } from "./modules/users/user-ui.route";
import { registerWorkSlotRoutes } from "./modules/work-slots/work-slots.route";

type RouteRegistrar = (app: FastifyInstance) => void | Promise<void>;

/** Barcha API route register funksiyalari — tartib `app.ts` dagi avvalgi tartib bilan mos. */
export const routeRegistrars: RouteRegistrar[] = [
  registerAuthRoutes,
  registerAccessRoutes,
  registerUserUiRoutes,
  registerClientRoutes,
  registerProductPriceRoutes,
  registerProductCatalogRoutes,
  registerProductRoutes,
  registerStaffRoutes,
  registerConsignmentRoutes,
  registerSalesDirectionRoutes,
  registerBonusRuleRoutes,
  registerOrderAutomationRoutes,
  registerOrderRoutes,
  registerOrderStreamRoutes,
  registerDashboardRoutes,
  registerPaymentRoutes,
  registerOpeningBalanceRoutes,
  registerClientBalanceRoutes,
  registerSalesReturnRoutes,
  registerReferenceRoutes,
  registerTenantSettingsRoutes,
  registerDocumentEditLockRoutes,
  registerAuditEventRoutes,
  registerActivityRoutes,
  registerStockRoutes,
  registerRetailStockRoutes,
  registerWarehouseBlockRoutes,
  registerSupplierRoutes,
  registerGoodsReceiptRoutes,
  registerCashDeskRoutes,
  registerCurrencyExchangeRateRoutes,
  fp(
    async (app) => {
      await registerReportRoutes(app);
    },
    { name: "register-report-routes", fastify: "4.x" }
  ),
  registerStockTakeRoutes,
  registerWarehouseTransferRoutes,
  registerExpenseRoutes,
  registerTerritoryRoutes,
  registerGeoBoundaryRoutes,
  registerPriceMatrixRoutes,
  registerFieldRoutes,
  registerRefusalRoutes,
  registerNotificationRoutes,
  registerMobileRoutes,
  registerLinkageRoutes,
  registerJobRoutes,
  registerTimesheetRoutes,
  registerWorkSlotRoutes,
  registerPlansRoutes,
  registerSystemMigrationRoutes
];

/** Plugin + route registry orqali barcha marshrutlarni ro'yxatdan o'tkazadi. */
export function registerAllRoutes(app: FastifyInstance): void {
  for (const register of routeRegistrars) {
    app.register(register);
  }
}
