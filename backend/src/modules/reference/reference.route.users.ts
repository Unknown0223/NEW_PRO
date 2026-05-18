import type { FastifyInstance } from "fastify";
import { ensureTenantContext } from "../../lib/tenant-context";
import { jwtAccessVerify, requireRoles, DIRECTORY_READ_ROLES } from "../auth/auth.prehandlers";
import { listUsersForOrderAgent } from "./reference.service";


export async function registerReferenceUserRoutes(app: FastifyInstance) {
  app.get(
    "/api/:slug/users",
    { preHandler: [jwtAccessVerify, requireRoles(...DIRECTORY_READ_ROLES)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const data = await listUsersForOrderAgent(request.tenant!.id);
      return reply.send({ data });
    }
  );
}
