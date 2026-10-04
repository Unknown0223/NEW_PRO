import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { positiveIntPathIdParamsSchema } from "../../contracts/route-params.schemas";
import { sendApiError, zodValidationExtras } from "../../lib/api-error";
import { ensureTenantContext } from "../../lib/tenant-context";
import { getAccessUser, jwtAccessVerify, requireAnyPermission } from "../auth/auth.prehandlers";
import { listSupervisorLinkedAgents } from "../mobile/mobile-supervisor-kpi.service";
import {
  TASK_PRIORITIES,
  TASK_STATUSES,
  cancelTask,
  createTask,
  getTask,
  listTaskAssignees,
  listTasks,
  loadTaskTypes,
  updateTask,
  type TaskScope
} from "./tasks.service";

const VIEW = "staff.zadachi_spisok.view";
const CREATE = "staff.zadachi_spisok.create";
const UPDATE = "staff.zadachi_spisok.update";
const CANCEL = "staff.zadachi_spisok.delete";

export const taskInputSchema = z.object({
  title: z.string().trim().min(1).max(500),
  description: z.string().max(4000).nullable().optional(),
  task_type_ref: z.string().max(128).nullable().optional(),
  priority: z.enum(TASK_PRIORITIES).optional(),
  due_at: z.string().max(40).nullable().optional(),
  assignee_user_id: z.number().int().positive(),
  client_id: z.number().int().positive().nullable().optional()
});

const listQuerySchema = z.object({
  status: z.enum([...TASK_STATUSES, "active", "overdue"]).optional(),
  assignee_user_id: z.coerce.number().int().positive().optional(),
  created_by_user_id: z.coerce.number().int().positive().optional(),
  task_type_ref: z.string().max(128).optional(),
  client_id: z.coerce.number().int().positive().optional(),
  due_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  due_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  q: z.string().max(200).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(500).default(50)
});

const TASK_ERRORS: Record<string, [number, string]> = {
  NOT_FOUND: [404, "NotFound"],
  TASK_CLOSED: [409, "TaskClosed"],
  ASSIGNEE_NOT_FOUND: [400, "AssigneeNotFound"],
  CLIENT_NOT_FOUND: [400, "ClientNotFound"],
  VALIDATION: [400, "ValidationError"]
};

export function sendTaskError(reply: FastifyReply, request: FastifyRequest, e: unknown) {
  const hit = e instanceof Error ? TASK_ERRORS[e.message] : undefined;
  if (!hit) throw e;
  return sendApiError(reply, request, hit[0], hit[1]);
}

/** Webdagi supervayzer faqat o'zi bergan va o'z agentlariga berilgan topshiriqlarni ko'radi. */
async function webScope(request: FastifyRequest): Promise<TaskScope> {
  const viewer = getAccessUser(request);
  if (viewer.role !== "supervisor") return null;
  const me = Number(viewer.sub);
  const agents = await listSupervisorLinkedAgents(request.tenant!.id, me);
  return { createdBy: me, userIds: [me, ...agents.map((a) => a.id)] };
}

function dayBound(ymd: string | undefined, end: boolean): Date | undefined {
  if (!ymd) return undefined;
  return new Date(`${ymd}T${end ? "23:59:59.999" : "00:00:00.000"}+05:00`);
}

export async function registerTaskRoutes(app: FastifyInstance) {
  app.get("/api/:slug/tasks", { preHandler: [jwtAccessVerify, requireAnyPermission([VIEW])] }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const q = listQuerySchema.safeParse(request.query ?? {});
    if (!q.success) return sendApiError(reply, request, 400, "ValidationError", undefined, zodValidationExtras(q.error));
    const { due_from, due_to, ...rest } = q.data;
    const data = await listTasks(
      request.tenant!.id,
      { ...rest, due_from: dayBound(due_from, false), due_to: dayBound(due_to, true) },
      await webScope(request)
    );
    return reply.send(data);
  });

  app.get(
    "/api/:slug/tasks/meta",
    { preHandler: [jwtAccessVerify, requireAnyPermission([VIEW, CREATE, UPDATE])] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const scope = await webScope(request);
      const [types, assignees] = await Promise.all([
        loadTaskTypes(request.tenant!.id),
        listTaskAssignees(request.tenant!.id, scope?.userIds)
      ]);
      return reply.send({ data: { types, assignees, statuses: TASK_STATUSES, priorities: TASK_PRIORITIES } });
    }
  );

  app.get("/api/:slug/tasks/:id", { preHandler: [jwtAccessVerify, requireAnyPermission([VIEW])] }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const p = positiveIntPathIdParamsSchema.safeParse(request.params);
    if (!p.success) return sendApiError(reply, request, 400, "InvalidId");
    try {
      return reply.send({ data: await getTask(request.tenant!.id, p.data.id, await webScope(request)) });
    } catch (e) {
      return sendTaskError(reply, request, e);
    }
  });

  app.post("/api/:slug/tasks", { preHandler: [jwtAccessVerify, requireAnyPermission([CREATE])] }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const body = taskInputSchema.safeParse(request.body ?? {});
    if (!body.success) return sendApiError(reply, request, 400, "ValidationError", undefined, zodValidationExtras(body.error));
    const scope = await webScope(request);
    if (scope && !scope.userIds.includes(body.data.assignee_user_id)) return sendApiError(reply, request, 403, "ForbiddenScope");
    try {
      const data = await createTask(request.tenant!.id, Number(getAccessUser(request).sub), body.data);
      return reply.status(201).send({ data });
    } catch (e) {
      return sendTaskError(reply, request, e);
    }
  });

  app.patch("/api/:slug/tasks/:id", { preHandler: [jwtAccessVerify, requireAnyPermission([UPDATE])] }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const p = positiveIntPathIdParamsSchema.safeParse(request.params);
    if (!p.success) return sendApiError(reply, request, 400, "InvalidId");
    const body = taskInputSchema.partial().safeParse(request.body ?? {});
    if (!body.success) return sendApiError(reply, request, 400, "ValidationError", undefined, zodValidationExtras(body.error));
    const scope = await webScope(request);
    if (scope && body.data.assignee_user_id && !scope.userIds.includes(body.data.assignee_user_id)) {
      return sendApiError(reply, request, 403, "ForbiddenScope");
    }
    try {
      return reply.send({ data: await updateTask(request.tenant!.id, p.data.id, body.data, scope) });
    } catch (e) {
      return sendTaskError(reply, request, e);
    }
  });

  app.post(
    "/api/:slug/tasks/:id/cancel",
    { preHandler: [jwtAccessVerify, requireAnyPermission([CANCEL])] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const p = positiveIntPathIdParamsSchema.safeParse(request.params);
      if (!p.success) return sendApiError(reply, request, 400, "InvalidId");
      try {
        return reply.send({ data: await cancelTask(request.tenant!.id, p.data.id, await webScope(request)) });
      } catch (e) {
        return sendTaskError(reply, request, e);
      }
    }
  );
}
