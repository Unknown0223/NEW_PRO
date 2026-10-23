import type { FastifyReply, FastifyRequest } from "fastify";
import type { ZodTypeAny } from "zod";
import { sendApiError, zodValidationExtras } from "../../lib/api-error";
import { jwtAccessVerify, requireAnyPermission } from "../auth/auth.prehandlers";
import { ReportBuilderHttpError } from "../report-builder/report-builder.validate";
import { REPORT_EXPORT_ANY_PERMISSIONS, REPORT_VIEW_ANY_PERMISSIONS } from "./report-permissions";

export function sendReportBuilderHttp(reply: FastifyReply, request: FastifyRequest, err: unknown): boolean {
  if (!(err instanceof ReportBuilderHttpError)) return false;
  void sendApiError(reply, request, err.status, err.message);
  return true;
}

export function parseZodOr400<T>(
  reply: FastifyReply,
  request: FastifyRequest,
  schema: ZodTypeAny,
  raw: unknown
): T | null {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    void sendApiError(reply, request, 400, "ValidationError", undefined, zodValidationExtras(parsed.error));
    return null;
  }
  return parsed.data as T;
}

export const parseReportQueryOr400 = parseZodOr400;

export function reportQueryRaw(request: FastifyRequest): Record<string, string | undefined> {
  return request.query as Record<string, string | undefined>;
}

export function createReportRouteGuards() {
  return {
    reportViewPreHandler: [jwtAccessVerify, requireAnyPermission(REPORT_VIEW_ANY_PERMISSIONS)],
    reportExportPreHandler: [jwtAccessVerify, requireAnyPermission(REPORT_EXPORT_ANY_PERMISSIONS)],
    incomeViewPreHandler: [
      jwtAccessVerify,
      requireAnyPermission(["cashbox.income_report.view", "reports.view", "cash.otchety.view"])
    ],
    incomeExportPreHandler: [
      jwtAccessVerify,
      requireAnyPermission(["cashbox.income_report.export", "reports.export", "cash.otchety.export"])
    ]
  };
}
