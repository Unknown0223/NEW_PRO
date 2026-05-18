import { z } from "zod";
import type {
  ReportBuilderConfigPayload,
  ReportBuilderDatasetRequest,
} from "../modules/report-builder/report-builder.types";
import { DATASET_ORDERS_SALES_LINES } from "../modules/report-builder/report-builder.constants";

const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const idArr = z.array(z.number().int().positive()).max(200).optional();
const strArr = z.array(z.string()).max(200).optional();

/** OpenAPI hujjati — POST dataset (asosiy maydonlar; qo‘shimcha filtrlar ixtiyoriy). */
export const reportBuilderDatasetRequestDocSchema = z.object({
  datasetId: z.literal(DATASET_ORDERS_SALES_LINES),
  dateMode: z
    .enum(["order_date", "shipped_date", "delivered_date", "created_date"])
    .default("order_date"),
  dateFrom: ymd,
  dateTo: ymd,
  agentIds: idArr,
  statuses: strArr,
  orderTypes: strArr,
  warehouseIds: idArr,
  productIds: idArr,
  categoryIds: idArr,
  productGroupIds: idArr,
  brandIds: idArr,
  expeditorUserIds: idArr,
  supervisorUserIds: idArr,
  tradeDirectionIds: idArr,
  kpiGroupIds: idArr,
  clientIds: idArr,
  paymentMethodRefs: strArr,
  priceTypeRefs: strArr,
  branchValues: strArr,
  clientCategoryValues: strArr,
  territoryLevel1Values: strArr,
  territoryLevel2Values: strArr,
  territoryLevel3Values: strArr
});

/** OpenAPI — preview/export (dataset + pivot maydonlari). */
export const reportBuilderConfigDocSchema = reportBuilderDatasetRequestDocSchema.extend({
  rowFieldIds: z.array(z.string()).max(8).optional(),
  colFieldIds: z.array(z.string()).max(8).optional(),
  metrics: z
    .object({
      amount: z.boolean().optional(),
      qty: z.boolean().optional(),
      volume: z.boolean().optional(),
      akb: z.boolean().optional()
    })
    .optional()
});
import {
  validateReportBuilderConfig,
  validateReportBuilderDatasetRequest,
  validateReportBuilderSavedConfigBody
} from "../modules/report-builder/report-builder.validate";

function configBodySchema(exportMode?: boolean) {
  return z.unknown().superRefine((body, ctx) => {
    const v = validateReportBuilderConfig(body, { exportMode });
    if (!v.ok) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: v.error });
    }
  }).transform((body) => {
    const v = validateReportBuilderConfig(body, { exportMode });
    if (!v.ok) throw new Error("unreachable");
    return v.config;
  });
}

/** POST `/reports/report-builder/preview` va `/export` */
export const reportBuilderConfigBodySchema = configBodySchema(false);
export const reportBuilderExportBodySchema = configBodySchema(true);

/** POST `/reports/report-builder/dataset` */
export const reportBuilderDatasetBodySchema = z
  .unknown()
  .superRefine((body, ctx) => {
    const v = validateReportBuilderDatasetRequest(body);
    if (!v.ok) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: v.error });
    }
  })
  .transform((body) => {
    const v = validateReportBuilderDatasetRequest(body);
    if (!v.ok) throw new Error("unreachable");
    return v.filters;
  });

export type ReportBuilderSavedConfigValidated =
  | { variant: "legacy"; config: ReportBuilderConfigPayload }
  | { variant: "wdr"; config: Record<string, unknown> };

export const reportBuilderSavedConfigBodySchema = z
  .unknown()
  .superRefine((body, ctx) => {
    const v = validateReportBuilderSavedConfigBody(body);
    if (!v.ok) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: v.error });
    }
  })
  .transform((body) => {
    const v = validateReportBuilderSavedConfigBody(body);
    if (!v.ok) throw new Error("unreachable");
    return v;
  });

/** POST `/reports/report-builder/saved` */
export const reportBuilderSavedCreateBodySchema = z.object({
  name: z.string().trim().min(1, "EMPTY_NAME"),
  config: reportBuilderSavedConfigBodySchema
});

export type { ReportBuilderConfigPayload, ReportBuilderDatasetRequest };
