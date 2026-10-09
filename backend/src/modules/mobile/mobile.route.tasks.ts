import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { positiveIntPathIdParamsSchema } from "../../contracts/route-params.schemas";
import { sendApiError, zodValidationExtras } from "../../lib/api-error";
import { ensureTenantContext } from "../../lib/tenant-context";
import { ensureAnyPermission } from "../access/ensure-any-permission";
import { getAccessUser } from "../auth/auth.prehandlers";
import { sendTaskError, taskInputSchema } from "../tasks/tasks.route";
import {
  TASK_MAX_PHOTOS,
  TASK_STATUSES,
  cancelTask,
  completeTask,
  createTask,
  getTask,
  listTaskAssignees,
  listTasks,
  loadTaskTypes,
  startTask,
  type TaskScope
} from "../tasks/tasks.service";
import { listSupervisorLinkedAgents } from "./mobile-supervisor-kpi.service";
import { mobileJwtRoles } from "./mobile.route.shared";

const TASK_PHOTO_MAX_BASE64_LEN = Math.ceil((8 * 1024 * 1024 * 4) / 3);

const listQuerySchema = z.object({
  scope: z.enum(["mine", "team"]).default("mine"),
  status: z.enum([...TASK_STATUSES, "active", "overdue"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(100)
});

const completeBodySchema = z.object({
  comment: z.string().max(2000).nullable().optional(),
  photos: z.array(z.string().min(80).max(TASK_PHOTO_MAX_BASE64_LEN)).max(TASK_MAX_PHOTOS).optional()
});

function viewerOf(request: FastifyRequest) {
  const v = getAccessUser(request);
  return { id: Number(v.sub), role: v.role };
}

/** Supervayzer: o'zi bergan va o'z agentlariga berilgan topshiriqlar; boshqalar: faqat o'ziga berilgan. */
async function teamScope(request: FastifyRequest): Promise<TaskScope> {
  const me = viewerOf(request);
  if (me.role !== "supervisor") return { createdBy: -1, userIds: [me.id] };
  const agents = await listSupervisorLinkedAgents(request.tenant!.id, me.id);
  return { createdBy: me.id, userIds: [me.id, ...agents.map((a) => a.id)] };
}

export async function registerMobileTaskRoutes(app: FastifyInstance) {
  app.get("/api/:slug/mobile/tasks", { preHandler: [...mobileJwtRoles] }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const q = listQuerySchema.safeParse(request.query ?? {});
    if (!q.success) return sendApiError(reply, request, 400, "ValidationError", undefined, zodValidationExtras(q.error));
    const me = viewerOf(request);
    const { scope, ...filter } = q.data;
    const data =
      scope === "team" && me.role === "supervisor"
        ? await listTasks(request.tenant!.id, filter, await teamScope(request))
        : await listTasks(request.tenant!.id, { ...filter, assignee_user_id: me.id }, null);
    return reply.send(data);
  });

  app.get("/api/:slug/mobile/tasks/meta", { preHandler: [...mobileJwtRoles] }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const me = viewerOf(request);
    const agents = me.role === "supervisor" ? await listSupervisorLinkedAgents(request.tenant!.id, me.id) : [];
    const [types, assignees] = await Promise.all([
      loadTaskTypes(request.tenant!.id),
      agents.length > 0 ? listTaskAssignees(request.tenant!.id, agents.map((a) => a.id)) : Promise.resolve([])
    ]);
    return reply.send({ data: { types, assignees, can_create: me.role === "supervisor" } });
  });

  app.get("/api/:slug/mobile/tasks/:id", { preHandler: [...mobileJwtRoles] }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const p = positiveIntPathIdParamsSchema.safeParse(request.params);
    if (!p.success) return sendApiError(reply, request, 400, "InvalidId");
    try {
      return reply.send({ data: await getTask(request.tenant!.id, p.data.id, await teamScope(request)) });
    } catch (e) {
      return sendTaskError(reply, request, e);
    }
  });

  app.post("/api/:slug/mobile/tasks", { preHandler: [...mobileJwtRoles] }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const me = viewerOf(request);
    if (me.role !== "supervisor") return sendApiError(reply, request, 403, "ForbiddenRole");
    if (!(await ensureAnyPermission(request, reply, ["staff.zadachi_spisok.create"]))) return;
    const body = taskInputSchema.safeParse(request.body ?? {});
    if (!body.success) return sendApiError(reply, request, 400, "ValidationError", undefined, zodValidationExtras(body.error));
    const scope = await teamScope(request);
    if (!scope || !scope.userIds.includes(body.data.assignee_user_id) || body.data.assignee_user_id === me.id) {
      return sendApiError(reply, request, 403, "ForbiddenScope");
    }
    try {
      return reply.status(201).send({ data: await createTask(request.tenant!.id, me.id, body.data) });
    } catch (e) {
      return sendTaskError(reply, request, e);
    }
  });

  app.post("/api/:slug/mobile/tasks/:id/cancel", { preHandler: [...mobileJwtRoles] }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const me = viewerOf(request);
    if (me.role !== "supervisor") return sendApiError(reply, request, 403, "ForbiddenRole");
    if (!(await ensureAnyPermission(request, reply, ["staff.zadachi_spisok.delete"]))) return;
    const p = positiveIntPathIdParamsSchema.safeParse(request.params);
    if (!p.success) return sendApiError(reply, request, 400, "InvalidId");
    try {
      return reply.send({ data: await cancelTask(request.tenant!.id, p.data.id, { createdBy: me.id, userIds: [] }) });
    } catch (e) {
      return sendTaskError(reply, request, e);
    }
  });

  app.post("/api/:slug/mobile/tasks/:id/start", { preHandler: [...mobileJwtRoles] }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const p = positiveIntPathIdParamsSchema.safeParse(request.params);
    if (!p.success) return sendApiError(reply, request, 400, "InvalidId");
    try {
      return reply.send({ data: await startTask(request.tenant!.id, p.data.id, viewerOf(request).id) });
    } catch (e) {
      return sendTaskError(reply, request, e);
    }
  });

  app.post(
    "/api/:slug/mobile/tasks/:id/complete",
    { preHandler: [...mobileJwtRoles], bodyLimit: TASK_PHOTO_MAX_BASE64_LEN * TASK_MAX_PHOTOS + 512 * 1024 },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const p = positiveIntPathIdParamsSchema.safeParse(request.params);
      if (!p.success) return sendApiError(reply, request, 400, "InvalidId");
      const body = completeBodySchema.safeParse(request.body ?? {});
      if (!body.success) return sendApiError(reply, request, 400, "ValidationError", undefined, zodValidationExtras(body.error));
      try {
        return reply.send({ data: await completeTask(request.tenant!.id, p.data.id, viewerOf(request).id, body.data) });
      } catch (e) {
        return sendTaskError(reply, request, e);
      }
    }
  );
}
