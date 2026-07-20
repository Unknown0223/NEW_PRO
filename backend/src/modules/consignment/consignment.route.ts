import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { prisma } from "../../config/database";
import { sendApiError, zodValidationExtras } from "../../lib/api-error";
import { ensureTenantContext } from "../../lib/tenant-context";
import { actorUserIdOrNull } from "../../lib/request-actor";
import { ADMIN_AND_OPERATOR_LIKE_ROLES } from "../../lib/tenant-user-roles";
import { getAccessUser, jwtAccessVerify, requireRoles } from "../auth/auth.prehandlers";
import {
  bulkPatchConsignmentAgentRows,
  bulkPatchConsignmentAgents,
  getConsignmentSettings,
  listConsignmentAgents,
  patchConsignmentSettingsForTenant,
  type ConsignmentAgentRow,
  type ListConsignmentAgentsQuery
} from "./consignment.service";
import {
  buildConsignmentImportTemplateBuffer,
  importConsignmentLimitsFromBuffer
} from "./consignment-import.xlsx";

async function readConsignmentImportBuffer(
  request: FastifyRequest
): Promise<{ ok: true; buf: Buffer } | { ok: false; error: "NoFile" | "EmptyFile" }> {
  const file = await request.file();
  if (!file) return { ok: false, error: "NoFile" };
  const buf = await file.toBuffer();
  if (buf.length === 0) return { ok: false, error: "EmptyFile" };
  return { ok: true, buf };
}

/** Faqat faol agentlar — eski worker xotirasida servis filtri qolmasa ham. */
async function retainOnlyActiveConsignmentRows(
  tenantId: number,
  rows: ConsignmentAgentRow[]
): Promise<ConsignmentAgentRow[]> {
  if (rows.length === 0) return rows;
  const activeIds = new Set(
    (
      await prisma.user.findMany({
        where: {
          tenant_id: tenantId,
          role: "agent",
          is_active: true,
          id: { in: rows.map((r) => r.id) }
        },
        select: { id: true }
      })
    ).map((u) => u.id)
  );
  return rows.filter((r) => activeIds.has(r.id)).map((r) => ({ ...r, is_active: true }));
}

const catalogRoles = ADMIN_AND_OPERATOR_LIKE_ROLES;

const listQuerySchema = z.object({
  year_month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  trade_direction_id: z.coerce.number().int().positive().optional(),
  supervisor_user_id: z.coerce.number().int().positive().optional(),
  agents_without_supervisor: z.union([z.literal("1"), z.literal("true")]).optional(),
  consignment: z.enum(["all", "yes", "no"]).optional(),
  search: z.string().optional(),
  sync_closures: z.union([z.literal("1"), z.literal("true")]).optional()
});

const bulkBodySchema = z.object({
  user_ids: z.array(z.number().int().positive()).min(1).max(500),
  consignment: z.boolean().optional(),
  consignment_limit_amount: z.union([z.string(), z.null()]).optional(),
  consignment_ignore_previous_months_debt: z.boolean().optional()
});

const bulkRowsBodySchema = z.object({
  rows: z
    .array(
      z.object({
        user_id: z.number().int().positive(),
        consignment: z.boolean(),
        consignment_limit_amount: z.union([z.string(), z.null()]),
        consignment_ignore_previous_months_debt: z.boolean()
      })
    )
    .min(1)
    .max(500)
});

const settingsBodySchema = z.object({
  month_close_day: z.number().int().min(1).max(31)
});

const importQuerySchema = z.object({
  trade_direction_id: z.coerce.number().int().positive()
});

