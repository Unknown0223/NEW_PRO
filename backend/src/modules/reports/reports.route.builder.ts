import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
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
import { parseZodOr400, sendReportBuilderHttp } from "./reports.route.shared";
import { ensureTenantContext } from "../../lib/tenant-context";
import { createReportRouteGuards, parseReportQueryOr400, reportQueryRaw } from "./reports.route.shared";

export async function registerReportsBuilderRoutes(app: FastifyInstance, guards: ReturnType<typeof createReportRouteGuards> = createReportRouteGuards()) {
  const { reportViewPreHandler, reportExportPreHandler, incomeViewPreHandler, incomeExportPreHandler } = guards;

  app.get("/api/:slug/reports/report-builder/metadata", { preHandler: reportViewPreHandler }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    return reply.send({ data: reportBuilderMetadata() });
  });

  app.get("/api/:slug/reports/report-builder/filter-options", { preHandler: reportViewPreHandler }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const u = getAccessUser(request);
    const data = await getReportBuilderFilterOptions(request.tenant!.id, {
      userId: actorUserIdOrNull(request),
      role: u.role
    });
    return reply.send({ data });
  });

  app.post("/api/:slug/reports/report-builder/dataset", { preHandler: reportViewPreHandler }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const filters = parseZodOr400<ReportBuilderDatasetRequest>(
      reply,
      request,
      reportBuilderDatasetBodySchema,
      request.body
    );
    if (!filters) return;
    const u = getAccessUser(request);
    try {
      const data = await reportBuilderDataset(request.tenant!.id, filters, {
        userId: actorUserIdOrNull(request),
        role: u.role
      });
      return reply.send({ data });
    } catch (e) {
      if (sendReportBuilderHttp(reply, request, e)) return;
      throw e;
    }
  });

  app.post("/api/:slug/reports/report-builder/preview", { preHandler: reportViewPreHandler }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const config = parseZodOr400<ReportBuilderConfigPayload>(
      reply,
      request,
      reportBuilderConfigBodySchema,
      request.body
    );
    if (!config) return;
    const u = getAccessUser(request);
    try {
      const data = await reportBuilderPreview(request.tenant!.id, config, {
        userId: actorUserIdOrNull(request),
        role: u.role
      });
      return reply.send({ data });
    } catch (e) {
      if (sendReportBuilderHttp(reply, request, e)) return;
      throw e;
    }
  });

  app.post("/api/:slug/reports/report-builder/export", { preHandler: reportExportPreHandler }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const config = parseZodOr400<ReportBuilderConfigPayload>(
      reply,
      request,
      reportBuilderExportBodySchema,
      request.body
    );
    if (!config) return;
    const u = getAccessUser(request);
    try {
      const { buffer, truncated, totalRowCount } = await reportBuilderExportXlsx(request.tenant!.id, config, {
        userId: actorUserIdOrNull(request),
        role: u.role
      });
      return reply
        .header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
        .header("Content-Disposition", 'attachment; filename="report-builder.xlsx"')
        .header("X-Export-Truncated", truncated ? "1" : "0")
        .header("X-Export-Total", String(totalRowCount))
        .send(buffer);
    } catch (e) {
      if (sendReportBuilderHttp(reply, request, e)) return;
      throw e;
    }
  });

  app.get("/api/:slug/reports/report-builder/saved", { preHandler: reportViewPreHandler }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const userId = actorUserIdOrNull(request);
    if (userId == null) return sendApiError(reply, request, 401, "Unauthorized", "User context required");
    const data = await reportBuilderSaved.list(request.tenant!.id, userId);
    return reply.send({ data });
  });

  app.post("/api/:slug/reports/report-builder/saved", { preHandler: reportViewPreHandler }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const userId = actorUserIdOrNull(request);
    if (userId == null) return sendApiError(reply, request, 401, "Unauthorized", "User context required");
    const body = parseZodOr400<{ name: string; config: ReportBuilderSavedConfigValidated }>(
      reply,
      request,
      reportBuilderSavedCreateBodySchema,
      request.body
    );
    if (!body) return;
    try {
      const row = await reportBuilderSaved.create(request.tenant!.id, userId, body.name, body.config.config);
      return reply.send({ data: row });
    } catch (e) {
      if (e instanceof Error && e.message === "EMPTY_NAME") {
        return sendApiError(reply, request, 400, "EMPTY_NAME");
      }
      throw e;
    }
  });

  app.put("/api/:slug/reports/report-builder/saved/:id", { preHandler: reportViewPreHandler }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const userId = actorUserIdOrNull(request);
    if (userId == null) return sendApiError(reply, request, 401, "Unauthorized", "User context required");
    const id = Number.parseInt((request.params as { id: string }).id, 10);
    if (!Number.isFinite(id)) return sendApiError(reply, request, 400, "InvalidId");
    const body = request.body as { name?: string; config?: ReportBuilderConfigPayload };
    let configPatch: ReportBuilderConfigPayload | Record<string, unknown> | undefined;
    if (body.config != null) {
      const v = parseZodOr400<ReportBuilderSavedConfigValidated>(
        reply,
        request,
        reportBuilderSavedConfigBodySchema,
        body.config
      );
      if (!v) return;
      configPatch = v.config;
    }
    const row = await reportBuilderSaved.update(request.tenant!.id, userId, id, {
      name: body.name,
      config: configPatch
    });
    if (!row) return sendApiError(reply, request, 404, "NotFound");
    return reply.send({ data: row });
  });

  app.delete("/api/:slug/reports/report-builder/saved/:id", { preHandler: reportViewPreHandler }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const userId = actorUserIdOrNull(request);
    if (userId == null) return sendApiError(reply, request, 401, "Unauthorized", "User context required");
    const id = Number.parseInt((request.params as { id: string }).id, 10);
    if (!Number.isFinite(id)) return sendApiError(reply, request, 400, "InvalidId");
    const ok = await reportBuilderSaved.delete(request.tenant!.id, userId, id);
    if (!ok) return sendApiError(reply, request, 404, "NotFound");
    return reply.status(204).send();
  });
}
