import type { FastifyInstance } from "fastify";
import { catalogRoles } from "./products.route.shared";

import { bulkProductsBodySchema } from "../../contracts/products.schemas";
import { actorUserIdOrNull } from "../../lib/request-actor";
import { sendApiError, zodValidationExtras } from "../../lib/api-error";
import { ensureTenantContext } from "../../lib/tenant-context";
import { jwtAccessVerify, requireRoles } from "../auth/auth.prehandlers";
import { createProductsBulk } from "./products.service";


export async function registerProductBulkRoutes(app: FastifyInstance) {
  app.post(
    "/api/:slug/products/bulk",
    { preHandler: [jwtAccessVerify, requireRoles(...catalogRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const parsed = bulkProductsBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return sendApiError(reply, request, 400, "ValidationError", undefined, zodValidationExtras(parsed.error));
      }
      try {
        const result = await createProductsBulk(
          request.tenant!.id,
          parsed.data.items,
          actorUserIdOrNull(request)
        );
        return reply.status(201).send(result);
      } catch (e) {
        throw e;
      }
    }
  );
}
