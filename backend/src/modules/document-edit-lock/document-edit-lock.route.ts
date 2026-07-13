import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { sendApiError, zodValidationExtras } from "../../lib/api-error";
import { actorUserIdOrNull } from "../../lib/request-actor";
import { ensureTenantContext } from "../../lib/tenant-context";
import {
  DOCUMENT_EDIT_LOCK_SECTIONS,
  isDocumentEditLockSection,
  normalizeDocumentEditLockSettings
} from "../../lib/document-edit-lock";
import {
  loadDocumentEditLockSettings,
  saveDocumentEditLockSettings
} from "../../lib/document-edit-lock.assert";
import { appendTenantAuditEvent, AuditEntityType } from "../../lib/tenant-audit";
import { jwtAccessVerify, requireRoles } from "../auth/auth.prehandlers";
import { invalidateTenantSettingsCache } from "../../lib/redis-cache";
import {
  batchCreateDocumentEditGrants,
  listActiveDocumentEditGrants,
  revokeDocumentEditGrant
} from "./document-edit-lock.grants";
import { searchDocumentsForEditLock } from "./document-edit-lock.search";

const adminRoles = ["admin"] as const;

const sectionConfigSchema = z.object({
  enabled: z.boolean(),
  days: z.number().int().min(1).max(365)
});

const settingsSchema = z.object({
  enabled: z.boolean(),
  sections: z.object({
    payments: sectionConfigSchema,
    orders: sectionConfigSchema,
    returns: sectionConfigSchema,
    stock: sectionConfigSchema,
    expenses: sectionConfigSchema,
    opening_balances: sectionConfigSchema
  })
});

const batchGrantSchema = z.object({
  items: z
    .array(
      z.object({
        section: z.enum(DOCUMENT_EDIT_LOCK_SECTIONS),
        document_id: z.number().int().positive(),
        document_kind: z.string().max(32).nullable().optional()
      })
    )
    .min(1)
    .max(100),
  user_ids: z.array(z.number().int().positive()).min(1).max(50),
  duration_minutes: z.number().int().min(1).max(24 * 60),
  comment: z.string().max(2000).nullable().optional()
});

export async function registerDocumentEditLockRoutes(app: FastifyInstance) {
  app.get(
    "/api/:slug/settings/document-edit-lock",
    { preHandler: [jwtAccessVerify, requireRoles(...adminRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const settings = await loadDocumentEditLockSettings(request.tenant!.id);
      return reply.send({ settings });
    }
  );

  app.patch(
    "/api/:slug/settings/document-edit-lock",
    { preHandler: [jwtAccessVerify, requireRoles(...adminRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const parsed = settingsSchema.safeParse(request.body);
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
        const settings = await saveDocumentEditLockSettings(
          request.tenant!.id,
          normalizeDocumentEditLockSettings(parsed.data)
        );
        await invalidateTenantSettingsCache(request.tenant!.id);
        await appendTenantAuditEvent({
          tenantId: request.tenant!.id,
          actorUserId: actorUserIdOrNull(request),
          entityType: AuditEntityType.tenant_settings,
          entityId: "document_edit_lock",
          action: "document_edit_lock.patch",
          payload: settings as unknown as Record<string, unknown>
        });
        return reply.send({ settings });
      } catch (e) {
        if (e instanceof Error && e.message === "NOT_FOUND") {
          return sendApiError(reply, request, 404, "NotFound");
        }
        throw e;
      }
    }
  );

  app.get(
    "/api/:slug/settings/document-edit-lock/search",
    { preHandler: [jwtAccessVerify, requireRoles(...adminRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const q = request.query as Record<string, string | undefined>;
      const section = (q.section ?? "").trim();
      if (!isDocumentEditLockSection(section)) {
        return sendApiError(reply, request, 400, "ValidationError", "Invalid section");
      }
      const documentIdRaw = q.document_id?.trim();
      const documentId = documentIdRaw
        ? Number.parseInt(documentIdRaw, 10)
        : undefined;
      if (documentIdRaw && (!Number.isFinite(documentId) || (documentId ?? 0) < 1)) {
        return sendApiError(reply, request, 400, "ValidationError", "Invalid document_id");
      }
      const data = await searchDocumentsForEditLock({
        tenantId: request.tenant!.id,
        section,
        documentId,
        dateFrom: q.date_from,
        dateTo: q.date_to
      });
      return reply.send({ data });
    }
  );

  app.get(
    "/api/:slug/settings/document-edit-lock/grants",
    { preHandler: [jwtAccessVerify, requireRoles(...adminRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const data = await listActiveDocumentEditGrants(request.tenant!.id);
      return reply.send({ data });
    }
  );

  app.post(
    "/api/:slug/settings/document-edit-lock/grants",
    { preHandler: [jwtAccessVerify, requireRoles(...adminRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const parsed = batchGrantSchema.safeParse(request.body);
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
        const payload = await batchCreateDocumentEditGrants({
          tenantId: request.tenant!.id,
          actorUserId: actorUserIdOrNull(request),
          items: parsed.data.items,
          userIds: parsed.data.user_ids,
          durationMinutes: parsed.data.duration_minutes,
          comment: parsed.data.comment
        });
        return reply.status(201).send(payload);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        if (msg === "NO_USERS" || msg === "NO_ITEMS" || msg === "BAD_USER" || msg === "TOO_MANY") {
          return sendApiError(reply, request, 400, msg);
        }
        throw e;
      }
    }
  );

  app.post(
    "/api/:slug/settings/document-edit-lock/grants/:id/revoke",
    { preHandler: [jwtAccessVerify, requireRoles(...adminRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const id = Number.parseInt((request.params as { id: string }).id, 10);
      if (!Number.isFinite(id) || id < 1) {
        return sendApiError(reply, request, 400, "InvalidId");
      }
      try {
        await revokeDocumentEditGrant({
          tenantId: request.tenant!.id,
          grantId: id,
          actorUserId: actorUserIdOrNull(request)
        });
        return reply.status(204).send();
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        if (msg === "NOT_FOUND") return sendApiError(reply, request, 404, "NotFound");
        if (msg === "NOT_ACTIVE") return sendApiError(reply, request, 409, "NotActive");
        throw e;
      }
    }
  );
}
