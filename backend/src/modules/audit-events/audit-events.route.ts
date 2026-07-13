import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { ensureTenantContext } from "../../lib/tenant-context";
import { sendApiError, zodValidationExtras } from "../../lib/api-error";
import { jwtAccessVerify, requireRoles } from "../auth/auth.prehandlers";
import {
  buildTenantAuditXlsxBuffer,
  listTenantAuditEvents,
  listTenantAuditEventsForExport
} from "./audit-events.service";

const adminRoles = ["admin"] as const;

const listQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(200).default(50),
  entity_type: z.string().max(64).optional(),
  entity_id: z.string().max(64).optional(),
  actor_user_id: z.coerce.number().int().positive().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  export: z.enum(["xlsx"]).optional()
});

export async function registerAuditEventRoutes(app: FastifyInstance) {
  app.get(
    "/api/:slug/audit-events",
    { preHandler: [jwtAccessVerify, requireRoles(...adminRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const parsed = listQuerySchema.safeParse(request.query ?? {});
      if (!parsed.success) {
        return sendApiError(
          reply,
          request,
          400,
          "ValidationError",
          "Invalid query",
          zodValidationExtras(parsed.error)
        );
      }

      const { export: exportKind, page, limit, ...filters } = parsed.data;

      if (exportKind === "xlsx") {
        const exportData = await listTenantAuditEventsForExport(request.tenant!.id, filters);
        const buf = await buildTenantAuditXlsxBuffer(exportData.data);
        reply.header(
          "content-type",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        );
        reply.header("Content-Disposition", 'attachment; filename="audit-jurnal.xlsx"');
        if (exportData.truncated) {
          reply.header("X-Export-Truncated", "1");
          reply.header("X-Export-Total", String(exportData.total));
        }
        return reply.send(buf);
      }

      const result = await listTenantAuditEvents(request.tenant!.id, {
        ...filters,
        page,
        limit
      });
      return reply.send(result);
    }
  );

  /** Aniq Excel yo‘li (settings/audit UX uchun). */
  app.get(
    "/api/:slug/audit-events/export.xlsx",
    { preHandler: [jwtAccessVerify, requireRoles(...adminRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const parsed = listQuerySchema.omit({ page: true, limit: true, export: true }).safeParse(
        request.query ?? {}
      );
      if (!parsed.success) {
        return sendApiError(
          reply,
          request,
          400,
          "ValidationError",
          "Invalid query",
          zodValidationExtras(parsed.error)
        );
      }
      const exportData = await listTenantAuditEventsForExport(request.tenant!.id, parsed.data);
      const buf = await buildTenantAuditXlsxBuffer(exportData.data);
      reply.header(
        "content-type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      reply.header("Content-Disposition", 'attachment; filename="audit-jurnal.xlsx"');
      if (exportData.truncated) {
        reply.header("X-Export-Truncated", "1");
        reply.header("X-Export-Total", String(exportData.total));
      }
      return reply.send(buf);
    }
  );
}
