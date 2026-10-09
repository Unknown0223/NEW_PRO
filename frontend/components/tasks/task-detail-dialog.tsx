"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  TASK_PRIORITY_LABEL,
  TASK_ROLE_LABEL,
  TASK_STATUS_LABEL,
  fmtTaskDate,
  taskStatusVariant,
  useTaskDetail,
  type TaskRow
} from "@/lib/tasks/tasks-api";
import type { ReactNode } from "react";

type Props = {
  taskId: number | null;
  onClose: () => void;
  canEdit: boolean;
  canCancel: boolean;
  onEdit: (task: TaskRow) => void;
  onCancel: (task: TaskRow) => void;
};

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[9rem_1fr] gap-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="min-w-0 break-words">{children}</span>
    </div>
  );
}

export function TaskDetailDialog({ taskId, onClose, canEdit, canCancel, onEdit, onCancel }: Props) {
  const q = useTaskDetail(taskId);
  const t = q.data;
  const open = taskId != null;
  const isOpenTask = t ? t.status === "open" || t.status === "in_progress" : false;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t ? `Задача №${t.id}` : "Задача"}</DialogTitle>
        </DialogHeader>
        {q.isLoading ? <p className="text-sm text-muted-foreground">Загрузка…</p> : null}
        {q.isError ? <p className="text-sm text-destructive">Не удалось загрузить задачу.</p> : null}
        {t ? (
          <div className="space-y-2">
            <p className="text-base font-medium">{t.title}</p>
            {t.description ? <p className="whitespace-pre-wrap text-sm text-muted-foreground">{t.description}</p> : null}
            <div className="space-y-1.5 rounded-lg border border-border/70 p-3">
              <Row label="Статус">
                <Badge variant={taskStatusVariant(t)}>{t.overdue ? "Просрочена" : TASK_STATUS_LABEL[t.status]}</Badge>
              </Row>
              <Row label="Тип">{t.task_type?.name ?? "—"}</Row>
              <Row label="Приоритет">{TASK_PRIORITY_LABEL[t.priority]}</Row>
              <Row label="Исполнитель">
                {t.assignee ? `${t.assignee.name} · ${TASK_ROLE_LABEL[t.assignee.role] ?? t.assignee.role}` : "—"}
              </Row>
              <Row label="Поставил">{t.created_by?.name ?? "—"}</Row>
              <Row label="Клиент">
                {t.client ? `${t.client.name}${t.client.address ? ` — ${t.client.address}` : ""}` : "—"}
              </Row>
              <Row label="Срок">{fmtTaskDate(t.due_at)}</Row>
              <Row label="Создана">{fmtTaskDate(t.created_at)}</Row>
              {t.started_at ? <Row label="Начата">{fmtTaskDate(t.started_at)}</Row> : null}
              {t.completed_at ? <Row label="Выполнена">{fmtTaskDate(t.completed_at)}</Row> : null}
              {t.cancelled_at ? <Row label="Отменена">{fmtTaskDate(t.cancelled_at)}</Row> : null}
            </div>
            {t.status === "done" ? (
              <div className="space-y-2 rounded-lg border border-emerald-200 bg-emerald-50/50 p-3 dark:border-emerald-900 dark:bg-emerald-950/20">
                <p className="text-sm font-medium">Результат</p>
                <p className="whitespace-pre-wrap text-sm">{t.result_comment || "Без комментария"}</p>
                {(t.result_photos ?? []).length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {(t.result_photos ?? []).map((src, i) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={i} src={src} alt={`Фото ${i + 1}`} className="max-h-64 max-w-full rounded-md border object-contain" />
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
        <DialogFooter className="gap-2">
          {t && isOpenTask && canCancel ? (
            <Button type="button" variant="destructive" onClick={() => onCancel(t)}>
              Отменить задачу
            </Button>
          ) : null}
          {t && isOpenTask && canEdit ? (
            <Button type="button" variant="outline" onClick={() => onEdit(t)}>
              Изменить
            </Button>
          ) : null}
          <Button type="button" onClick={onClose}>
            Закрыть
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
