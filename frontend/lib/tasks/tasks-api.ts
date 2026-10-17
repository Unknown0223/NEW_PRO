import { api } from "@/lib/api";
import { useAuthStore, useAuthStoreHydrated } from "@/lib/auth-store";
import { STALE } from "@/lib/query-stale";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export type TaskStatus = "open" | "in_progress" | "done" | "cancelled";
export type TaskPriority = "low" | "normal" | "high";
export type TaskStatusFilter = TaskStatus | "active" | "overdue" | "";

export type TaskPerson = { id: number; name: string; role: string };

export type TaskRow = {
  id: number;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  due_at: string | null;
  overdue: boolean;
  started_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
  task_type_ref: string | null;
  task_type: { id: string; name: string; color: string | null } | null;
  assignee: TaskPerson | null;
  created_by: TaskPerson | null;
  client: { id: number; name: string; address: string | null } | null;
  result_comment: string | null;
  result_photo_count: number;
  result_photos?: string[];
};

export type TaskMeta = {
  types: { id: string; name: string; code: string | null; color: string | null }[];
  assignees: (TaskPerson & { code: string | null })[];
};

export type TaskFilters = {
  status: TaskStatusFilter;
  assignee: string;
  type: string;
  from: string;
  to: string;
  q: string;
};

export type TaskInput = {
  title: string;
  description: string | null;
  task_type_ref: string | null;
  priority: TaskPriority;
  due_at: string | null;
  assignee_user_id: number;
  client_id: number | null;
};

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  open: "Новая",
  in_progress: "В работе",
  done: "Выполнена",
  cancelled: "Отменена"
};

export const TASK_PRIORITY_LABEL: Record<TaskPriority, string> = {
  low: "Низкий",
  normal: "Обычный",
  high: "Высокий"
};

export const TASK_ROLE_LABEL: Record<string, string> = {
  agent: "Агент",
  expeditor: "Экспедитор",
  supervisor: "Супервайзер"
};

export function taskStatusVariant(row: Pick<TaskRow, "status" | "overdue">) {
  if (row.overdue) return "destructive" as const;
  if (row.status === "done") return "success" as const;
  if (row.status === "in_progress") return "info" as const;
  if (row.status === "cancelled") return "secondary" as const;
  return "warning" as const;
}

export function fmtTaskDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

/** ISO → `<input type="datetime-local">` qiymati (lokal vaqt). */
export function isoToLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function localInputToIso(v: string): string | null {
  if (!v.trim()) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function useSlug() {
  const slug = useAuthStore((s) => s.tenantSlug);
  const hydrated = useAuthStoreHydrated();
  return { slug, ready: Boolean(slug) && hydrated };
}

export function useTasksList(filters: TaskFilters, page: number, limit: number) {
  const { slug, ready } = useSlug();
  return useQuery({
    queryKey: ["tasks", slug, filters, page, limit],
    enabled: ready,
    staleTime: STALE.list,
    queryFn: async () => {
      const sp = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (filters.status) sp.set("status", filters.status);
      if (filters.assignee) sp.set("assignee_user_id", filters.assignee);
      if (filters.type) sp.set("task_type_ref", filters.type);
      if (filters.from) sp.set("due_from", filters.from);
      if (filters.to) sp.set("due_to", filters.to);
      if (filters.q.trim()) sp.set("q", filters.q.trim());
      const { data } = await api.get<{ data: TaskRow[]; total: number; page: number; limit: number }>(
        `/api/${slug}/tasks?${sp}`
      );
      return data;
    }
  });
}

export function useTasksMeta() {
  const { slug, ready } = useSlug();
  return useQuery({
    queryKey: ["tasks", slug, "meta"],
    enabled: ready,
    staleTime: STALE.reference,
    queryFn: async () => {
      const { data } = await api.get<{ data: TaskMeta }>(`/api/${slug}/tasks/meta`);
      return data.data;
    }
  });
}

export function useTaskDetail(id: number | null) {
  const { slug, ready } = useSlug();
  return useQuery({
    queryKey: ["tasks", slug, "detail", id],
    enabled: ready && id != null,
    staleTime: STALE.detail,
    queryFn: async () => {
      const { data } = await api.get<{ data: TaskRow }>(`/api/${slug}/tasks/${id}`);
      return data.data;
    }
  });
}

export function useTaskMutations() {
  const { slug } = useSlug();
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["tasks", slug] });
  const create = useMutation({
    mutationFn: async (body: TaskInput) => (await api.post<{ data: TaskRow }>(`/api/${slug}/tasks`, body)).data.data,
    onSuccess: invalidate
  });
  const update = useMutation({
    mutationFn: async ({ id, body }: { id: number; body: Partial<TaskInput> }) =>
      (await api.patch<{ data: TaskRow }>(`/api/${slug}/tasks/${id}`, body)).data.data,
    onSuccess: invalidate
  });
  const cancel = useMutation({
    mutationFn: async (id: number) => (await api.post<{ data: TaskRow }>(`/api/${slug}/tasks/${id}/cancel`)).data.data,
    onSuccess: invalidate
  });
  return { create, update, cancel };
}

export const TASK_ERROR_RU: Record<string, string> = {
  TaskClosed: "Задача уже закрыта — изменить нельзя.",
  AssigneeNotFound: "Исполнитель не найден или неактивен.",
  ClientNotFound: "Клиент не найден.",
  ForbiddenScope: "Этому сотруднику вы не можете назначать задачи."
};
