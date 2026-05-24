import { z } from "zod";
import { parseAgentOrdersQuery } from "../modules/reports/agent-orders-report.service";
import type { AgentOrdersFilters } from "../modules/reports/agent-orders-report.service";
import { parseClientSales2Query } from "../modules/reports/client-sales-2-report.service";
import type { ClientSales2Filters } from "../modules/reports/client-sales-2-report.service";
import { parseClientSales4Query } from "../modules/reports/client-sales-4-report.service";
import type { ClientSales4Filters } from "../modules/reports/client-sales-4-report.service";
import { parseIncomeReportQuery } from "../modules/reports/income-report.service";
import { parseExpeditorReturnsQuery } from "../modules/reports/expeditor-returns-report.service";
import type { ExpeditorReturnsFilters } from "../modules/reports/expeditor-returns-report.service";
import { parseOrderDebtsListQuery } from "../modules/reports/order-debts-report.service";
import type { OrderDebtsListQuery } from "../modules/reports/order-debts-report.service";
import { parseProductSalesReportQuery } from "../modules/reports/product-sales-report.service";
import type { ProductSalesReportFilters } from "../modules/reports/product-sales-report.service";
import { parseVisits2Query } from "../modules/reports/visits-2-report.service";
import type { Visits2Filters } from "../modules/reports/visits-2-report.service";
import { parseVisitTotalsQuery } from "../modules/reports/visit-totals-report.service";
import type { VisitTotalsFilters } from "../modules/reports/visit-totals-report.service";

const queryRecord = z.record(z.string(), z.union([z.string(), z.undefined()]).optional());

function querySchemaFromParser<T>(parse: (q: Record<string, string | undefined>) => T) {
  return queryRecord
    .superRefine((raw, ctx) => {
      try {
        parse(raw as Record<string, string | undefined>);
      } catch (e) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: e instanceof Error ? e.message : "ValidationError"
        });
      }
    })
    .transform((raw) => parse(raw as Record<string, string | undefined>));
}

function trimOpt(raw: string | undefined): string | undefined {
  const s = raw?.trim();
  return s && s.length > 0 ? s : undefined;
}

function parseBoolFlag(raw: string | undefined): boolean {
  return raw === "1" || raw === "true";
}

/** GET `/api/:slug/reports/sales` va boshqa `from`/`to` hisobotlar */
export type ReportsDateRangeQuery = {
  from?: string;
  to?: string;
};

export function parseReportsDateRangeQuery(q: Record<string, string | undefined>): ReportsDateRangeQuery {
  return {
    from: trimOpt(q.from),
    to: trimOpt(q.to)
  };
}

export const reportsDateRangeQuerySchema = queryRecord.transform((q) =>
  parseReportsDateRangeQuery(q as Record<string, string | undefined>)
);

/** GET `/api/:slug/reports/products`, `/clients` — limit bilan */
export type ReportsTopLimitQuery = ReportsDateRangeQuery & {
  limit: number;
};

export function parseReportsTopLimitQuery(q: Record<string, string | undefined>): ReportsTopLimitQuery {
  const range = parseReportsDateRangeQuery(q);
  const n = Number.parseInt(q.limit ?? "20", 10);
  const limit = Number.isFinite(n) && n > 0 ? Math.min(200, n) : 20;
  return { ...range, limit };
}

export const reportsTopLimitQuerySchema = queryRecord.transform((q) =>
  parseReportsTopLimitQuery(q as Record<string, string | undefined>)
);

/** GET `/api/:slug/reports/client-churn` */
export type ReportsClientChurnQuery = {
  monthsAgo: number;
};

export function parseReportsClientChurnQuery(q: Record<string, string | undefined>): ReportsClientChurnQuery {
  const n = Number.parseInt(q.monthsAgo ?? "3", 10);
  const monthsAgo = Number.isFinite(n) && n > 0 ? Math.min(24, n) : 3;
  return { monthsAgo };
}

export const reportsClientChurnQuerySchema = queryRecord.transform((q) =>
  parseReportsClientChurnQuery(q as Record<string, string | undefined>)
);

