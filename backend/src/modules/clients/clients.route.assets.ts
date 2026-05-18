import type { FastifyInstance } from "fastify";
import { catalogRoles } from "./clients.route.shared";

import { z } from "zod";
import { sendApiError, zodValidationExtras } from "../../lib/api-error";
import { ensureTenantContext } from "../../lib/tenant-context";
import { jwtAccessVerify, requireRoles, getAccessUser } from "../auth/auth.prehandlers";
import {
  createClientEquipmentRow,
  createClientPhotoReportRow,
  deleteClientPhotoReport,
  listTenantEquipmentPaged,
  listClientEquipmentSplit,
  listClientPhotoReports,
  markClientEquipmentRemoved
} from "./client-assets.service";
import {
  createClientEquipmentBodySchema,
  createClientPhotoBodySchema
} from "./clients.route.schemas";

export async function registerClientAssetsRoutes(app: FastifyInstance) {
  app.get(
    "/api/:slug/equipment",
    { preHandler: [jwtAccessVerify] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const q = request.query as Record<string, string | undefined>;
      const page = Math.max(1, Number.parseInt(q.page ?? "1", 10) || 1);
      const limit = Math.min(200, Math.max(1, Number.parseInt(q.limit ?? "50", 10) || 50));
      const agent_id =
        q.agent_id && Number.isFinite(Number.parseInt(q.agent_id, 10)) ? Number.parseInt(q.agent_id, 10) : undefined;
      const statusRaw = q.status?.trim().toLowerCase();
      const status: "all" | "active" | "removed" =
        statusRaw === "all" || statusRaw === "removed" ? statusRaw : "active";
      const data = await listTenantEquipmentPaged(request.tenant!.id, {
        page,
        limit,
        date_from: q.date_from?.trim() || undefined,
        date_to: q.date_to?.trim() || undefined,
        agent_id,
        inventory_type: q.inventory_type?.trim() || undefined,
        territory_1: q.territory_1?.trim() || undefined,
        territory_2: q.territory_2?.trim() || undefined,
        territory_3: q.territory_3?.trim() || undefined,
        status,
        search: q.search?.trim() || undefined
      });
      return reply.send(data);
    }
  );

  app.get(
    "/api/:slug/clients/:id/equipment",
    { preHandler: [jwtAccessVerify] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const id = Number.parseInt((request.params as { id: string }).id, 10);
      if (Number.isNaN(id)) {
        return sendApiError(reply, request, 400, "InvalidId");
      }
      try {
        const data = await listClientEquipmentSplit(request.tenant!.id, id);
        return reply.send(data);
      } catch (e) {
        if (e instanceof Error && e.message === "NOT_FOUND") {
          return sendApiError(reply, request, 404, "NotFound");
        }
        throw e;
      }
    }
  );

  app.post(
    "/api/:slug/clients/:id/equipment",
    { preHandler: [jwtAccessVerify, requireRoles(...catalogRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const id = Number.parseInt((request.params as { id: string }).id, 10);
      if (Number.isNaN(id)) {
        return sendApiError(reply, request, 400, "InvalidId");
      }
      const parsed = createClientEquipmentBodySchema.safeParse(request.body);
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
        const row = await createClientEquipmentRow(request.tenant!.id, id, parsed.data);
        return reply.status(201).send(row);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        if (msg === "NOT_FOUND") return sendApiError(reply, request, 404, "NotFound");
        if (msg === "VALIDATION") return sendApiError(reply, request, 400, "ValidationError");
        throw e;
      }
    }
  );

  app.post(
    "/api/:slug/clients/:id/equipment/:equipmentId/remove",
    { preHandler: [jwtAccessVerify, requireRoles(...catalogRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const id = Number.parseInt((request.params as { id: string }).id, 10);
      const equipmentId = Number.parseInt((request.params as { equipmentId: string }).equipmentId, 10);
      if (Number.isNaN(id) || Number.isNaN(equipmentId)) {
        return sendApiError(reply, request, 400, "InvalidId");
      }
      try {
        await markClientEquipmentRemoved(request.tenant!.id, id, equipmentId);
        return reply.send({ ok: true });
      } catch (e) {
        if (e instanceof Error && e.message === "NOT_FOUND") {
          return sendApiError(reply, request, 404, "NotFound");
        }
        throw e;
      }
    }
  );

  app.get(
    "/api/:slug/clients/:id/photo-reports",
    { preHandler: [jwtAccessVerify] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const id = Number.parseInt((request.params as { id: string }).id, 10);
      if (Number.isNaN(id)) {
        return sendApiError(reply, request, 400, "InvalidId");
      }
      try {
        const data = await listClientPhotoReports(request.tenant!.id, id);
        return reply.send({ data });
      } catch (e) {
        if (e instanceof Error && e.message === "NOT_FOUND") {
          return sendApiError(reply, request, 404, "NotFound");
        }
        throw e;
      }
    }
  );

  app.post(
    "/api/:slug/clients/:id/photo-reports",
    { preHandler: [jwtAccessVerify, requireRoles(...catalogRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const id = Number.parseInt((request.params as { id: string }).id, 10);
      if (Number.isNaN(id)) {
        return sendApiError(reply, request, 400, "InvalidId");
      }
      const parsed = createClientPhotoBodySchema.safeParse(request.body);
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
        const actor = getAccessUser(request);
        const sub = Number.parseInt(actor.sub, 10);
        const actorUserId = Number.isFinite(sub) && sub > 0 ? sub : null;
        const row = await createClientPhotoReportRow(request.tenant!.id, id, actorUserId, parsed.data);
        return reply.status(201).send(row);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        if (msg === "NOT_FOUND") return sendApiError(reply, request, 404, "NotFound");
        if (msg === "VALIDATION") return sendApiError(reply, request, 400, "ValidationError");
        if (msg === "ORDER_NOT_FOUND") return sendApiError(reply, request, 400, "OrderNotFound");
        throw e;
      }
    }
  );

  app.delete(
    "/api/:slug/clients/:id/photo-reports/:photoId",
    { preHandler: [jwtAccessVerify, requireRoles(...catalogRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const id = Number.parseInt((request.params as { id: string }).id, 10);
      const photoId = Number.parseInt((request.params as { photoId: string }).photoId, 10);
      if (Number.isNaN(id) || Number.isNaN(photoId)) {
        return sendApiError(reply, request, 400, "InvalidId");
      }
      try {
        await deleteClientPhotoReport(request.tenant!.id, id, photoId);
        return reply.send({ ok: true });
      } catch (e) {
        if (e instanceof Error && e.message === "NOT_FOUND") {
          return sendApiError(reply, request, 404, "NotFound");
        }
        throw e;
      }
    }
  );
}
