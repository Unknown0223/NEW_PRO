"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, History, Save, Search, UserCog, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { TabelAuditRecord } from "@/lib/tabel/tabel-api";
import {
  EXCEPTION_META,
  SCHEDULE_PRESETS,
  WD_ROLES,
  WEEKDAYS,
  WEEKDAYS_FULL,
  dateStr,
  type EmployeeOverride,
  type ExceptionType,
  type Schedule,
  type ScheduleMap,
  type WdRole
} from "@/lib/tabel/workdays-logic";
import type { WorkdaysEmployee } from "@/components/workdays/use-workdays-data";

const LABEL = "text-[11px] font-semibold uppercase tracking-wider text-muted-foreground";

/* ------------------------------- Исключение ------------------------------- */

export function ExceptionDialog({
  open,
  onOpenChange,
  year,
  month,
  onSave
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  year: number;
  month: number;
  onSave: (ex: { role: WdRole | "ALL"; date: string; type: ExceptionType; comment: string }) => void;
}) {
  const [exRole, setExRole] = useState<WdRole | "ALL">("ALL");
  const [date, setDate] = useState(dateStr(year, month, 1));
  const [type, setType] = useState<ExceptionType>("holiday");
  const [comment, setComment] = useState("");

  useEffect(() => {
    if (open) setDate(dateStr(year, month, 1));
  }, [open, year, month]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="tabel-theme sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Добавить исключение</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>Роль</label>
              <select
                value={exRole}
                onChange={(e) => setExRole(e.target.value as WdRole | "ALL")}
                className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
              >
                <option value="ALL">Все роли</option>
                {WD_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={LABEL}>Дата</label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1" />
            </div>
          </div>
          <div>
            <label className={LABEL}>Тип исключения</label>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {(Object.keys(EXCEPTION_META) as ExceptionType[]).map((t) => {
                const m = EXCEPTION_META[t];
                const active = type === t;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setType(t)}
                    className={cn(
                      "rounded-lg border p-2.5 text-left transition",
                      active ? "border-transparent text-white shadow-md" : "border-border hover:border-foreground/40"
                    )}
                    style={active ? { backgroundColor: m.color } : undefined}
                  >
                    <div className={cn("text-xs font-bold", active ? "text-white" : "text-foreground")}>{m.label}</div>
                    <div className={cn("mt-0.5 text-[10px] leading-snug", active ? "text-white/80" : "text-muted-foreground")}>
                      {m.desc}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <label className={LABEL}>Комментарий</label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={2}
              placeholder="Например: День независимости..."
              className="mt-1 w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Отмена
            </Button>
            <Button
              size="sm"
              onClick={() => {
                onSave({ role: exRole, date, type, comment });
                setComment("");
              }}
            >
              <Save className="mr-1 size-4" /> Сохранить
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* --------------------------- Индивидуальный график --------------------------- */

export function OverrideDialog({
  open,
  onOpenChange,
  employees,
  roleSchedules,
  existing,
  onSave
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  employees: WorkdaysEmployee[];
  roleSchedules: ScheduleMap;
  existing: EmployeeOverride[];
  onSave: (ov: Omit<EmployeeOverride, "id" | "createdBy" | "createdAt">) => void;
}) {
  const [q, setQ] = useState("");
  const [empId, setEmpId] = useState<string>("");
  const [schedule, setSchedule] = useState<Schedule>([false, true, true, true, true, true, true]);
  const [comment, setComment] = useState("");

  const emp = employees.find((e) => String(e.id) === empId);
  const roleSch: Schedule = emp
    ? roleSchedules[emp.role as WdRole] ?? [true, true, true, true, true, true, false]
    : [true, true, true, true, true, true, false];

  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    return employees.filter((e) => !s || e.fio.toLowerCase().includes(s) || e.login.toLowerCase().includes(s)).slice(0, 6);
  }, [employees, q]);

  const pickEmployee = (id: string) => {
    setEmpId(id);
    const chosen = employees.find((e) => String(e.id) === id);
    const ex = existing.find((o) => o.employeeId === id);
    if (ex) {
      setSchedule([...ex.schedule]);
      setComment(ex.comment);
    } else if (chosen) {
      setSchedule([...(roleSchedules[chosen.role as WdRole] ?? [true, true, true, true, true, true, false])]);
    }
  };

  const save = () => {
    if (!emp) return;
    onSave({
      employeeId: String(emp.id),
      employeeName: emp.fio,
      employeeCode: emp.login,
      position: emp.role,
      schedule,
      comment
    });
    setEmpId("");
    setQ("");
    setComment("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="tabel-theme sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCog className="size-4 text-purple-600" /> Индивидуальный график
          </DialogTitle>
        </DialogHeader>
        <div className="max-h-[70vh] space-y-4 overflow-y-auto">
          <div>
            <label className={LABEL}>Сотрудник</label>
            {emp ? (
              <div className="mt-1.5 flex items-center gap-2.5 rounded-lg border border-purple-300 bg-purple-50 p-2.5 dark:bg-purple-900/20">
                <div className="grid size-8 shrink-0 place-items-center rounded-full bg-purple-600 text-[10px] font-bold text-white">
                  {emp.fio.split(" ").map((w) => w[0]).slice(0, 2).join("")}
                </div>
                <div className="min-w-0">
                  <div className="truncate text-xs font-semibold">{emp.fio}</div>
                  <div className="font-mono text-[10px] text-muted-foreground">{emp.login} · {emp.role}</div>
                </div>
                <Button variant="ghost" size="icon-sm" className="ml-auto" onClick={() => setEmpId("")}>
                  <X className="size-4" />
                </Button>
              </div>
            ) : (
              <>
                <div className="relative mt-1.5">
                  <Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                  <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск по имени или логину..." className="pl-8" />
                </div>
                <div className="mt-1.5 max-h-44 divide-y overflow-y-auto rounded-lg border">
                  {results.map((e) => (
                    <button
                      key={e.id}
                      type="button"
                      onClick={() => pickEmployee(String(e.id))}
                      className="flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-muted/60"
                    >
                      <div className="grid size-7 shrink-0 place-items-center rounded-full bg-muted text-[9px] font-bold">
                        {e.fio.split(" ").map((w) => w[0]).slice(0, 2).join("")}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-xs font-semibold">{e.fio}</div>
                        <div className="font-mono text-[10px] text-muted-foreground">{e.login} · {e.role}</div>
                      </div>
                      {existing.some((o) => o.employeeId === String(e.id)) && (
                        <span className="ml-auto rounded-full bg-purple-100 px-1.5 py-0.5 text-[9px] font-bold text-purple-600">есть</span>
                      )}
                    </button>
                  ))}
                  {results.length === 0 && <div className="px-3 py-3 text-xs italic text-muted-foreground">Не найдено</div>}
                </div>
              </>
            )}
          </div>

          {emp && (
            <>
              <div>
                <label className={LABEL}>Быстрые шаблоны</label>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {SCHEDULE_PRESETS.map((p) => {
                    const active = p.schedule.every((v, i) => v === schedule[i]);
                    return (
                      <button
                        key={p.label}
                        type="button"
                        onClick={() => setSchedule([...p.schedule])}
                        className={cn(
                          "rounded-full border px-2.5 py-1.5 text-[11px] font-semibold transition",
                          active ? "border-purple-600 bg-purple-600 text-white" : "border-border hover:border-purple-400"
                        )}
                      >
                        {p.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label className={LABEL}>Недельный график</label>
                <div className="mt-2 grid grid-cols-7 gap-1.5">
                  {WEEKDAYS.map((wd, i) => {
                    const on = schedule[i];
                    const diff = on !== roleSch[i];
                    return (
                      <button
                        key={wd}
                        type="button"
                        title={`${WEEKDAYS_FULL[i]} — ${on ? "рабочий" : "выходной"}`}
                        onClick={() => setSchedule((s) => s.map((v, j) => (j === i ? !v : v)))}
                        className={cn(
                          "flex flex-col items-center gap-1 rounded-lg border-2 py-2 transition",
                          on ? "border-purple-600 bg-purple-600 text-white shadow" : "border-border text-muted-foreground hover:border-purple-400",
                          diff && "ring-2 ring-purple-300 ring-offset-1"
                        )}
                      >
                        <span className="text-[10px] font-bold">{wd}</span>
                        <span className={cn("grid size-4 place-items-center rounded", on ? "bg-white/25" : "border border-border")}>
                          {on && <Check className="size-3" strokeWidth={4} />}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <p className="mt-2 text-[10px] text-muted-foreground">
                  Обведённые дни отличаются от графика роли ({emp.role}).
                </p>
              </div>
              <div>
                <label className={LABEL}>Комментарий (причина)</label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={2}
                  placeholder="Например: торговая точка работает по воскресеньям..."
                  className="mt-1 w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
            </>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Отмена
            </Button>
            <Button size="sm" disabled={!emp} onClick={save} className="bg-purple-600 hover:bg-purple-700">
              <Save className="mr-1 size-4" /> Сохранить
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* --------------------------------- История --------------------------------- */

export function ScheduleHistoryDialog({
  open,
  onOpenChange,
  audit
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  audit: TabelAuditRecord[];
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="tabel-theme sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="size-4 text-primary" /> История изменений графиков
          </DialogTitle>
        </DialogHeader>
        <div className="max-h-[70vh] space-y-3 overflow-y-auto">
          {audit.length === 0 ? (
            <p className="py-8 text-center text-sm italic text-muted-foreground">
              Пока изменений нет — измените и сохраните график, и запись появится здесь.
            </p>
          ) : (
            audit.map((a) => (
              <div key={a.id} className="rounded-lg border p-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-bold">{a.title}</div>
                  <div className="font-mono text-[10px] text-muted-foreground">
                    {a.changedBy} · {new Date(a.changedAt).toLocaleString("ru-RU", { hour12: false })}
                  </div>
                </div>
                {a.subtitle && <div className="mt-0.5 text-xs text-muted-foreground">{a.subtitle}</div>}
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
                  {a.oldValue && <span className="rounded bg-muted px-1.5 py-0.5 font-mono">{a.oldValue}</span>}
                  {a.oldValue && a.newValue && <span className="text-muted-foreground">→</span>}
                  {a.newValue && <span className="rounded bg-emerald-100 px-1.5 py-0.5 font-mono text-emerald-700">{a.newValue}</span>}
                </div>
                {a.comment && <div className="mt-1 text-[11px] italic text-muted-foreground">«{a.comment}»</div>}
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
