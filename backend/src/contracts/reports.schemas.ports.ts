import { z } from "zod";
import { parseOutletClassReportQuery } from "../modules/reports/outlet-class-report.service";
import type { OutletClassReportFilters } from "../modules/reports/outlet-class-report.service";
import { parseExpeditorVisitsReportQuery } from "../modules/reports/expeditor-visits-report.service";
import type { ExpeditorVisitsReportFilters } from "../modules/reports/expeditor-visits-report.service";
import { parseExpeditorShareReportQuery } from "../modules/reports/expeditor-share-report.service";
import type { ExpeditorShareReportFilters } from "../modules/reports/expeditor-share-report.service";
import { parseRfmReportQuery } from "../modules/reports/rfm-report.service";
import type { RfmReportFilters } from "../modules/reports/rfm-report.service";
import { parseBalanceControlReportQuery } from "../modules/reports/balance-control-report.service";
import type { BalanceControlReportFilters } from "../modules/reports/balance-control-report.service";
import { parseUniversalReturnsReportQuery } from "../modules/reports/universal-returns-report.service";
import type { UniversalReturnsReportFilters } from "../modules/reports/universal-returns-report.service";
import { parseUniversalBonusesReportQuery } from "../modules/reports/universal-bonuses-report.service";
import type { UniversalBonusesReportFilters } from "../modules/reports/universal-bonuses-report.service";
import { parseUniversalVisitsReportQuery } from "../modules/reports/universal-visits-report.service";
import type { UniversalVisitsReportFilters } from "../modules/reports/universal-visits-report.service";
import { parseUniversalSalesReportQuery } from "../modules/reports/universal-sales-report.service";
import type { UniversalSalesReportFilters } from "../modules/reports/universal-sales-report.service";
import { parseDiscountDetailReportQuery } from "../modules/reports/discount-detail-report.service";
import type { DiscountDetailReportFilters } from "../modules/reports/discount-detail-report.service";
import { parseUniversalDiscountsReportQuery } from "../modules/reports/universal-discounts-report.service";
import type { UniversalDiscountsReportFilters } from "../modules/reports/universal-discounts-report.service";
import { parseSalesCompareReportQuery } from "../modules/reports/sales-compare-report.service";
import type { SalesCompareReportFilters } from "../modules/reports/sales-compare-report.service";

const queryRecord = z.record(z.string(), z.union([z.string(), z.undefined()]).optional());

/** GET `/api/:slug/reports/outlet-class` */
export type { OutletClassReportFilters };
export const outletClassReportQuerySchema = queryRecord.transform((q) =>
  parseOutletClassReportQuery(q as Record<string, string | undefined>)
);

/** GET `/api/:slug/reports/expeditor-visits` */
export type { ExpeditorVisitsReportFilters };
export const expeditorVisitsReportQuerySchema = queryRecord.transform((q) =>
  parseExpeditorVisitsReportQuery(q as Record<string, string | undefined>)
);

/** GET `/api/:slug/reports/expeditor-share` */
export type { ExpeditorShareReportFilters };
export const expeditorShareReportQuerySchema = queryRecord.transform((q) =>
  parseExpeditorShareReportQuery(q as Record<string, string | undefined>)
);

/** GET `/api/:slug/reports/rfm` */
export type { RfmReportFilters };
export const rfmReportQuerySchema = queryRecord.transform((q) =>
  parseRfmReportQuery(q as Record<string, string | undefined>)
);

/** GET `/api/:slug/reports/balance-control` */
export type { BalanceControlReportFilters };
export const balanceControlReportQuerySchema = queryRecord.transform((q) =>
  parseBalanceControlReportQuery(q as Record<string, string | undefined>)
);

/** GET `/api/:slug/reports/universal-returns` */
export type { UniversalReturnsReportFilters };
export const universalReturnsReportQuerySchema = queryRecord.transform((q) =>
  parseUniversalReturnsReportQuery(q as Record<string, string | undefined>)
);

/** GET `/api/:slug/reports/universal-bonuses` */
export type { UniversalBonusesReportFilters };
export const universalBonusesReportQuerySchema = queryRecord.transform((q) =>
  parseUniversalBonusesReportQuery(q as Record<string, string | undefined>)
);

/** GET `/api/:slug/reports/universal-visits` */
export type { UniversalVisitsReportFilters };
export const universalVisitsReportQuerySchema = queryRecord.transform((q) =>
  parseUniversalVisitsReportQuery(q as Record<string, string | undefined>)
);

/** GET `/api/:slug/reports/universal-sales` */
export type { UniversalSalesReportFilters };
export const universalSalesReportQuerySchema = queryRecord.transform((q) =>
  parseUniversalSalesReportQuery(q as Record<string, string | undefined>)
);

/** GET `/api/:slug/reports/discount-detail` */
export type { DiscountDetailReportFilters };
export const discountDetailReportQuerySchema = queryRecord.transform((q) =>
  parseDiscountDetailReportQuery(q as Record<string, string | undefined>)
);

/** GET `/api/:slug/reports/universal-discounts` */
export type { UniversalDiscountsReportFilters };
export const universalDiscountsReportQuerySchema = queryRecord.transform((q) =>
  parseUniversalDiscountsReportQuery(q as Record<string, string | undefined>)
);

/** GET `/api/:slug/reports/sales-compare` */
export type { SalesCompareReportFilters };
export const salesCompareReportQuerySchema = queryRecord.transform((q) =>
  parseSalesCompareReportQuery(q as Record<string, string | undefined>)
);
