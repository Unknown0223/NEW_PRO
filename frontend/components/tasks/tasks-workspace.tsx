"use client";

import { PageHeader } from "@/components/dashboard/page-header";
import { PageShell } from "@/components/dashboard/page-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import { useAppConfirm } from "@/components/ui/app-confirm-dialog";
import { FilterSelect } from "@/components/ui/filter-select";
import { Input } from "@/components/ui/input";
import { downloadXlsxSheet } from "@/lib/download-xlsx";
import {
  TASK_PRIORITY_LABEL,
  TASK_ROLE_LABEL,
  TASK_STATUS_LABEL,
  fmtTaskDate,
  taskStatusVariant,
  useTaskMutations,
  useTasksList,
  useTasksMeta,
  type TaskFilters,
  type TaskRow,
  type TaskStatusFilter
} from "@/lib/tasks/tasks-api";
import { usePermissions } from "@/lib/use-permissions";
import { Camera, Download, ListChecks, Plus, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { TaskDetailDialog } from "./task-detail-dialog";
import { TaskFormDialog, taskErrorMessage } from "./task-form-dialog";

const LIMIT = 50;

const STATUS_FILTERS: { value: TaskStatusFilter; label: string }[] = [
  { value: "active", label: "Активные" },
  { value: "overdue", label: "Просроченные" },
  { value: "open", label: "Новые" },
  { value: "in_progress", label: "В работе" },
  { value: "done", label: "Выполненные" },
  { value: "cancelled", label: "Отменённые" }
];

const EMPTY: TaskFilters = { status: "active", assignee: "", type: "", from: "", to: "", q: "" };

export function TasksWorkspace({ initialTaskId }: { initialTaskId?: number | null }) {
  const { has } = usePermissions();
  const canCreate = has("staff.zadachi_spisok.create");
  const canEdit = has("staff.zadachi_spisok.update");
  const canCancel = has("staff.zadachi_spisok.delete");
  const canExport = has("staff.zadachi_spisok.export");
  const { confirm, dialog: confirmDialog } = useAppConfirm();
  const { cancel } = useTaskMutations();

  const [filters, setFilters] = useState<TaskFilters>(EMPTY);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [editTask, setEditTask] = useState<TaskRow | null>(null);
  const [detailId, setDetailId] = useState<number | null>(initialTaskId ?? null);
  const [actionErr, setActionErr] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setFilters((f) => (f.q === search ? f : { ...f, q: search }));
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const listQ = useTasksList(filters, page, LIMIT);
  const metaQ = useTasksMeta();
  const rows = listQ.data?.data ?? [];
  const total = listQ.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  const setFilter = <K extends keyof TaskFilters>(k: K, v: TaskFilters[K]) => {
    setFilters((f) => ({ ...f, [k]: v }));
    setPage(1);
  };

  const openCreate = () => {
    setEditTask(null);
    setFormOpen(true);
  };

  const openEdit = (t: TaskRow) => {
    setDetailId(null);
    setEditTask(t);
    setFormOpen(true);
  };

  const doCancel = async (t: TaskRow) => {
    const ok = await confirm({
      title: "Отменить задачу?",
      message: `«${t.title}» — исполнитель больше не увидит её в списке активных.`,
      confirmLabel: "Отменить задачу",
      cancelLabel: "Назад",
      destructive: true
    });
    if (!ok) return;
    setActionErr(null);
    try {
      await cancel.mutateAsync(t.id);
      setDetailId(null);
    } catch (e) {
      setActionErr(taskErrorMessage(e, "Не удалось отменить задачу"));
    }
  };

  const exportXlsx = async () => {
    await downloadXlsxSheet(
      `tasks-${new Date().toISOString().slice(0, 10)}.xlsx`,
      "Задачи",
      ["№", "Задача", "Тип", "Исполнитель", "Роль", "Клиент", "Срок", "Статус", "Приоритет", "Поставил", "Выполнена", "Комментарий", "Фото"],
      rows.map((r) => [
        r.id,
        r.title,
        r.task_type?.name ?? "",
        r.assignee?.name ?? "",
        r.assignee ? TASK_ROLE_LABEL[r.assignee.role] ?? r.assignee.role : "",
        r.client?.name ?? "",
        fmtTaskDate(r.due_at),
        r.overdue ? "Просрочена" : TASK_STATUS_LABEL[r.status],
        TASK_PRIORITY_LABEL[r.priority],
        r.created_by?.name ?? "",
        fmtTaskDate(r.completed_at),
        r.result_comment ?? "",
        r.result_photo_count
      ]),
      { colWidths: [6, 36, 14, 22, 12, 24, 16, 12, 10, 20, 16, 30, 6] }
    );
  };

  return (
    <PageShell className="space-y-4">
      <PageHeader
        title="Задачи"
        description="Поручения агентам, экспедиторам и супервайзерам. Сотрудник видит задачу в мобильном приложении, начинает её и отмечает выполненной — с комментарием и фото."
        actions={
          <>
            <Link href="/users/task-types" className={buttonVariants({ variant: "outline", size: "sm" })}>
              <ListChecks className="mr-1 size-4" />
              Типы задач
            </Link>
            {canExport ? (
              <Button type="button" variant="outline" size="sm" disabled={rows.length === 0} onClick={() => void exportXlsx()}>
                <Download className="mr-1 size-4" />
                Excel
              </Button>
            ) : null}
            {canCreate ? (
              <Button type="button" size="sm" onClick={openCreate}>
                <Plus className="mr-1 size-4" />
                Новая задача
              </Button>
            ) : null}
          </>
        }
      />

      <div className="flex flex-wrap items-end gap-2 rounded-xl border border-border bg-card p-3 shadow-sm">
        <FilterSelect emptyLabel="Все статусы" value={filters.status} onChange={(e) => setFilter("status", e.target.value as TaskStatusFilter)}>
          {STATUS_FILTERS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect emptyLabel="Все исполнители" value={filters.assignee} onChange={(e) => setFilter("assignee", e.target.value)}>
          {(metaQ.data?.assignees ?? []).map((u) => (
            <option key={u.id} value={u.id}>
              {u.name} · {TASK_ROLE_LABEL[u.role] ?? u.role}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect emptyLabel="Все типы" value={filters.type} onChange={(e) => setFilter("type", e.target.value)}>
          {(metaQ.data?.types ?? []).map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </FilterSelect>
        <label className="flex items-center gap-1 text-xs text-muted-foreground">
          Срок с
          <Input type="date" className="h-9 w-[9.5rem]" value={filters.from} onChange={(e) => setFilter("from", e.target.value)} />
        </label>
        <label className="flex items-center gap-1 text-xs text-muted-foreground">
          по
          <Input type="date" className="h-9 w-[9.5rem]" value={filters.to} onChange={(e) => setFilter("to", e.target.value)} />
        </label>
        <Input className="h-9 w-56" placeholder="Поиск по тексту…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <Button type="button" variant="ghost" size="sm" onClick={() => { setFilters(EMPTY); setSearch(""); setPage(1); }}>
          Сбросить
        </Button>
        <Button type="button" variant="ghost" size="icon" title="Обновить" onClick={() => void listQ.refetch()}>
          <RefreshCw className={listQ.isFetching ? "size-4 animate-spin" : "size-4"} />
        </Button>
      </div>

      {actionErr ? <p className="text-sm text-destructive">{actionErr}</p> : null}

      <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2">№</th>
              <th className="px-3 py-2">Задача</th>
              <th className="px-3 py-2">Исполнитель</th>
              <th className="px-3 py-2">Клиент</th>
              <th className="px-3 py-2">Срок</th>
              <th className="px-3 py-2">Статус</th>
              <th className="px-3 py-2">Поставил</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {listQ.isLoading ? (
              <tr><td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">Загрузка…</td></tr>
            ) : listQ.isError ? (
              <tr><td colSpan={7} className="px-3 py-8 text-center text-destructive">Не удалось загрузить задачи.</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">Задач нет</td></tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="cursor-pointer hover:bg-muted/30" onClick={() => setDetailId(r.id)}>
                  <td className="px-3 py-2 tabular-nums text-muted-foreground">{r.id}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      {r.task_type ? (
                        <span className="size-2.5 shrink-0 rounded-full" style={{ background: r.task_type.color ?? "#94a3b8" }} title={r.task_type.name} />
                      ) : null}
                      <span className="font-medium">{r.title}</span>
                      {r.priority === "high" ? <Badge variant="destructive">!</Badge> : null}
                      {r.result_photo_count > 0 ? (
                        <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground">
                          <Camera className="size-3.5" />
                          {r.result_photo_count}
                        </span>
                      ) : null}
                    </div>
                    {r.task_type ? <div className="text-xs text-muted-foreground">{r.task_type.name}</div> : null}
                  </td>
                  <td className="px-3 py-2">
                    {r.assignee?.name ?? "—"}
                    {r.assignee ? <div className="text-xs text-muted-foreground">{TASK_ROLE_LABEL[r.assignee.role] ?? r.assignee.role}</div> : null}
                  </td>
                  <td className="px-3 py-2">{r.client?.name ?? "—"}</td>
                  <td className="px-3 py-2 tabular-nums">{fmtTaskDate(r.due_at)}</td>
                  <td className="px-3 py-2">
                    <Badge variant={taskStatusVariant(r)}>{r.overdue ? "Просрочена" : TASK_STATUS_LABEL[r.status]}</Badge>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{r.created_by?.name ?? "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>Всего: {total}</span>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Назад
          </Button>
          <span className="tabular-nums">{page} / {totalPages}</span>
          <Button type="button" variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            Вперёд
          </Button>
        </div>
      </div>

      <TaskFormDialog open={formOpen} onOpenChange={setFormOpen} meta={metaQ.data} task={editTask} />
      <TaskDetailDialog
        taskId={detailId}
        onClose={() => setDetailId(null)}
        canEdit={canEdit}
        canCancel={canCancel}
        onEdit={openEdit}
        onCancel={(t) => void doCancel(t)}
      />
      {confirmDialog}
    </PageShell>
  );
}
