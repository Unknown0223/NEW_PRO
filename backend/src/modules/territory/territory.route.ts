import type { FastifyInstance } from "fastify";
import { sendApiError } from "../../lib/api-error";
import { appendTenantAuditEvent } from "../../lib/tenant-audit";
import { ensureTenantContext } from "../../lib/tenant-context";
import { actorUserIdOrNull } from "../../lib/request-actor";
import { jwtAccessVerify, getAccessUser } from "../auth/auth.prehandlers";
import {
  listTerritories,
  getTerritory,
  createTerritory,
  updateTerritory,
  deleteTerritory,
  restoreTerritory,
  assignUser,
  unassignUser,
  validateCheckin,
  getTerritoryStats
} from "./territory.service";
import { getAgentPickerContextForAddress } from "../linkage/linkage.service";

export async function registerTerritoryRoutes(app: FastifyInstance) {
  const preHandler = [jwtAccessVerify];

  app.get("/api/:slug/territories", { preHandler }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const q = request.query as Record<string, string | undefined>;
    const archiveRaw = q.archive?.trim().toLowerCase();
    const archive = archiveRaw === "true" || archiveRaw === "1" || archiveRaw === "yes";
    const data = await listTerritories(request.tenant!.id, {
      page: q.page ? parseInt(q.page) : 1,
      limit: q.limit ? parseInt(q.limit) : 50,
      q: q.q?.trim() || undefined,
      is_active: q.is_active === "true" ? true : q.is_active === "false" ? false : undefined,
      archive
    });
    return reply.send(data);
  });

  /** Klient kartasi: viloyat/shahar/zona yoki GPS bo‘yicha biriktirilgan agentlar (`territory_user_links`). */
  app.get("/api/:slug/territories/agent-picker-context", { preHandler }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const q = request.query as Record<string, string | undefined>;
    const latRaw = q.latitude?.trim() ?? "";
    const lngRaw = q.longitude?.trim() ?? "";
    const ctx = await getAgentPickerContextForAddress(request.tenant!.id, {
      region: q.region?.trim() ? q.region.trim() : null,
      city: q.city?.trim() ? q.city.trim() : null,
      district: q.district?.trim() ? q.district.trim() : null,
      zone: q.zone?.trim() ? q.zone.trim() : null,
      latitude: latRaw.length > 0 ? latRaw.replace(",", ".") : null,
      longitude: lngRaw.length > 0 ? lngRaw.replace(",", ".") : null
    });
    return reply.send(ctx);
  });

  app.get("/api/:slug/territories/:id", { preHandler }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const data = await getTerritory(request.tenant!.id, parseInt((request.params as any).id));
    return reply.send(data);
  });

  app.post("/api/:slug/territories", { preHandler }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const data = await createTerritory(request.tenant!.id, request.body as any);
    await appendTenantAuditEvent({
      tenantId: request.tenant!.id,
      actorUserId: actorUserIdOrNull(request),
      entityType: "territory",
      entityId: (data as { id?: number })?.id ?? "—",
      action: "territory.create",
      payload: {
        name: (data as { name?: string })?.name ?? (request.body as { name?: string })?.name ?? null
      }
    });
    return reply.status(201).send(data);
  });

  app.patch("/api/:slug/territories/:id", { preHandler }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    try {
      const data = await updateTerritory(
        request.tenant!.id,
        parseInt((request.params as any).id),
        request.body as any
      );
      if (!data) return sendApiError(reply, request, 404, "NotFound");
      await appendTenantAuditEvent({
        tenantId: request.tenant!.id,
        actorUserId: actorUserIdOrNull(request),
        entityType: "territory",
        entityId: parseInt((request.params as any).id),
        action: "territory.update",
        payload: { fields: Object.keys((request.body as Record<string, unknown>) ?? {}) }
      });
      return reply.send(data);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (msg === "VOIDED") return sendApiError(reply, request, 409, "Voided");
      if (msg === "CodeTaken") return sendApiError(reply, request, 409, "CodeTaken");
      throw e;
    }
  });

  app.delete("/api/:slug/territories/:id", { preHandler }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const id = Number.parseInt((request.params as { id: string }).id, 10);
    if (Number.isNaN(id) || id < 1) {
      return sendApiError(reply, request, 400, "InvalidId");
    }
    try {
      await deleteTerritory(request.tenant!.id, id, actorUserIdOrNull(request));
      await appendTenantAuditEvent({
        tenantId: request.tenant!.id,
        actorUserId: actorUserIdOrNull(request),
        entityType: "territory",
        entityId: id,
        action: "territory.delete",
        payload: { id }
      });
      return reply.status(204).send();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (msg === "NOT_FOUND") return sendApiError(reply, request, 404, "NotFound");
      if (msg === "ALREADY_VOIDED") return sendApiError(reply, request, 409, "AlreadyVoided");
      throw e;
    }
  });

  app.post("/api/:slug/territories/:id/restore", { preHandler }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const id = Number.parseInt((request.params as { id: string }).id, 10);
    if (Number.isNaN(id) || id < 1) {
      return sendApiError(reply, request, 400, "InvalidId");
    }
    try {
      await restoreTerritory(request.tenant!.id, id);
      await appendTenantAuditEvent({
        tenantId: request.tenant!.id,
        actorUserId: actorUserIdOrNull(request),
        entityType: "territory",
        entityId: id,
        action: "territory.restore",
        payload: { id }
      });
      return reply.status(204).send();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (msg === "NOT_FOUND") return sendApiError(reply, request, 404, "NotFound");
      if (msg === "NOT_VOIDED") return sendApiError(reply, request, 409, "NotVoided");
      throw e;
    }
  });

  app.post("/api/:slug/territories/:id/assign", { preHandler }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const body = request.body as { userId: number };
    const jwtUser = getAccessUser(request);
    const territoryId = parseInt((request.params as any).id);
    const data = await assignUser(
      request.tenant!.id,
      territoryId,
      body.userId,
      Number(jwtUser.sub)
    );
    await appendTenantAuditEvent({
      tenantId: request.tenant!.id,
      actorUserId: Number(jwtUser.sub),
      entityType: "territory",
      entityId: territoryId,
      action: "territory.assign",
      payload: { territory_id: territoryId, target_user_id: body.userId }
    });
    return reply.send(data);
  });

  app.post("/api/:slug/territories/:id/unassign", { preHandler }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const body = request.body as { userId: number };
    const territoryId = parseInt((request.params as any).id);
    await unassignUser(request.tenant!.id, territoryId, body.userId);
    await appendTenantAuditEvent({
      tenantId: request.tenant!.id,
      actorUserId: actorUserIdOrNull(request),
      entityType: "territory",
      entityId: territoryId,
      action: "territory.unassign",
      payload: { territory_id: territoryId, target_user_id: body.userId }
    });
    return reply.status(204).send();
  });

  app.post("/api/:slug/territories/:id/validate-checkin", { preHandler }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const body = request.body as { lat: number; lng: number };
    const data = await validateCheckin(request.tenant!.id, parseInt((request.params as any).id), body.lat, body.lng);
    return reply.send(data);
  });

  app.get("/api/:slug/territories/stats", { preHandler }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const q = request.query as Record<string, string | undefined>;
    const data = await getTerritoryStats(request.tenant!.id, { from: q.from, to: q.to });
    return reply.send(data);
  });
}
