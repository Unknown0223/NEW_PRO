import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { sendApiError, zodValidationExtras } from "../../lib/api-error";
import { ensureTenantContext } from "../../lib/tenant-context";
import { actorUserIdOrNull } from "../../lib/request-actor";
import { jwtAccessVerify, requireRoles } from "../auth/auth.prehandlers";
import { ADMIN_AND_OPERATOR_LIKE_ROLES } from "../../lib/tenant-user-roles";
import {
  assignClientsInBoundaryById,
  deleteGeoBoundary,
  listGeoBoundaries,
  restoreGeoBoundary,
  upsertGeoBoundary
} from "./geo-boundaries.service";
import { GeoBoundaryOverlapError } from "./geo-boundary-overlap.error";

const writeRoles = ADMIN_AND_OPERATOR_LIKE_ROLES;

const pointSchema = z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) });

const upsertSchema = z.object({
  kind: z.enum(["branch", "zone", "territory"]),
  ref_id: z.string().min(1).max(128),
  name: z.string().min(1).max(256),
  polygon: z.array(pointSchema).min(3).max(500),
  clip_against_existing: z.boolean().optional(),
  overlap_resolution: z.enum(["existing_wins", "incoming_wins"]).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  warehouse_id: z.number().int().positive().nullable().optional(),
  cash_desk_id: z.number().int().positive().nullable().optional()
});

export async function registerGeoBoundaryRoutes(app: FastifyInstance) {
  const preHandler = [jwtAccessVerify, requireRoles(...writeRoles)];

  app.get("/api/:slug/geo-boundaries", { preHandler }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const q = request.query as Record<string, string | undefined>;
    const archive = q.archive === "true" || q.archive === "1";
    const rows = await listGeoBoundaries(request.tenant!.id, { archive });
    return reply.send({ data: rows });
  });

  app.put("/api/:slug/geo-boundaries", { preHandler }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const parsed = upsertSchema.safeParse(request.body);
    if (!parsed.success) {
      return sendApiError(reply, request, 400, "ValidationError", undefined, zodValidationExtras(parsed.error));
    }
    try {
      const result = await upsertGeoBoundary(
        request.tenant!.id,
        parsed.data,
        actorUserIdOrNull(request)
      );
      return reply.send(result);
    } catch (e) {
      if (e instanceof GeoBoundaryOverlapError) {
        return reply.status(409).send({
          error: "GeoBoundaryOverlap",
          message: e.message,
          conflicts: e.conflicts
        });
      }
      const msg = e instanceof Error ? e.message : "Save failed";
      return sendApiError(reply, request, 400, "GeoBoundarySaveFailed", msg);
    }
  });

  app.delete("/api/:slug/geo-boundaries/:id", { preHandler }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const id = String((request.params as { id: string }).id ?? "").trim();
    if (!id) return sendApiError(reply, request, 400, "ValidationError", "id required");
    try {
      await deleteGeoBoundary(request.tenant!.id, id, actorUserIdOrNull(request));
      return reply.send({ ok: true });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (msg === "NOT_FOUND") return sendApiError(reply, request, 404, "NotFound");
      if (msg === "ALREADY_VOIDED") return sendApiError(reply, request, 409, "AlreadyVoided");
      throw e;
    }
  });

  app.post("/api/:slug/geo-boundaries/:id/restore", { preHandler }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const id = String((request.params as { id: string }).id ?? "").trim();
    if (!id) return sendApiError(reply, request, 400, "ValidationError", "id required");
    try {
      await restoreGeoBoundary(request.tenant!.id, id, actorUserIdOrNull(request));
      return reply.send({ ok: true });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (msg === "NOT_FOUND") return sendApiError(reply, request, 404, "NotFound");
      if (msg === "NOT_VOIDED") return sendApiError(reply, request, 409, "NotVoided");
      throw e;
    }
  });

  app.post("/api/:slug/geo-boundaries/:id/assign-clients", { preHandler }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const id = String((request.params as { id: string }).id ?? "").trim();
    if (!id) return sendApiError(reply, request, 400, "ValidationError", "id required");
    try {
      const updated = await assignClientsInBoundaryById(request.tenant!.id, id);
      return reply.send({ updated });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Assign failed";
      return sendApiError(reply, request, 400, "GeoBoundaryAssignFailed", msg);
    }
  });
}
