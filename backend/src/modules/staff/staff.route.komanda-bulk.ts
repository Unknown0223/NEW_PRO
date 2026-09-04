import type { FastifyInstance } from "fastify";
import { sendApiError, zodValidationExtras } from "../../lib/api-error";
import { ensureTenantContext } from "../../lib/tenant-context";
import { actorUserIdOrNull } from "../../lib/request-actor";
import { jwtAccessVerify, requireRoles } from "../auth/auth.prehandlers";
import {
  bulkPatchKomandaStaff,
  type BulkKomandaStaffInput,
  type KomandaBulkRole
} from "./staff.patches.web-presets.bulk";
import { bulkKomandaStaffBody } from "./staff.route.schemas.parsers";
import { catalogRoles } from "./staff.route.shared";

const SEGMENT_BY_ROLE: Record<KomandaBulkRole, string> = {
  supervisor: "supervisors",
  expeditor: "expeditors",
  collector: "collectors",
  auditor: "auditors",
  skladchik: "skladchik"
};

export function registerKomandaBulkRoute(app: FastifyInstance, role: KomandaBulkRole): void {
  const segment = SEGMENT_BY_ROLE[role];
  app.post(
    `/api/:slug/${segment}/bulk`,
    { preHandler: [jwtAccessVerify, requireRoles(...catalogRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const parsed = bulkKomandaStaffBody.safeParse(request.body);
      if (!parsed.success) {
        return sendApiError(
          reply,
          request,
          400,
          "ValidationError",
          "Request validation failed",
          zodValidationExtras(parsed.error)
        );
      }
      try {
        const data = await bulkPatchKomandaStaff(
          request.tenant!.id,
          role,
          parsed.data as BulkKomandaStaffInput,
          actorUserIdOrNull(request)
        );
        return reply.send({ data });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        if (msg === "EMPTY_IDS") return sendApiError(reply, request, 400, "EmptyIds");
        if (msg === "TOO_MANY_USERS") return sendApiError(reply, request, 400, "TooManyUsers");
        if (msg === "BAD_USER_IDS") return sendApiError(reply, request, 400, "BadUserIds");
        if (msg === "BAD_BULK_ACTION") return sendApiError(reply, request, 400, "BadBulkAction");
        throw e;
      }
    }
  );
}
