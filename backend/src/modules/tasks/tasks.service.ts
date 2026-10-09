import type { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { MOBILE_FIELD_ROLE_NAMES } from "../../lib/constants";
import { toFio } from "../staff/staff.shared.helpers";
import { createNotification } from "../notifications/notifications.service";
import { getTenantProfile } from "../tenant-settings/tenant-settings.profile.read";

export const TASK_STATUSES = ["open", "in_progress", "done", "cancelled"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];
export const TASK_PRIORITIES = ["low", "normal", "high"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];
export const TASK_MAX_PHOTOS = 3;

export type TaskTypeRef = { id: string; name: string; code: string | null; color: string | null };

export type TaskInput = {
  title: string;
  description?: string | null;
  task_type_ref?: string | null;
  priority?: TaskPriority;
  due_at?: string | null;
  assignee_user_id: number;
  client_id?: number | null;
};

/** Kim qaysi topshiriqlarni ko'radi: `null` — hammasi (admin / ruxsat egasi). */
export type TaskScope = { userIds: number[]; createdBy: number } | null;

const userSelect = { id: true, name: true, first_name: true, last_name: true, middle_name: true, role: true } as const;

const taskSelect = {
  id: true,
  title: true,
  description: true,
  task_type_ref: true,
  status: true,
  priority: true,
  due_at: true,
  started_at: true,
  completed_at: true,
  cancelled_at: true,
  result_comment: true,
  created_at: true,
  updated_at: true,
  assignee: { select: userSelect },
  created_by: { select: userSelect },
  client: { select: { id: true, name: true, address: true, latitude: true, longitude: true } }
} satisfies Prisma.TenantTaskSelect;

type TaskRow = Prisma.TenantTaskGetPayload<{ select: typeof taskSelect }> & { result_photos?: Prisma.JsonValue };

export async function loadTaskTypes(tenantId: number, includeInactive = false): Promise<TaskTypeRef[]> {
  const profile = await getTenantProfile(tenantId);
  return (profile.references.task_type_entries ?? [])
    .filter((e) => includeInactive || e.active !== false)
    .map((e) => ({ id: e.id, name: e.name, code: e.code ?? null, color: e.color ?? null }));
}

function photosOf(v: Prisma.JsonValue | undefined): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

function personOf(u: TaskRow["assignee"]) {
  return u ? { id: u.id, name: toFio(u), role: u.role } : null;
}

export function serializeTask(row: TaskRow, types: readonly TaskTypeRef[], photoCount?: number) {
  const type = row.task_type_ref ? types.find((t) => t.id === row.task_type_ref || t.code === row.task_type_ref) : null;
  const photos = row.result_photos === undefined ? null : photosOf(row.result_photos);
  const open = row.status === "open" || row.status === "in_progress";
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status as TaskStatus,
    priority: row.priority as TaskPriority,
    due_at: row.due_at?.toISOString() ?? null,
    overdue: open && row.due_at != null && row.due_at.getTime() < Date.now(),
    started_at: row.started_at?.toISOString() ?? null,
    completed_at: row.completed_at?.toISOString() ?? null,
    cancelled_at: row.cancelled_at?.toISOString() ?? null,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
    task_type_ref: row.task_type_ref,
    task_type: type ? { id: type.id, name: type.name, color: type.color } : null,
    assignee: personOf(row.assignee),
    created_by: personOf(row.created_by),
    client: row.client
      ? {
          id: row.client.id,
          name: row.client.name,
          address: row.client.address,
          latitude: row.client.latitude != null ? Number(row.client.latitude) : null,
          longitude: row.client.longitude != null ? Number(row.client.longitude) : null
        }
      : null,
    result_comment: row.result_comment,
    result_photo_count: photos ? photos.length : (photoCount ?? 0),
    ...(photos ? { result_photos: photos } : {})
  };
}

export type TaskDto = ReturnType<typeof serializeTask>;

function scopeWhere(scope: TaskScope): Prisma.TenantTaskWhereInput {
  if (!scope) return {};
  return { OR: [{ created_by_user_id: scope.createdBy }, { assignee_user_id: { in: scope.userIds } }] };
}

export type TaskListFilter = {
  status?: TaskStatus | "active" | "overdue";
  assignee_user_id?: number;
  created_by_user_id?: number;
  task_type_ref?: string;
  client_id?: number;
  due_from?: Date;
  due_to?: Date;
  q?: string;
  page: number;
  limit: number;
};

