import type { FastifyInstance } from "fastify";
import { ensureTenantContext } from "../../lib/tenant-context";
import { jwtAccessVerify, requireRoles } from "../auth/auth.prehandlers";
import { catalogRoles } from "./reference.route.shared";
import { listDistinctPriceTypesForTenant, listFinancePriceOverview } from "./reference.service";
import { resolvePriceTypeKeyToLabel } from "../tenant-settings/finance-refs";
import { loadPriceTypeEntriesForResolve } from "../tenant-settings/tenant-settings.service";


export async function registerReferencePriceRoutes(app: FastifyInstance) {
  app.get(
    "/api/:slug/price-types",
    { preHandler: [jwtAccessVerify, requireRoles(...catalogRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const q = request.query as Record<string, string | undefined>;
      const kind = q.kind === "sale" || q.kind === "purchase" ? q.kind : undefined;
      const data = await listDistinctPriceTypesForTenant(request.tenant!.id, kind);
      // `options` — UI tanlovlari uchun: id — DB kaliti, label — spravochnikdagi nom
      const entries = await loadPriceTypeEntriesForResolve(request.tenant!.id);
      const options = data.map((id) => ({
        id,
        label: resolvePriceTypeKeyToLabel(id, entries) ?? id
      }));
      return reply.send({ data, options });
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
