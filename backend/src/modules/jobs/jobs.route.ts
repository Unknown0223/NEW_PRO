import type { FastifyInstance } from "fastify";
import { sendApiError } from "../../lib/api-error";
import { ensureTenantContext } from "../../lib/tenant-context";
import { ADMIN_AND_OPERATOR_LIKE_ROLES } from "../../lib/tenant-user-roles";
import { getAccessUser, jwtAccessVerify, requireRoles } from "../auth/auth.prehandlers";
import { enqueuePingJob, getBackgroundJobForTenant } from "./jobs.service";

const jobOperatorRoles = ADMIN_AND_OPERATOR_LIKE_ROLES;

export async function registerJobRoutes(app: FastifyInstance) {
  app.post(
    "/api/:slug/jobs/ping",
    { preHandler: [jwtAccessVerify, requireRoles(...jobOperatorRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const tenant = request.tenant!;
      const user = getAccessUser(request);
      try {
        const result = await enqueuePingJob(tenant.id, Number(user.sub));
        return reply.status(202).send(result);
      } catch (err) {
        request.log.warn({ err }, "jobs.enqueue failed (redis?)");
        return sendApiError(
          reply,
          request,
          503,
          "JobQueueUnavailable",
          "Redis yoki navbat mavjud emas. Worker va REDIS_URL ni tekshiring."
        );
      }
    }
  );

  app.get(
    "/api/:slug/jobs/:jobId",
    { preHandler: [jwtAccessVerify, requireRoles(...jobOperatorRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const { jobId } = request.params as { jobId: string };
      try {
        const job = await getBackgroundJobForTenant(jobId, request.tenant!.id);
        if (!job) {
          return sendApiError(reply, request, 404, "JobNotFound");
        }
        return reply.send(job);
      } catch (err) {
        request.log.warn({ err }, "jobs.get failed (redis?)");
        return sendApiError(reply, request, 503, "JobQueueUnavailable", "Redis yoki navbat mavjud emas.");
      }
    }
  );
}
