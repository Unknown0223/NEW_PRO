import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { sendApiError } from "../../lib/api-error";
import { ensureTenantContext } from "../../lib/tenant-context";
import { DIRECTORY_READ_ROLES, jwtAccessVerify, requireRoles } from "../auth/auth.prehandlers";
import { listGpsMonitoringEmployees } from "./gps-monitoring.employees";
import { getGpsMonitoringDay } from "./gps-monitoring.day";
import { listGpsMonitoringOverview, listGpsTradingPoints } from "./gps-monitoring.overview";

const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD")
  .optional();

export async function registerGpsMonitoringRoutes(app: FastifyInstance) {
  app.get(
    "/api/:slug/gps-monitoring/employees",
    {
      preHandler: [jwtAccessVerify, requireRoles(...DIRECTORY_READ_ROLES)]
    },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const q = z
        .object({
          date: dateSchema,
          role: z.string().optional()
        })
        .safeParse(request.query);
      if (!q.success) {
        return sendApiError(reply, request, 400, "ValidationError", q.error.message);
      }
      const data = await listGpsMonitoringEmployees(request.tenant!.id, {
        date: q.data.date,
        role: q.data.role
      });
      return reply.send({ data });
    }
  );

  app.get(
    "/api/:slug/gps-monitoring/day",
    {
      preHandler: [jwtAccessVerify, requireRoles(...DIRECTORY_READ_ROLES)]
    },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const q = z
        .object({
          employee_id: z.coerce.number().int().positive(),
          date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
        })
        .safeParse(request.query);
      if (!q.success) {
        return sendApiError(reply, request, 400, "ValidationError", q.error.message);
      }
      try {
        const data = await getGpsMonitoringDay(
          request.tenant!.id,
          q.data.employee_id,
          q.data.date
        );
        if (!data) return sendApiError(reply, request, 404, "EmployeeNotFound");
        return reply.send({ data });
      } catch (e) {
        if (e instanceof Error && e.message === "InvalidDate") {
          return sendApiError(reply, request, 400, "InvalidDate");
        }
        throw e;
      }
    }
  );

  app.get(
    "/api/:slug/gps-monitoring/overview",
    {
      preHandler: [jwtAccessVerify, requireRoles(...DIRECTORY_READ_ROLES)]
    },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const q = z
        .object({
          role: z.string().optional()
        })
        .safeParse(request.query);
      if (!q.success) {
        return sendApiError(reply, request, 400, "ValidationError", q.error.message);
      }
      const data = await listGpsMonitoringOverview(request.tenant!.id, { role: q.data.role });
      return reply.send({ data });
    }
  );

  app.get(
    "/api/:slug/gps-monitoring/trading-points",
    {
      preHandler: [jwtAccessVerify, requireRoles(...DIRECTORY_READ_ROLES)]
    },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const q = z
        .object({ limit: z.coerce.number().int().positive().max(200).optional() })
        .safeParse(request.query);
      if (!q.success) {
        return sendApiError(reply, request, 400, "ValidationError", q.error.message);
      }
      const data = await listGpsTradingPoints(request.tenant!.id, { limit: q.data.limit });
      return reply.send({ data });
    }
  );
}
