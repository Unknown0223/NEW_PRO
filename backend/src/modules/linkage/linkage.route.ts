import type { FastifyInstance } from "fastify";
import { ensureTenantContext } from "../../lib/tenant-context";
import {
  DIRECTORY_READ_ROLES,
  jwtAccessVerify,
  requireAnyPermission,
  requireRoles
} from "../auth/auth.prehandlers";
import { parseSelectedMastersFromQuery, resolveConstraintScope } from "./linkage.service";

/** Zakaz yaratish/ko‘rish konteksti — katalog + legacy «Заказы / Заказ» (`legacy-permissions.generated.ts`). */
const LINKAGE_OPTIONS_ANY = [
  "orders.view",
  "orders.create",
  "orders.zakaz.spisok_zakazov",
  "orders.zakaz.prosmotr_zakaza",
  "orders.zakaz.sozdanie_zakaza"
] as const;

const linkageOptionsPreHandler = [
  jwtAccessVerify,
  requireRoles(...DIRECTORY_READ_ROLES),
  requireAnyPermission([...LINKAGE_OPTIONS_ANY])
];

export async function registerLinkageRoutes(app: FastifyInstance) {
  app.get(
    "/api/:slug/linkage/options",
    { preHandler: linkageOptionsPreHandler },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const q = request.query as Record<string, string | undefined>;
      const selected = parseSelectedMastersFromQuery(q);
      const data = await resolveConstraintScope(request.tenant!.id, selected);
      return reply.send({ data });
    }
  );
}
