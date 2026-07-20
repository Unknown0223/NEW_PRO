"use client";

import { useEffect, useState } from "react";
import { Clock, ShieldAlert } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { TabelAuditRecord } from "@/lib/tabel/tabel-api";
import {
  MONTH_NAMES_RU,
  SOURCE_META,
  SPECIAL_STATUSES,
  WORK_STATUS_BY_VALUE,
  WORK_VALUES,
  initialsOf,
  statusMeta,
  type AttendanceStatus,
  type Source
} from "@/components/timesheet/timesheet-shared";

export type CellTarget = {
  userId: number;
  fio: string;
  role: string;
  login: string;
  day: number;
  date: string;
  status: AttendanceStatus;
  source: Source;
};

export function TimesheetCellModal({
  target,
  canEdit,
  locked,
  saving,
  history,
  onSave,
  onClose
}: {
  target: CellTarget | null;
  canEdit: boolean;
  locked: boolean;
  saving: boolean;
  history: TabelAuditRecord[];
  onSave: (status: AttendanceStatus, comment: string) => void;
  onClose: () => void;
}) {
  const [status, setStatus] = useState<AttendanceStatus>("worked");
  const [comment, setComment] = useState("");

  useEffect(() => {
    if (target) {
      setStatus(target.status);
      setComment("");
    }
  }, [target]);

  if (!target) return null;

  const isFuture = target.date > new Date().toISOString().slice(0, 10);
  const editable = canEdit && !locked && !isFuture;
  const SourceIcon = SOURCE_META[target.source].icon;
  const { year, month } = parseDate(target.date);

  return (
    <Dialog open={Boolean(target)} onOpenChange={(o) => (!o ? onClose() : undefined)}>
      <DialogContent className="tabel-theme sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Запись табеля</DialogTitle>
          <p className="font-mono text-xs text-muted-foreground">
            {String(target.day).padStart(2, "0")} {MONTH_NAMES_RU[month - 1]} {year}
          </p>
        </DialogHeader>

        <div className="flex items-center gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-bold text-primary">
            {initialsOf(target.fio)}
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">{target.fio}</div>
            <div className="truncate font-mono text-[11px] text-muted-foreground">{target.role} · {target.login}</div>
          </div>
          <span className="ml-auto flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-[11px] text-muted-foreground">
            <SourceIcon className="size-3" /> {SOURCE_META[target.source].label}
          </span>
        </div>

        <div>
          <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Рабочее значение</label>
          <div className="mt-2 flex gap-2">
            {WORK_VALUES.map((v) => {
              const st = WORK_STATUS_BY_VALUE[String(v)];
              const active = status === st;
              return (
                <button
                  key={v}
                  type="button"
                  disabled={!editable}
                  onClick={() => setStatus(st)}
                  className={cn(
                    "flex-1 rounded-lg border py-2.5 font-mono text-sm font-bold transition",
                    active ? "border-primary bg-primary text-primary-foreground shadow" : "border-input text-muted-foreground hover:border-primary/60",
                    !editable && "cursor-not-allowed opacity-60"
                  )}
                >
                  {v}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Спец-статус</label>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {SPECIAL_STATUSES.map((code) => {
              const meta = statusMeta(code);
              const active = status === code;
              return (
                <button
                  key={code}
                  type="button"
                  disabled={!editable}
                  onClick={() => setStatus(code)}
                  className={cn(
                    "flex items-center gap-2 rounded-lg border px-3 py-2.5 text-xs font-semibold transition",
                    active ? "border-transparent text-white shadow-md" : "border-input text-muted-foreground hover:border-foreground/40",
                    !editable && "cursor-not-allowed opacity-60"
                  )}
                  style={active ? { backgroundColor: meta.color } : undefined}
                >
                  <span
                    className="grid size-4 place-items-center rounded font-mono text-[10px] font-bold"
                    style={{ backgroundColor: active ? "rgba(255,255,255,.25)" : meta.color, color: "#fff" }}
                  >
                    {meta.short}
                  </span>
                  {meta.label}
                </button>
              );
            })}
          </div>
        </div>

        {editable ? (
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Комментарий</label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={2}
              placeholder="Причина изменения (для аудита)…"
              className="mt-2 w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-400">
            <ShieldAlert className="size-4 shrink-0" />
            {locked ? "Период заблокирован (payroll lock)." : isFuture ? "Будущую дату редактировать нельзя." : "У вашей роли нет прав на редактирование."}
          </div>
        )}

        <div>
          <label className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            <Clock className="size-3" /> История изменений
          </label>
          {history.length === 0 ? (
            <p className="mt-2 text-xs italic text-muted-foreground">
              Изменений нет — источник: {SOURCE_META[target.source].label}.
            </p>
          ) : (
            <div className="relative mt-3 space-y-0">
              <div className="absolute bottom-2 left-[7px] top-2 w-px bg-border" />
              {history.map((h) => (
                <div key={h.id} className="relative pb-3 pl-6 last:pb-0">
                  <div className="absolute left-0 top-1 size-[15px] rounded-full border-2 border-background bg-primary" />
                  <div className="text-xs">
                    <span className="font-semibold">{h.oldValue ?? "—"}</span>
                    <span className="mx-1 text-muted-foreground">→</span>
                    <span className="font-semibold">{h.newValue ?? "—"}</span>
                  </div>
                  <div className="font-mono text-[11px] text-muted-foreground">
                    {h.changedBy} · {new Date(h.changedAt).toLocaleString("ru-RU", { hour12: false })}
                  </div>
                  {h.comment ? <div className="mt-0.5 text-[11px] text-muted-foreground">«{h.comment}»</div> : null}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="-mx-4 -mb-4 flex justify-end gap-2 rounded-b-xl border-t bg-muted/50 p-4">
          <Button variant="outline" size="sm" onClick={onClose}>
            Отмена
          </Button>
          {editable ? (
            <Button size="sm" disabled={saving || status === target.status} onClick={() => onSave(status, comment)}>
              Сохранить
            </Button>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function parseDate(dateIso: string): { year: number; month: number; day: number } {
  const [y, m, d] = dateIso.split("-").map((x) => Number.parseInt(x, 10));
  return { year: y, month: m, day: d };
}
