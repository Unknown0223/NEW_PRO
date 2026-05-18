import type { FastifyInstance } from "fastify";
import { sendApiError, zodValidationExtras } from "../../lib/api-error";
import { ensureTenantContext } from "../../lib/tenant-context";
import { jwtAccessVerify } from "../auth/auth.prehandlers";
import { fetchBonusRuleFull, previewQtyBonus } from "./bonus-rules.service";
import { previewQtyBodySchema } from "./bonus-rules.route.schemas";


export async function registerBonusRuleReadRoutes(app: FastifyInstance) {
  app.get(
    "/api/:slug/bonus-rules/:id",
    { preHandler: [jwtAccessVerify] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const id = Number.parseInt((request.params as { id: string }).id, 10);
      if (Number.isNaN(id)) {
        return sendApiError(reply, request, 400, "InvalidId");
      }
      const row = await fetchBonusRuleFull(request.tenant!.id, id);
      if (!row) {
        return sendApiError(reply, request, 404, "NotFound");
      }
      return reply.send(row);
    }
  );

  app.post(
    "/api/:slug/bonus-rules/:id/preview-qty",
    { preHandler: [jwtAccessVerify] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const id = Number.parseInt((request.params as { id: string }).id, 10);
      if (Number.isNaN(id)) {
        return sendApiError(reply, request, 400, "InvalidId");
      }
      const parsed = previewQtyBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return sendApiError(reply, request, 400, "ValidationError", undefined, zodValidationExtras(parsed.error));
      }
      const result = await previewQtyBonus(request.tenant!.id, id, parsed.data.purchased_qty);
      if ("error" in result) {
        if (result.error === "NOT_FOUND") return sendApiError(reply, request, 404, "NotFound");
        if (result.error === "WRONG_TYPE") {
          return sendApiError(
            reply,
            request,
            400,
            "WrongType",
            "Faqat miqdor (qty) turidagi qoida"
          );
        }
        return sendApiError(
          reply,
          request,
          400,
          "NoConditions",
          "Shartlar yoki buy_qty/free_qty yo‘q"
        );
      }
      return reply.send(result);
    }
  );
}