export async function listTasks(tenantId: number, filter: TaskListFilter, scope: TaskScope) {
  const and: Prisma.TenantTaskWhereInput[] = [scopeWhere(scope)];
  if (filter.status === "active") and.push({ status: { in: ["open", "in_progress"] } });
  else if (filter.status === "overdue") and.push({ status: { in: ["open", "in_progress"] }, due_at: { lt: new Date() } });
  else if (filter.status) and.push({ status: filter.status });
  if (filter.assignee_user_id) and.push({ assignee_user_id: filter.assignee_user_id });
  if (filter.created_by_user_id) and.push({ created_by_user_id: filter.created_by_user_id });
  if (filter.task_type_ref) and.push({ task_type_ref: filter.task_type_ref });
  if (filter.client_id) and.push({ client_id: filter.client_id });
  if (filter.due_from || filter.due_to) and.push({ due_at: { gte: filter.due_from, lte: filter.due_to } });
  if (filter.q?.trim()) {
    const q = filter.q.trim();
    and.push({
      OR: [
        { title: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
        { client: { name: { contains: q, mode: "insensitive" } } }
      ]
    });
  }
  const where: Prisma.TenantTaskWhereInput = { tenant_id: tenantId, AND: and };
  const [rows, total, types] = await Promise.all([
    prisma.tenantTask.findMany({
      where,
      select: taskSelect,
      orderBy: [{ due_at: { sort: "asc", nulls: "last" } }, { id: "desc" }],
      skip: (filter.page - 1) * filter.limit,
      take: filter.limit
    }),
    prisma.tenantTask.count({ where }),
    loadTaskTypes(tenantId, true)
  ]);
  const counts = await photoCounts(rows.map((r) => r.id));
  return { data: rows.map((r) => serializeTask(r, types, counts.get(r.id))), total, page: filter.page, limit: filter.limit };
}

async function photoCounts(ids: number[]): Promise<Map<number, number>> {
  if (ids.length === 0) return new Map();
  const rows = await prisma.$queryRaw<Array<{ id: number; n: number }>>`
    SELECT id, COALESCE(jsonb_array_length(result_photos), 0)::int AS n
    FROM tenant_tasks WHERE id = ANY(${ids}::int[]) AND jsonb_typeof(result_photos) = 'array'`;
  return new Map(rows.map((r) => [r.id, r.n]));
}

export async function getTask(tenantId: number, id: number, scope: TaskScope): Promise<TaskDto> {
  const row = await prisma.tenantTask.findFirst({
    where: { id, tenant_id: tenantId, AND: [scopeWhere(scope)] },
    select: { ...taskSelect, result_photos: true }
  });
  if (!row) throw new Error("NOT_FOUND");
  return serializeTask(row, await loadTaskTypes(tenantId, true));
}

async function assertAssignee(tenantId: number, userId: number) {
  const u = await prisma.user.findFirst({
    where: { id: userId, tenant_id: tenantId, is_active: true, role: { in: [...MOBILE_FIELD_ROLE_NAMES] } },
    select: { id: true }
  });
  if (!u) throw new Error("ASSIGNEE_NOT_FOUND");
}

async function assertClient(tenantId: number, clientId: number | null | undefined) {
  if (!clientId) return;
  const c = await prisma.client.findFirst({ where: { id: clientId, tenant_id: tenantId }, select: { id: true } });
  if (!c) throw new Error("CLIENT_NOT_FOUND");
}

function parseDue(v: string | null | undefined): Date | null | undefined {
  if (v === undefined) return undefined;
  if (v === null || v === "") return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) throw new Error("VALIDATION");
  return d;
}

async function notifyAssignee(tenantId: number, task: { id: number; title: string; assignee_user_id: number | null }) {
  if (!task.assignee_user_id) return;
  await createNotification({
    tenant_id: tenantId,
    user_id: task.assignee_user_id,
    title: "Новая задача",
    body: task.title,
    link_href: `/tasks/${task.id}`
  }).catch(() => undefined);
}

export async function createTask(tenantId: number, actorId: number, input: TaskInput): Promise<TaskDto> {
  await assertAssignee(tenantId, input.assignee_user_id);
  await assertClient(tenantId, input.client_id);
  const row = await prisma.tenantTask.create({
    data: {
      tenant_id: tenantId,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      task_type_ref: input.task_type_ref?.trim() || null,
      priority: input.priority ?? "normal",
      due_at: parseDue(input.due_at) ?? null,
      assignee_user_id: input.assignee_user_id,
      created_by_user_id: actorId,
      client_id: input.client_id ?? null
    },
    select: { id: true, title: true, assignee_user_id: true }
  });
  await notifyAssignee(tenantId, row);
  return getTask(tenantId, row.id, null);
}

