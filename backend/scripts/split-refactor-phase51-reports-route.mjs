/**
 * reports.route.ts bo‘linishi (report-builder marshrutlari alohida, servisga tegmaydi).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const mod = path.join(path.dirname(fileURLToPath(import.meta.url)), "../src/modules/reports");
const backupPath = path.join(mod, "reports.route.backup.ts");
const srcPath = path.join(mod, "reports.route.ts");

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
  fs.copyFileSync(srcPath, backupPath);
}
const lines = read(backupPath);

// reports.route.shared.ts — qo‘lda saqlanadi (importlar minimal).

const guardsArg = "guards: ReturnType<typeof createReportRouteGuards>";

function wrapRegister(name, bodySlice, extraImports) {
  return `import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
${extraImports}
import { ensureTenantContext } from "../../lib/tenant-context";
import { createReportRouteGuards, parseReportQueryOr400, reportQueryRaw } from "./reports.route.shared";

export async function ${name}(app: FastifyInstance, ${guardsArg} = createReportRouteGuards()) {
  const { reportViewPreHandler, reportExportPreHandler, incomeViewPreHandler, incomeExportPreHandler } = guards;

${slice(lines, bodySlice[0], bodySlice[1])}
}
`;
}

w(
  path.join(mod, "reports.route.analytics.ts"),
  wrapRegister(
    "registerReportsAnalyticsRoutes",
    [143, 274],
    `import type { ReportsClientChurnQuery, ReportsDateRangeQuery, ReportsTopLimitQuery } from "../../contracts/reports.schemas";
import {
  reportsClientChurnQuerySchema,
  reportsDateRangeQuerySchema,
  reportsTopLimitQuerySchema
} from "../../contracts/reports.schemas";
import {
  getAbcAnalysis,
  getAgentKpi,
  getChannelStats,
  getClientAnalytics,
  getClientChurn,
  getOrderTrends,
  getProductSales,
  getSalesSummary,
  getStatusDistribution,
  getXyzAnalysis
} from "./reports.service";`
  )
);

w(
  path.join(mod, "reports.route.debts.ts"),
  wrapRegister(
    "registerReportsDebtsRoutes",
    [276, 337],
    `import type { ReportsReceivablesListQuery } from "../../contracts/reports.schemas";
import { reportsReceivablesListQuerySchema } from "../../contracts/reports.schemas";
import { exportOrderDebtsXlsx, listOrderDebtsReport } from "./order-debts-report.service";
import { exportClientReceivablesXlsx, getClientReceivables } from "./reports.service";`
  )
);

w(
  path.join(mod, "reports.route.financial.ts"),
  wrapRegister(
    "registerReportsFinancialRoutes",
    [339, 442],
    `import type { AgentOrdersFilters, IncomeReportQuery, ReportsCashFlowQuery } from "../../contracts/reports.schemas";
import {
  agentOrdersQuerySchema,
  incomeReportQuerySchema,
  reportsCashFlowQuerySchema
} from "../../contracts/reports.schemas";
import { sendApiError } from "../../lib/api-error";
import { getAccessUser } from "../auth/auth.prehandlers";
import { getAgentOrdersFilterOptions, getAgentOrdersReport } from "./agent-orders-report.service";
import { getCashFlowReport, resolveCashDeskIdForReport } from "./cash-flow-report.service";
import {
  exportIncomeReportXlsx,
  getIncomeReport,
  getIncomeReportFilterOptions
} from "./income-report.service";`
  )
);

w(
  path.join(mod, "reports.route.specialized.ts"),
  wrapRegister(
    "registerReportsSpecializedRoutes",
    [443, 751],
    `import type {
  ClientSales2Filters,
  ClientSales4Filters,
  ExpeditorReturnsFilters,
  ProductSalesReportFilters,
  Visits2Filters,
  VisitTotalsFilters
} from "../../contracts/reports.schemas";
import {
  clientSales2QuerySchema,
  clientSales4QuerySchema,
  expeditorReturnsQuerySchema,
  productSalesReportQuerySchema,
  visits2QuerySchema,
  visitTotalsQuerySchema
} from "../../contracts/reports.schemas";
import { sendApiError } from "../../lib/api-error";
import { actorUserIdOrNull } from "../../lib/request-actor";
import { getAccessUser } from "../auth/auth.prehandlers";
import {
  exportClientSales2Xlsx,
  getClientSales2FilterOptions,
  getClientSales2Report
} from "./client-sales-2-report.service";
import {
  exportClientSales4Xlsx,
  getClientSales4FilterOptions,
  getClientSales4Report
} from "./client-sales-4-report.service";
import {
  exportExpeditorReturnsXlsx,
  getExpeditorReturnsByClients,
  getExpeditorReturnsByProducts,
  getExpeditorReturnsFilterOptions,
  getExpeditorReturnsOrders
} from "./expeditor-returns-report.service";
import {
  exportProductSalesReportXlsx,
  getProductSalesReport,
  getProductSalesReportFilterOptions
} from "./product-sales-report.service";
import {
  exportVisitTotalsXlsx,
  getVisitTotalsFilterOptions,
  getVisitTotalsReport
} from "./visit-totals-report.service";
import {
  exportVisits2Xlsx,
  getVisits2FilterOptions,
  getVisits2Report
} from "./visits-2-report.service";`
  )
);

w(
  path.join(mod, "reports.route.builder.ts"),
  wrapRegister(
    "registerReportsBuilderRoutes",
    [752, 903],
    `import {
  type ReportBuilderConfigPayload,
  type ReportBuilderDatasetRequest,
  type ReportBuilderSavedConfigValidated,
  reportBuilderConfigBodySchema,
  reportBuilderDatasetBodySchema,
  reportBuilderExportBodySchema,
  reportBuilderSavedConfigBodySchema,
  reportBuilderSavedCreateBodySchema
} from "../../contracts/report-builder.schemas";
import { sendApiError } from "../../lib/api-error";
import { actorUserIdOrNull } from "../../lib/request-actor";
import {
  getReportBuilderFilterOptions,
  reportBuilderDataset,
  reportBuilderExportXlsx,
  reportBuilderMetadata,
  reportBuilderPreview,
  reportBuilderSaved
} from "../report-builder/report-builder.service";
import { getAccessUser } from "../auth/auth.prehandlers";
import { parseZodOr400, sendReportBuilderHttp } from "./reports.route.shared";`
  )
);

w(
  path.join(mod, "reports.route.ts"),
  `import type { FastifyInstance } from "fastify";
import { createReportRouteGuards } from "./reports.route.shared";
import { registerReportsAnalyticsRoutes } from "./reports.route.analytics";
import { registerReportsBuilderRoutes } from "./reports.route.builder";
import { registerReportsDebtsRoutes } from "./reports.route.debts";
import { registerReportsFinancialRoutes } from "./reports.route.financial";
import { registerReportsSpecializedRoutes } from "./reports.route.specialized";

export async function registerReportRoutes(app: FastifyInstance) {
  const guards = createReportRouteGuards();
  await registerReportsAnalyticsRoutes(app, guards);
  await registerReportsDebtsRoutes(app, guards);
  await registerReportsFinancialRoutes(app, guards);
  await registerReportsSpecializedRoutes(app, guards);
  await registerReportsBuilderRoutes(app, guards);
}
`
);

console.log("Phase 51 reports.route split done.");