/** GET `/api/:slug/reports/receivables` */
export type ReportsReceivablesListQuery = {
  page: number;
  limit: number;
  search?: string;
  only_over_limit: boolean;
  active_only: boolean;
};

export function parseReportsReceivablesListQuery(
  q: Record<string, string | undefined>
): ReportsReceivablesListQuery {
  const page = Math.max(1, Number.parseInt(q.page ?? "1", 10) || 1);
  const limit = Math.min(200, Math.max(1, Number.parseInt(q.limit ?? "50", 10) || 50));
  return {
    page,
    limit,
    search: trimOpt(q.search),
    only_over_limit: parseBoolFlag(q.only_over_limit),
    active_only: parseBoolFlag(q.active_only)
  };
}

export const reportsReceivablesListQuerySchema = queryRecord.transform((q) =>
  parseReportsReceivablesListQuery(q as Record<string, string | undefined>)
);

/** GET `/api/:slug/reports/cash-flow` — majburiy maydonlar */
export type ReportsCashFlowQuery = {
  date_from: string;
  date_to: string;
  cash_desk_id_raw: string;
};

export const reportsCashFlowQuerySchema = queryRecord
  .transform((raw) => {
    const q = raw as Record<string, string | undefined>;
    return {
      date_from: trimOpt(q.date_from ?? q.from) ?? "",
      date_to: trimOpt(q.date_to ?? q.to) ?? "",
      cash_desk_id_raw: trimOpt(q.cash_desk_id ?? q.cashbox_id) ?? ""
    };
  })
  .refine((v): v is ReportsCashFlowQuery => Boolean(v.date_from && v.date_to && v.cash_desk_id_raw), {
    message: "date_from & date_to (или from & to), cash_desk_id | cashbox_id обязательны"
  });

/** GET `/api/:slug/reports/income-report` */
export type IncomeReportQuery = ReturnType<typeof parseIncomeReportQuery>;
export const incomeReportQuerySchema = querySchemaFromParser(parseIncomeReportQuery);

/** GET `/api/:slug/reports/order-debts` — servis ichida ham parse qiladi */
export type { OrderDebtsListQuery };
export const orderDebtsListQuerySchema = queryRecord.transform((q) =>
  parseOrderDebtsListQuery(q as Record<string, string | undefined>)
);

/** GET `/api/:slug/reports/client-sales-2` */
export type { ClientSales2Filters };
export const clientSales2QuerySchema = queryRecord.transform((q) =>
  parseClientSales2Query(q as Record<string, string | undefined>)
);

/** GET `/api/:slug/reports/client-sales-4` */
export type { ClientSales4Filters };
export const clientSales4QuerySchema = queryRecord.transform((q) =>
  parseClientSales4Query(q as Record<string, string | undefined>)
);

/** GET `/api/:slug/reports/agent-orders` */
export type { AgentOrdersFilters };
export const agentOrdersQuerySchema = queryRecord.transform((q) =>
  parseAgentOrdersQuery(q as Record<string, string | undefined>)
);

/** GET `/api/:slug/reports/product-sales` */
export type { ProductSalesReportFilters };
export const productSalesReportQuerySchema = queryRecord.transform((q) =>
  parseProductSalesReportQuery(q as Record<string, string | undefined>)
);

/** GET `/api/:slug/reports/expeditor-returns/*` */
export type { ExpeditorReturnsFilters };
export const expeditorReturnsQuerySchema = queryRecord.transform((q) =>
  parseExpeditorReturnsQuery(q as Record<string, string | undefined>)
);

/** GET `/api/:slug/reports/visits-2` */
export type { Visits2Filters };
export const visits2QuerySchema = queryRecord.transform((q) =>
  parseVisits2Query(q as Record<string, string | undefined>)
);

/** GET `/api/:slug/reports/visit-totals` */
export type { VisitTotalsFilters };
export const visitTotalsQuerySchema = queryRecord.transform((q) =>
  parseVisitTotalsQuery(q as Record<string, string | undefined>)
);