export async function registerConsignmentRoutes(app: FastifyInstance) {
  app.get(
    "/api/:slug/consignment/settings",
    { preHandler: [jwtAccessVerify, requireRoles(...catalogRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const settings = await getConsignmentSettings(request.tenant!.id);
      return reply.send({ data: settings });
    }
  );

  app.patch(
    "/api/:slug/consignment/settings",
    { preHandler: [jwtAccessVerify, requireRoles(...catalogRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const parsed = settingsBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return sendApiError(reply, request, 400, "ValidationError", undefined, zodValidationExtras(parsed.error));
      }
      try {
        const actor = actorUserIdOrNull(request);
        const out = await patchConsignmentSettingsForTenant(
          request.tenant!.id,
          parsed.data.month_close_day,
          actor
        );
        return reply.send({ data: out });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        if (msg === "BAD_CLOSE_DAY") return sendApiError(reply, request, 400, "BadCloseDay");
        throw e;
      }
    }
  );

  app.get(
    "/api/:slug/consignment/agents",
    { preHandler: [jwtAccessVerify, requireRoles(...catalogRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const parsed = listQuerySchema.safeParse(request.query ?? {});
      if (!parsed.success) {
        return sendApiError(reply, request, 400, "ValidationError", undefined, zodValidationExtras(parsed.error));
      }
      const aw = parsed.data.agents_without_supervisor;
      const sync = parsed.data.sync_closures;
      const q: ListConsignmentAgentsQuery = {
        year_month: parsed.data.year_month,
        trade_direction_id: parsed.data.trade_direction_id,
        supervisor_user_id: parsed.data.supervisor_user_id,
        agents_without_supervisor:
          aw === "1" || aw === "true" ? true : undefined,
        consignment: parsed.data.consignment,
        search: parsed.data.search,
        sync_closures: sync === "1" || sync === "true" ? true : undefined
      };
      const tenantId = request.tenant!.id;
      const viewer = getAccessUser(request);
      const result = await listConsignmentAgents(tenantId, q, {
        userId: actorUserIdOrNull(request),
        role: viewer.role ?? ""
      });
      result.data = await retainOnlyActiveConsignmentRows(tenantId, result.data);
      return reply.send(result);
    }
  );

  app.patch(
    "/api/:slug/consignment/agents/bulk",
    { preHandler: [jwtAccessVerify, requireRoles(...catalogRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const parsed = bulkBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return sendApiError(reply, request, 400, "ValidationError", undefined, zodValidationExtras(parsed.error));
      }
      try {
        const actor = actorUserIdOrNull(request);
        const out = await bulkPatchConsignmentAgents(request.tenant!.id, parsed.data, actor);
        return reply.send(out);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        if (msg === "EMPTY_IDS") return sendApiError(reply, request, 400, "EmptyIds");
        if (msg === "TOO_MANY_IDS") return sendApiError(reply, request, 400, "TooManyIds");
        if (msg === "EMPTY_PATCH") return sendApiError(reply, request, 400, "EmptyPatch");
        if (msg === "BAD_LIMIT") return sendApiError(reply, request, 400, "BadLimit");
        throw e;
      }
    }
  );

  app.patch(
    "/api/:slug/consignment/agents/bulk-rows",
    { preHandler: [jwtAccessVerify, requireRoles(...catalogRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const parsed = bulkRowsBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return sendApiError(reply, request, 400, "ValidationError", undefined, zodValidationExtras(parsed.error));
      }
      try {
        const actor = actorUserIdOrNull(request);
        const out = await bulkPatchConsignmentAgentRows(
          request.tenant!.id,
          parsed.data.rows,
          actor
        );
        return reply.send(out);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        if (msg === "EMPTY_ROWS") return sendApiError(reply, request, 400, "EmptyRows");
        if (msg === "TOO_MANY_ROWS") return sendApiError(reply, request, 400, "TooManyRows");
        if (msg === "BAD_LIMIT") return sendApiError(reply, request, 400, "BadLimit");
        if (msg === "BAD_AGENT_ROW") {
          return sendApiError(
            reply,
            request,
            409,
            "BadAgentRow",
            "Один из агентов не найден или не принадлежит тенанту"
          );
        }
        throw e;
      }
    }
  );

  app.get(
    "/api/:slug/consignment/import-template",
    { preHandler: [jwtAccessVerify, requireRoles(...catalogRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const parsed = importQuerySchema.safeParse(request.query ?? {});
      if (!parsed.success) {
        return sendApiError(reply, request, 400, "ValidationError", undefined, zodValidationExtras(parsed.error));
      }
      const buf = await buildConsignmentImportTemplateBuffer(
        request.tenant!.id,
        parsed.data.trade_direction_id
      );
      reply.header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      reply.header(
        "Content-Disposition",
        'attachment; filename="konsignatsiya-import-shablon.xlsx"'
      );
      return reply.send(buf);
    }
  );

  app.get(
    "/api/:slug/consignment/import-template.xlsx",
    { preHandler: [jwtAccessVerify, requireRoles(...catalogRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const parsed = importQuerySchema.safeParse(request.query ?? {});
      if (!parsed.success) {
        return sendApiError(reply, request, 400, "ValidationError", undefined, zodValidationExtras(parsed.error));
      }
      const buf = await buildConsignmentImportTemplateBuffer(
        request.tenant!.id,
        parsed.data.trade_direction_id
      );
      reply.header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      reply.header(
        "Content-Disposition",
        'attachment; filename="konsignatsiya-import-shablon.xlsx"'
      );
      return reply.send(buf);
    }
  );

  app.post(
    "/api/:slug/consignment/import.xlsx",
    { preHandler: [jwtAccessVerify, requireRoles(...catalogRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const parsed = importQuerySchema.safeParse(request.query ?? {});
      if (!parsed.success) {
        return sendApiError(reply, request, 400, "ValidationError", undefined, zodValidationExtras(parsed.error));
      }
      const read = await readConsignmentImportBuffer(request);
      if (!read.ok) {
        if (read.error === "NoFile") return sendApiError(reply, request, 400, "NoFile");
        return sendApiError(reply, request, 400, "EmptyFile");
      }
      try {
        const result = await importConsignmentLimitsFromBuffer(
          request.tenant!.id,
          parsed.data.trade_direction_id,
          read.buf,
          actorUserIdOrNull(request)
        );
        return reply.send({ data: result });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        if (msg === "EMPTY_FILE") return sendApiError(reply, request, 400, "EmptyFile");
        if (msg === "BAD_HEADERS") return sendApiError(reply, request, 400, "BadHeaders");
        if (msg === "EMPTY_ROWS") return sendApiError(reply, request, 400, "EmptyRows");
        if (msg === "TOO_MANY_ROWS") return sendApiError(reply, request, 400, "TooManyRows");
        throw e;
      }
    }
  );
}
