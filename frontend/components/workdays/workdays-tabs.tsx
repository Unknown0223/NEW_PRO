"use client";

import { Briefcase, CalendarClock, Check, Info, Sun, Trash2, UserCog, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  EXCEPTION_META,
  MONTH_NAMES,
  WD_ROLES,
  WEEKDAYS,
  WEEKDAYS_FULL,
  countWorkdays,
  monthWorkdayCount,
  monthWorkdayCountFor,
  scheduleDiff,
  type ExceptionType,
  type ScheduleMap,
  type WdRole,
  type WorkdayException,
  type EmployeeOverride
} from "@/lib/tabel/workdays-logic";

type MatrixTab = "assign" | "view";

/* ------------------------------- Матрица ролей ------------------------------- */

export function ScheduleMatrix({
  tab,
  canEdit,
  draft,
  saved,
  exceptions,
  overrides,
  year,
  month,
  dirtyRoles,
  onToggleCell,
  onToggleCol,
  onCancel,
  onSave
}: {
  tab: MatrixTab;
  canEdit: boolean;
  draft: ScheduleMap;
  saved: ScheduleMap;
  exceptions: WorkdayException[];
  overrides: EmployeeOverride[];
  year: number;
  month: number;
  dirtyRoles: WdRole[];
  onToggleCell: (r: WdRole, day: number) => void;
  onToggleCol: (day: number) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  const active = tab === "assign" ? draft : saved;
  const dirty = dirtyRoles.length > 0;
  const colState = (day: number): "all" | "none" | "some" => {
    const on = WD_ROLES.filter((r) => draft[r][day]).length;
    return on === WD_ROLES.length ? "all" : on === 0 ? "none" : "some";
  };

  return (
    <Card className="overflow-hidden p-0">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] border-separate border-spacing-0 text-sm">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 min-w-[170px] border-b border-r bg-muted px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Роли
              </th>
              {WEEKDAYS.map((wd, i) => {
                const st = colState(i);
                return (
                  <th key={wd} className={cn("min-w-[84px] border-b border-r px-2 py-3 text-center", i === 6 ? "bg-blue-50 dark:bg-blue-950/40" : "bg-muted")}>
                    <div className="flex items-center justify-center gap-2">
                      {tab === "assign" && canEdit && (
                        <button
                          onClick={() => onToggleCol(i)}
                          className={cn(
                            "grid size-[18px] place-items-center rounded border-2 transition",
                            st === "all" ? "border-primary bg-primary text-primary-foreground" : st === "some" ? "border-primary/60 bg-primary/30" : "border-input bg-background hover:border-primary/50"
                          )}
                        >
                          {st === "all" && <Check className="size-3" strokeWidth={3.5} />}
                          {st === "some" && <span className="h-0.5 w-2 rounded bg-primary" />}
                        </button>
                      )}
                      <div className={cn("text-xs font-bold", i === 6 ? "text-blue-500" : "text-muted-foreground")}>{wd}</div>
                    </div>
                  </th>
                );
              })}
              <th className="min-w-[110px] border-b bg-muted px-3 py-3 text-center text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Неделя · Месяц
              </th>
            </tr>
          </thead>
          <tbody>
            {WD_ROLES.map((r) => {
              const sch = active[r];
              const changed = tab === "assign" && draft[r].some((v, i) => v !== saved[r][i]);
              const mCount = monthWorkdayCount(sch, exceptions, r, year, month);
              const ovCount = overrides.filter((o) => o.position === r).length;
              return (
                <tr key={r} className="group">
                  <td className={cn("sticky left-0 z-10 border-b border-r bg-card px-4 py-3", changed && "shadow-[inset_3px_0_0_0] shadow-primary")}>
                    <div className="flex items-center gap-2.5">
                      <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                        <Briefcase className="size-3.5" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold">{r}</div>
                        {changed && <div className="text-[10px] font-semibold text-primary">не сохранено</div>}
                      </div>
                    </div>
                  </td>
                  {sch.map((on, i) => (
                    <td key={i} className={cn("border-b border-r py-2 text-center", i === 6 && "bg-blue-50/40 dark:bg-blue-950/20")}>
                      <button
                        disabled={tab !== "assign" || !canEdit}
                        onClick={() => onToggleCell(r, i)}
                        title={`${r} · ${WEEKDAYS_FULL[i]} — ${on ? "рабочий" : "выходной"}`}
                        className={cn(
                          "mx-auto grid size-7 place-items-center rounded-md border-2 transition-all",
                          on ? "border-primary bg-primary text-primary-foreground shadow-sm" : "border-input bg-background text-transparent",
                          tab === "assign" && canEdit ? "cursor-pointer hover:border-primary/50" : "cursor-default opacity-90"
                        )}
                      >
                        <Check className="size-3.5" strokeWidth={3.5} />
                      </button>
                    </td>
                  ))}
                  <td className="border-b py-2 text-center">
                    <span className="font-mono text-sm font-bold text-primary">{countWorkdays(sch)}</span>
                    <span className="mx-1 text-muted-foreground/50">·</span>
                    <span className="font-mono text-sm font-bold" title={`Рабочих дней в ${MONTH_NAMES[month - 1]} (с исключениями)`}>{mCount}</span>
                    {ovCount > 0 && (
                      <span className="ml-1.5 inline-flex items-center gap-0.5 rounded-full bg-purple-100 px-1.5 py-0.5 text-[9px] font-bold text-purple-600" title="Сотрудники с индивидуальным графиком">
                        <UserCog className="size-2.5" /> {ovCount}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {tab === "assign" && canEdit && (
        <div className="flex flex-wrap items-center gap-3 border-t bg-muted/40 px-4 py-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Info className="size-3.5" /> Нажмите на ячейку, чтобы включить/выключить рабочий день. Чекбокс в шапке — весь день для всех ролей.
          </div>
          <div className="ml-auto flex items-center gap-2">
            {dirty && (
              <Button variant="outline" size="sm" onClick={onCancel}>
                <X className="mr-1 size-4" /> Отменить
              </Button>
            )}
            <Button size="sm" disabled={!dirty} onClick={onSave}>
              <Check className="mr-1 size-4" /> Сохранить {dirtyRoles.length > 0 && `(${dirtyRoles.length})`}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

/* ------------------------------ Исключения ------------------------------ */

export function ExceptionsTab({
  year,
  month,
  monthExceptions,
  canEdit,
  onRemove
}: {
  year: number;
  month: number;
  monthExceptions: WorkdayException[];
  canEdit: boolean;
  onRemove: (id: string) => void;
}) {
  return (
    <Card className="overflow-hidden p-0">
      <div className="flex flex-wrap items-center gap-3 border-b px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-bold">
          <CalendarClock className="size-4 text-primary" /> {MONTH_NAMES[month - 1]} {year} — исключения
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          {(Object.keys(EXCEPTION_META) as ExceptionType[]).map((t) => (
            <span key={t} className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
              <span className={cn("size-3 rounded", EXCEPTION_META[t].badgeClass)} /> {EXCEPTION_META[t].label}
            </span>
          ))}
        </div>
      </div>
      {monthExceptions.length === 0 ? (
        <div className="p-12 text-center">
          <Sun className="mx-auto mb-3 size-9 text-muted-foreground/40" />
          <div className="font-bold">В этом месяце исключений нет</div>
          <p className="mt-1 text-sm text-muted-foreground">
            Нажмите «Исключение», чтобы добавить праздник, обязательный рабочий день, мероприятие или обучение.
          </p>
        </div>
      ) : (
        <div className="divide-y">
          {monthExceptions
            .slice()
            .sort((a, b) => a.date.localeCompare(b.date))
            .map((ex) => (
              <div key={ex.id} className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-muted/50">
                <div className="w-14 font-mono text-xs font-bold">
                  {ex.date.slice(8)}.{ex.date.slice(5, 7)}
                </div>
                <div className="w-32 truncate text-xs font-semibold">{ex.role === "ALL" ? "Все роли" : ex.role}</div>
                <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold", EXCEPTION_META[ex.type].badgeClass)}>
                  {EXCEPTION_META[ex.type].label}
                </span>
                <div className="min-w-0 flex-1 truncate text-xs italic text-muted-foreground">{ex.comment || "—"}</div>
                <div className="hidden font-mono text-[10px] text-muted-foreground sm:block">{ex.createdBy}</div>
                {canEdit && (
                  <Button variant="ghost" size="icon-sm" onClick={() => onRemove(ex.id)}>
                    <Trash2 className="size-4 text-rose-500" />
                  </Button>
                )}
              </div>
            ))}
        </div>
      )}
      <div className="border-t bg-muted/40 px-4 py-3 text-xs text-muted-foreground">
        <b>Правило:</b> Праздник / Мероприятие — рабочий день становится выходным; Обязательный рабочий день / Обучение —
        выходной становится рабочим. Исключения автоматически учитываются в Табеле, Зарплате и KPI.
      </div>
    </Card>
  );
}

/* -------------------------- Индивидуальные графики -------------------------- */

export function IndividualTab({
  overrides,
  saved,
  exceptions,
  year,
  month,
  canEdit,
  onRemove
}: {
  overrides: EmployeeOverride[];
  saved: ScheduleMap;
  exceptions: WorkdayException[];
  year: number;
  month: number;
  canEdit: boolean;
  onRemove: (id: string) => void;
}) {
  return (
    <Card className="overflow-hidden p-0">
      <div className="flex flex-wrap items-center gap-3 border-b px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-bold">
          <UserCog className="size-4 text-purple-600" /> Индивидуальные графики (приоритет над ролью)
        </div>
        <div className="ml-auto text-[11px] text-muted-foreground">
          Приоритет: <b>Исключение</b> &gt; <b>Индивидуальный</b> &gt; <b>Роль</b>
        </div>
      </div>
      {overrides.length === 0 ? (
        <div className="p-12 text-center">
          <UserCog className="mx-auto mb-3 size-9 text-muted-foreground/40" />
          <div className="font-bold">Индивидуальных графиков нет</div>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            Некоторые сотрудники работают иначе, чем их роль (например, воскресенье — рабочий, понедельник — выходной).
            Нажмите «Индивидуальный».
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] border-separate border-spacing-0 text-sm">
            <thead>
              <tr>
                <th className="min-w-[210px] border-b border-r bg-muted px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Сотрудник
                </th>
                {WEEKDAYS.map((wd, i) => (
                  <th
                    key={wd}
                    className={cn(
                      "min-w-[60px] border-b border-r px-2 py-2.5 text-center text-xs font-bold",
                      i === 6 ? "bg-blue-50 text-blue-500 dark:bg-blue-950/40" : "bg-muted text-muted-foreground"
                    )}
                  >
                    {wd}
                  </th>
                ))}
                <th className="min-w-[100px] border-b border-r bg-muted px-3 py-2.5 text-center text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Неделя · Месяц
                </th>
                <th className="border-b bg-muted px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Комментарий
                </th>
                <th className="w-10 border-b bg-muted" />
              </tr>
            </thead>
            <tbody>
              {overrides.map((ov) => {
                const roleSch = saved[ov.position as WdRole] ?? [true, true, true, true, true, true, false];
                const diff = scheduleDiff(ov.schedule, roleSch);
                const mCount = monthWorkdayCountFor(ov.position, saved, overrides, exceptions, ov.employeeId, year, month);
                return (
                  <tr key={ov.id} className="group">
                    <td className="border-b border-r px-4 py-2.5 group-hover:bg-muted/50">
                      <div className="flex items-center gap-2.5">
                        <div className="grid size-8 shrink-0 place-items-center rounded-full bg-purple-100 text-[10px] font-bold text-purple-700 dark:bg-purple-900/40">
                          {ov.employeeName.split(" ").map((w) => w[0]).slice(0, 2).join("")}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-xs font-semibold">{ov.employeeName}</div>
                          <div className="font-mono text-[10px] text-muted-foreground">
                            {ov.employeeCode} · {ov.position}
                          </div>
                        </div>
                      </div>
                    </td>
                    {ov.schedule.map((on, i) => (
                      <td key={i} className={cn("border-b border-r py-2 text-center", i === 6 && "bg-blue-50/40 dark:bg-blue-950/20")}>
                        <span
                          className={cn(
                            "inline-grid size-7 place-items-center rounded-md border-2",
                            on ? "border-purple-600 bg-purple-600 text-white" : "border-input text-transparent",
                            diff[i] && "ring-2 ring-purple-300"
                          )}
                        >
                          <Check className="size-3.5" strokeWidth={3.5} />
                        </span>
                      </td>
                    ))}
                    <td className="border-b border-r py-2 text-center">
                      <span className="font-mono text-sm font-bold text-purple-700 dark:text-purple-400">{countWorkdays(ov.schedule)}</span>
                      <span className="mx-1 text-muted-foreground/50">·</span>
                      <span className="font-mono text-sm font-bold">{mCount}</span>
                    </td>
                    <td className="border-b px-3 py-2 text-xs italic text-muted-foreground">{ov.comment || "—"}</td>
                    <td className="border-b text-center">
                      {canEdit && (
                        <Button variant="ghost" size="icon-sm" onClick={() => onRemove(ov.id)}>
                          <Trash2 className="size-4 text-rose-500" />
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <div className="border-t bg-muted/40 px-4 py-3 text-xs text-muted-foreground">
        <b>Логика:</b> индивидуальный график полностью заменяет график роли. Исключения по датам имеют приоритет и над
        ним. Обведённые ячейки — отличия от роли. Табель, Зарплата и KPI считаются по итоговому графику.
      </div>
    </Card>
  );
}
