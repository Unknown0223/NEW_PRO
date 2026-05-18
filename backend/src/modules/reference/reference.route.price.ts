import type { FastifyInstance } from "fastify";
import { ensureTenantContext } from "../../lib/tenant-context";
import { jwtAccessVerify, requireRoles } from "../auth/auth.prehandlers";
import { catalogRoles } from "./reference.route.shared";
import { listDistinctPriceTypesForTenant, listFinancePriceOverview } from "./reference.service";


export async function registerReferencePriceRoutes(app: FastifyInstance) {
  app.get(
    "/api/:slug/price-types",
    { preHandler: [jwtAccessVerify, requireRoles(...catalogRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const q = request.query as Record<string, string | undefined>;
      const kind = q.kind === "sale" || q.kind === "purchase" ? q.kind : undefined;
      const data = await listDistinctPriceTypesForTenant(request.tenant!.id, kind);
      return reply.send({ data });
    }
  );

  app.get(
    "/api/:slug/finance/price-overview",
    { preHandler: [jwtAccessVerify, requireRoles(...catalogRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const q = request.query as Record<string, string | undefined>;
      const kind = q.kind === "purchase" ? "purchase" : "sale";
      const data = await listFinancePriceOverview(request.tenant!.id, kind);
      return reply.send({ data });
    }
  );
}