export async function updateTask(
  tenantId: number,
  id: number,
  input: Partial<TaskInput>,
  scope: TaskScope
): Promise<TaskDto> {
  const cur = await prisma.tenantTask.findFirst({
    where: { id, tenant_id: tenantId, AND: [scopeWhere(scope)] },
    select: { id: true, status: true, assignee_user_id: true }
  });
  if (!cur) throw new Error("NOT_FOUND");
  if (cur.status === "done" || cur.status === "cancelled") throw new Error("TASK_CLOSED");
  if (input.assignee_user_id) await assertAssignee(tenantId, input.assignee_user_id);
  if (input.client_id !== undefined) await assertClient(tenantId, input.client_id);
  const row = await prisma.tenantTask.update({
    where: { id },
    data: {
      ...(input.title !== undefined ? { title: input.title.trim() } : {}),
      ...(input.description !== undefined ? { description: input.description?.trim() || null } : {}),
      ...(input.task_type_ref !== undefined ? { task_type_ref: input.task_type_ref?.trim() || null } : {}),
      ...(input.priority !== undefined ? { priority: input.priority } : {}),
      ...(input.due_at !== undefined ? { due_at: parseDue(input.due_at) } : {}),
      ...(input.assignee_user_id ? { assignee_user_id: input.assignee_user_id } : {}),
      ...(input.client_id !== undefined ? { client_id: input.client_id } : {})
    },
    select: { id: true, title: true, assignee_user_id: true }
  });
  if (row.assignee_user_id !== cur.assignee_user_id) await notifyAssignee(tenantId, row);
  return getTask(tenantId, id, null);
}

export async function cancelTask(tenantId: number, id: number, scope: TaskScope): Promise<TaskDto> {
  const cur = await prisma.tenantTask.findFirst({
    where: { id, tenant_id: tenantId, AND: [scopeWhere(scope)] },
    select: { status: true }
  });
  if (!cur) throw new Error("NOT_FOUND");
  if (cur.status === "done" || cur.status === "cancelled") throw new Error("TASK_CLOSED");
  await prisma.tenantTask.update({ where: { id }, data: { status: "cancelled", cancelled_at: new Date() } });
  return getTask(tenantId, id, null);
}

async function assigneeTask(tenantId: number, id: number, userId: number) {
  const cur = await prisma.tenantTask.findFirst({
    where: { id, tenant_id: tenantId, assignee_user_id: userId },
    select: { id: true, status: true, title: true, created_by_user_id: true, started_at: true }
  });
  if (!cur) throw new Error("NOT_FOUND");
  if (cur.status === "done" || cur.status === "cancelled") throw new Error("TASK_CLOSED");
  return cur;
}

export async function startTask(tenantId: number, id: number, userId: number): Promise<TaskDto> {
  await assigneeTask(tenantId, id, userId);
  await prisma.tenantTask.update({ where: { id }, data: { status: "in_progress", started_at: new Date() } });
  return getTask(tenantId, id, null);
}

export async function completeTask(
  tenantId: number,
  id: number,
  userId: number,
  input: { comment?: string | null; photos?: string[] }
): Promise<TaskDto> {
  const cur = await assigneeTask(tenantId, id, userId);
  const photos = (input.photos ?? []).slice(0, TASK_MAX_PHOTOS).map((p) => {
    const t = p.trim();
    return t.startsWith("data:") ? t : `data:image/jpeg;base64,${t}`;
  });
  const now = new Date();
  await prisma.tenantTask.update({
    where: { id },
    data: {
      status: "done",
      completed_at: now,
      started_at: cur.started_at ?? now,
      result_comment: input.comment?.trim() || null,
      result_photos: photos.length > 0 ? photos : undefined
    }
  });
  if (cur.created_by_user_id && cur.created_by_user_id !== userId) {
    await createNotification({
      tenant_id: tenantId,
      user_id: cur.created_by_user_id,
      title: "Задача выполнена",
      body: cur.title,
      link_href: `/users/tasks?id=${id}`
    }).catch(() => undefined);
  }
  return getTask(tenantId, id, null);
}

/** Topshiriq beriladigan xodimlar (mobil ilovada ishlaydigan rollar). */
export async function listTaskAssignees(tenantId: number, onlyIds?: number[]) {
  const rows = await prisma.user.findMany({
    where: {
      tenant_id: tenantId,
      is_active: true,
      role: { in: [...MOBILE_FIELD_ROLE_NAMES] },
      ...(onlyIds ? { id: { in: onlyIds } } : {})
    },
    orderBy: [{ role: "asc" }, { last_name: "asc" }, { first_name: "asc" }, { id: "asc" }],
    select: { ...userSelect, code: true }
  });
  return rows.map((u) => ({ id: u.id, name: toFio(u), role: u.role, code: u.code }));
}
