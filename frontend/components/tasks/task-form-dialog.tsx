"use client";

import { PolkiClientSearchSelect } from "@/components/orders/order-create/polki-client-search-select";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { filterPanelSelectClassName } from "@/components/ui/filter-select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuthStore } from "@/lib/auth-store";
import { getUserFacingError } from "@/lib/error-utils";
import {
  TASK_ERROR_RU,
  TASK_PRIORITY_LABEL,
  TASK_ROLE_LABEL,
  isoToLocalInput,
  localInputToIso,
  useTaskMutations,
  type TaskMeta,
  type TaskPriority,
  type TaskRow
} from "@/lib/tasks/tasks-api";
import { cn } from "@/lib/utils";
import { isAxiosError } from "axios";
import { useEffect, useState } from "react";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  meta: TaskMeta | undefined;
  /** null — yangi topshiriq */
  task: TaskRow | null;
};

export function taskErrorMessage(e: unknown, fallback: string): string {
  if (isAxiosError(e)) {
    const code = (e.response?.data as { error?: string } | undefined)?.error;
    if (code && TASK_ERROR_RU[code]) return TASK_ERROR_RU[code];
  }
  return getUserFacingError(e, fallback);
}

const selectCls = cn(filterPanelSelectClassName, "max-w-none");

export function TaskFormDialog({ open, onOpenChange, meta, task }: Props) {
  const tenantSlug = useAuthStore((s) => s.tenantSlug);
  const { create, update } = useTaskMutations();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [typeRef, setTypeRef] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("normal");
  const [dueAt, setDueAt] = useState("");
  const [assignee, setAssignee] = useState("");
  const [clientId, setClientId] = useState("");
  const [clientLabel, setClientLabel] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setTitle(task?.title ?? "");
    setDescription(task?.description ?? "");
    setTypeRef(task?.task_type_ref ?? "");
    setPriority(task?.priority ?? "normal");
    setDueAt(isoToLocalInput(task?.due_at ?? null));
    setAssignee(task?.assignee ? String(task.assignee.id) : "");
    setClientId(task?.client ? String(task.client.id) : "");
    setClientLabel(task?.client?.name ?? null);
    setErr(null);
  }, [open, task]);

  const pending = create.isPending || update.isPending;
  const canSave = title.trim().length > 0 && Number(assignee) > 0 && !pending;

  const submit = async () => {
    setErr(null);
    const body = {
      title: title.trim(),
      description: description.trim() || null,
      task_type_ref: typeRef || null,
      priority,
      due_at: localInputToIso(dueAt),
      assignee_user_id: Number(assignee),
      client_id: clientId ? Number(clientId) : null
    };
    try {
      if (task) await update.mutateAsync({ id: task.id, body });
      else await create.mutateAsync(body);
      onOpenChange(false);
    } catch (e) {
      setErr(taskErrorMessage(e, "Не удалось сохранить задачу"));
    }
  };

  const onTypeChange = (v: string) => {
    setTypeRef(v);
    const name = meta?.types.find((t) => t.id === v)?.name;
    if (name && !title.trim()) setTitle(name);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{task ? `Задача №${task.id}` : "Новая задача"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Тип задачи</Label>
              <select className={selectCls} value={typeRef} onChange={(e) => onTypeChange(e.target.value)}>
                <option value="">— без типа —</option>
                {(meta?.types ?? []).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label>Приоритет</Label>
              <select
                className={selectCls}
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
              >
                {(Object.keys(TASK_PRIORITY_LABEL) as TaskPriority[]).map((p) => (
                  <option key={p} value={p}>
                    {TASK_PRIORITY_LABEL[p]}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-1">
            <Label>Что сделать *</Label>
            <Input value={title} maxLength={500} onChange={(e) => setTitle(e.target.value)} placeholder="Например: проверить выкладку на полке" />
          </div>
          <div className="space-y-1">
            <Label>Подробности</Label>
            <textarea
              className="min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={description}
              maxLength={4000}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Исполнитель *</Label>
              <select className={selectCls} value={assignee} onChange={(e) => setAssignee(e.target.value)}>
                <option value="">— выберите —</option>
                {(meta?.assignees ?? []).map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} · {TASK_ROLE_LABEL[u.role] ?? u.role}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label>Срок</Label>
              <Input type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Клиент (необязательно)</Label>
            <div className="flex gap-2">
              <PolkiClientSearchSelect
                tenantSlug={tenantSlug}
                value={clientId}
                selectedLabel={clientLabel}
                className="flex-1"
                placeholder="Выберите клиента"
                onValueChange={setClientId}
                onSelectRow={(c) => setClientLabel(c.name)}
              />
              {clientId ? (
                <Button type="button" variant="ghost" size="sm" onClick={() => { setClientId(""); setClientLabel(null); }}>
                  Убрать
                </Button>
              ) : null}
            </div>
          </div>
          {err ? <p className="text-sm text-destructive">{err}</p> : null}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button type="button" disabled={!canSave} onClick={() => void submit()}>
            {pending ? "Сохранение…" : "Сохранить"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
