import type { FastifyInstance } from "fastify";
import type { PhotoReportFilters } from "../../contracts/reports.schemas";
import { photoReportQuerySchema } from "../../contracts/reports.schemas";
import { actorUserIdOrNull } from "../../lib/request-actor";
import { getAccessUser } from "../auth/auth.prehandlers";
import { ensureTenantContext } from "../../lib/tenant-context";
import {
  exportPhotoReportXlsx,
  getPhotoReport,
  getPhotoReportContent,
  getPhotoReportFilterOptions
} from "./photo-report.service";
import { createReportRouteGuards, parseReportQueryOr400, reportQueryRaw } from "./reports.route.shared";

export function registerPhotoReportRoutes(
  app: FastifyInstance,
  guards: ReturnType<typeof createReportRouteGuards> = createReportRouteGuards()
) {
  const { reportViewPreHandler, reportExportPreHandler } = guards;

  app.get("/api/:slug/reports/photo/filter-options", { preHandler: reportViewPreHandler }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const u = getAccessUser(request);
    const data = await getPhotoReportFilterOptions(request.tenant!.id, {
      userId: actorUserIdOrNull(request),
      role: u.role
    });
    return reply.send({ data });
  });

  app.get(
    "/api/:slug/reports/photo/:photoId/content",
    { preHandler: reportViewPreHandler },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const photoId = Number((request.params as { photoId?: string }).photoId);
      if (!Number.isFinite(photoId) || photoId <= 0) {
        return reply.code(400).send({ error: "BAD_PHOTO_ID" });
      }
      const q = request.query as { thumb?: string };
      const thumb = q.thumb === "1" || q.thumb === "true";
      const u = getAccessUser(request);
      const content = await getPhotoReportContent(request.tenant!.id, photoId, thumb, {
        userId: actorUserIdOrNull(request),
        role: u.role
      });
      if (!content) return reply.code(404).send({ error: "PHOTO_NOT_FOUND" });
      if (content.kind === "redirect") {
        return reply.redirect(content.url);
      }
      return reply
        .header("Content-Type", content.contentType)
        .header("Cache-Control", "private, max-age=120")
        .send(content.buffer);
    }
  );

  app.get("/api/:slug/reports/photo/export", { preHandler: reportExportPreHandler }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const q = request.query as Record<string, string | undefined>;
    const u = getAccessUser(request);
    const { buffer, total, truncated } = await exportPhotoReportXlsx(request.tenant!.id, q, {
      userId: actorUserIdOrNull(request),
      role: u.role
    });
    return reply
      .header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
      .header("Content-Disposition", 'attachment; filename="fotootchoty.xlsx"')
      .header("X-Export-Truncated", truncated ? "1" : "0")
      .header("X-Export-Total", String(total))
      .send(buffer);
  });

  app.get("/api/:slug/reports/photo", { preHandler: reportViewPreHandler }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const q = parseReportQueryOr400<PhotoReportFilters>(
      reply,
      request,
      photoReportQuerySchema,
      reportQueryRaw(request)
    );
    if (!q) return;
    const u = getAccessUser(request);
    const slug = String((request.params as { slug?: string }).slug ?? request.tenant!.slug ?? "");
    const data = await getPhotoReport(
      request.tenant!.id,
      q,
      {
        userId: actorUserIdOrNull(request),
        role: u.role
      },
      slug
    );
    return reply.send({ data });
  });
}
