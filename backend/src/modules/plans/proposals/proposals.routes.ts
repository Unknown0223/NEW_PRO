import type { FastifyInstance } from "fastify";
import { sendApiError, zodValidationExtras } from "../../../lib/api-error";
import { ensureTenantContext } from "../../../lib/tenant-context";
import { actorUserIdOrNull } from "../../../lib/request-actor";
import { jwtAccessVerify, requireRoles } from "../../auth/auth.prehandlers";
import { TENANT_ADMIN_ROLE } from "../../../lib/tenant-user-roles";
import { buildProposalContext } from "./proposals.context";
import { calculateProposalLive } from "./proposals.calculate";
import {
  findProposalForPeriod,
  getProposalById,
  patchProposal,
  upsertProposal
} from "./proposals.draft";
import { applyProposal } from "./proposals.apply";
import { exportProposalCsv } from "./proposals.export";
import { previousPeriod } from "./proposals.period";
import {
  applyProposalBodySchema,
  calculateBodySchema,
  contextQuerySchema,
  patchProposalBodySchema,
  saveProposalBodySchema
} from "./proposals.schema";

/** Hozircha faqat admin (preset + route). Keyin kengaytiriladi. */
const adminOnly = [TENANT_ADMIN_ROLE] as const;
const readRoles = adminOnly;
const writeRoles = adminOnly;
const applyRoles = adminOnly;

function mapErr(
  reply: Parameters<typeof sendApiError>[0],
  request: Parameters<typeof sendApiError>[1],
  e: unknown
) {
  const msg = e instanceof Error ? e.message : "";
  if (msg === "BAD_DIRECTION" || msg === "NO_KPI" || msg.startsWith("MISSING_CONFIG")) {
    return sendApiError(reply, request, 400, "ValidationError", msg);
  }
  if (msg === "NOT_FOUND") return sendApiError(reply, request, 404, "NotFound", msg);
  if (msg === "VERSION_CONFLICT") {
    return sendApiError(reply, request, 409, "Conflict", "VERSION_CONFLICT");
  }
  if (msg === "NO_READY_ROWS") {
    return sendApiError(reply, request, 400, "ValidationError", "NO_READY_ROWS");
  }
  throw e;
}

export async function registerProposalRoutes(app: FastifyInstance) {
  const preRead = [jwtAccessVerify, requireRoles(...readRoles)];
  const preWrite = [jwtAccessVerify, requireRoles(...writeRoles)];
  const preApply = [jwtAccessVerify, requireRoles(...applyRoles)];

  app.get("/api/:slug/plans/proposals/context", { preHandler: preRead }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const q = contextQuerySchema.safeParse(request.query);
    if (!q.success) {
      return sendApiError(reply, request, 400, "ValidationError", undefined, zodValidationExtras(q.error));
    }
    try {
      const target = { year: q.data.target_year, month: q.data.target_month };
      const source =
        q.data.source_year != null && q.data.source_month != null
          ? { year: q.data.source_year, month: q.data.source_month }
          : previousPeriod(target);
      const data = await buildProposalContext(
        request.tenant!.id,
        q.data.direction_id,
        target,
        source
      );
      return reply.send({ data });
    } catch (e) {
      return mapErr(reply, request, e);
    }
  });

  app.post("/api/:slug/plans/proposals/calculate", { preHandler: preRead }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const parsed = calculateBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return sendApiError(reply, request, 400, "ValidationError", undefined, zodValidationExtras(parsed.error));
    }
    try {
      const data = await calculateProposalLive(request.tenant!.id, parsed.data);
      return reply.send({ data });
    } catch (e) {
      return mapErr(reply, request, e);
    }
  });

  app.get("/api/:slug/plans/proposals", { preHandler: preRead }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const q = contextQuerySchema.safeParse(request.query);
    if (!q.success) {
      return sendApiError(reply, request, 400, "ValidationError", undefined, zodValidationExtras(q.error));
    }
    const data = await findProposalForPeriod(
      request.tenant!.id,
      q.data.direction_id,
      q.data.target_year,
      q.data.target_month
    );
    return reply.send({ data });
  });

  app.post("/api/:slug/plans/proposals", { preHandler: preWrite }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const parsed = saveProposalBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return sendApiError(reply, request, 400, "ValidationError", undefined, zodValidationExtras(parsed.error));
    }
    try {
      const data = await upsertProposal(
        request.tenant!.id,
        parsed.data,
        actorUserIdOrNull(request)
      );
      return reply.code(201).send({ data });
    } catch (e) {
      return mapErr(reply, request, e);
    }
  });

  app.get("/api/:slug/plans/proposals/:id", { preHandler: preRead }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const id = Number((request.params as { id: string }).id);
    if (!Number.isFinite(id)) return sendApiError(reply, request, 400, "ValidationError", "BAD_ID");
    try {
      const data = await getProposalById(request.tenant!.id, id);
      return reply.send({ data });
    } catch (e) {
      return mapErr(reply, request, e);
    }
  });

  app.patch("/api/:slug/plans/proposals/:id", { preHandler: preWrite }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const id = Number((request.params as { id: string }).id);
    if (!Number.isFinite(id)) return sendApiError(reply, request, 400, "ValidationError", "BAD_ID");
    const parsed = patchProposalBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return sendApiError(reply, request, 400, "ValidationError", undefined, zodValidationExtras(parsed.error));
    }
    try {
      const data = await patchProposal(
        request.tenant!.id,
        id,
        parsed.data,
        actorUserIdOrNull(request)
      );
      return reply.send({ data });
    } catch (e) {
      return mapErr(reply, request, e);
    }
  });

  app.post("/api/:slug/plans/proposals/:id/apply", { preHandler: preApply }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const id = Number((request.params as { id: string }).id);
    if (!Number.isFinite(id)) return sendApiError(reply, request, 400, "ValidationError", "BAD_ID");
    const parsed = applyProposalBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return sendApiError(reply, request, 400, "ValidationError", undefined, zodValidationExtras(parsed.error));
    }
    try {
      const data = await applyProposal(
        request.tenant!.id,
        id,
        parsed.data,
        actorUserIdOrNull(request)
      );
      return reply.send({ data });
    } catch (e) {
      return mapErr(reply, request, e);
    }
  });

  app.get("/api/:slug/plans/proposals/:id/export", { preHandler: preRead }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const id = Number((request.params as { id: string }).id);
    if (!Number.isFinite(id)) return sendApiError(reply, request, 400, "ValidationError", "BAD_ID");
    try {
      const csv = await exportProposalCsv(request.tenant!.id, id);
      reply.header("Content-Type", "text/csv; charset=utf-8");
      reply.header("Content-Disposition", `attachment; filename="proposal-${id}.csv"`);
      return reply.send(csv);
    } catch (e) {
      return mapErr(reply, request, e);
    }
  });
}
