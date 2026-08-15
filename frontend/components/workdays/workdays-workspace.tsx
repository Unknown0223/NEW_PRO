"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CalendarClock,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Eye,
  History,
  Pencil,
  Plus,
  TrendingUp,
  UserCog,
  Wallet
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useEffectiveRole } from "@/lib/auth-store";
import { useTabelAudit, useWorkdaysMutations, useWorkdaysState } from "@/lib/tabel/tabel-api";
import {
  MONTH_NAMES,
  WD_ROLES,
  cloneSchedules,
  type ExceptionType,
  type ScheduleMap,
  type WdRole
} from "@/lib/tabel/workdays-logic";
import { ExceptionDialog, OverrideDialog, ScheduleHistoryDialog } from "@/components/workdays/workdays-dialogs";
import { ExceptionsTab, IndividualTab, ScheduleMatrix } from "@/components/workdays/workdays-tabs";
import { useWorkdaysData } from "@/components/workdays/use-workdays-data";

type Tab = "assign" | "view" | "exceptions" | "individual";
const EDIT_ROLES = new Set(["admin", "operator", "director", "sales_director", "regional_manager", "accountant"]);

const EMPTY_SCHEDULES: ScheduleMap = Object.fromEntries(
  WD_ROLES.map((r) => [r, [false, false, false, false, false, false, false]])
) as ScheduleMap;

export function WorkdaysWorkspace() {
  const role = useEffectiveRole();
  const canEdit = role === "admin" || (role != null && EDIT_ROLES.has(role));

  const { employees } = useWorkdaysData();
  const stateQ = useWorkdaysState();
  const auditQ = useTabelAudit();
  const mut = useWorkdaysMutations();

  const saved = stateQ.data?.schedules ?? EMPTY_SCHEDULES;
  const exceptions = useMemo(() => stateQ.data?.exceptions ?? [], [stateQ.data?.exceptions]);
  const overrides = useMemo(() => stateQ.data?.overrides ?? [], [stateQ.data?.overrides]);

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [tab, setTab] = useState<Tab>("view");
  const [draft, setDraft] = useState<ScheduleMap>(() => cloneSchedules(EMPTY_SCHEDULES));
  const [exOpen, setExOpen] = useState(false);
  const [ovOpen, setOvOpen] = useState(false);
  const [histOpen, setHistOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (stateQ.data) setDraft(cloneSchedules(stateQ.data.schedules));
  }, [stateQ.data]);
  useEffect(() => {
    if (canEdit && tab === "view") setTab("assign");
  }, [canEdit, tab]);

  const showToast = (m: string) => {
    setToast(m);
    window.setTimeout(() => setToast(null), 2800);
  };

  const dirtyRoles = useMemo(() => WD_ROLES.filter((r) => draft[r].some((v, i) => v !== saved[r][i])), [draft, saved]);
  const dirty = dirtyRoles.length > 0;
  const scheduleAudit = useMemo(
    () => (auditQ.data ?? []).filter((a) => a.module === "workdays" && a.kind === "schedule"),
    [auditQ.data]
  );
  const monthExceptions = useMemo(
    () => exceptions.filter((e) => e.date.startsWith(`${year}-${String(month).padStart(2, "0")}`)),
    [exceptions, year, month]
  );

  const changeMonth = (d: number) => {
    let m = month + d;
    let y = year;
    if (m < 1) { m = 12; y--; }
    if (m > 12) { m = 1; y++; }
    setMonth(m);
    setYear(y);
  };

  const toggleCell = (r: WdRole, day: number) => {
    if (!canEdit || tab !== "assign") return;
    setDraft((p) => {
      const np = cloneSchedules(p);
      np[r][day] = !np[r][day];
      return np;
    });
  };

  const colState = (day: number): "all" | "none" | "some" => {
    const on = WD_ROLES.filter((r) => draft[r][day]).length;
    return on === WD_ROLES.length ? "all" : on === 0 ? "none" : "some";
  };
  const toggleCol = (day: number) => {
    if (!canEdit || tab !== "assign") return;
    const target = colState(day) !== "all";
    setDraft((p) => {
      const np = cloneSchedules(p);
      for (const r of WD_ROLES) np[r][day] = target;
      return np;
    });
  };

  const saveAll = () => {
    if (!dirty) return showToast("Нет изменений");
    mut.saveSchedules.mutate(draft, {
      onSuccess: () => showToast(`Сохранено графиков: ${dirtyRoles.length} — передано в Табель, KPI и Зарплату`),
      onError: () => showToast("Ошибка сохранения")
    });
  };

  const onAddException = (ex: { role: WdRole | "ALL"; date: string; type: ExceptionType; comment: string }) => {
    mut.addException.mutate(ex, {
      onSuccess: () => showToast(`Исключение добавлено · ${ex.date}`),
      onError: () => showToast("Ошибка сохранения")
    });
    setExOpen(false);
  };

  if (stateQ.isLoading) return <p className="text-sm text-muted-foreground">Загрузка...</p>;

  return (
    <div className="tabel-theme space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-lg font-semibold">Рабочие дни</h1>
          <p className="text-xs text-muted-foreground">
            Недельный график по ролям · Табель, KPI и Зарплата опираются на этот график
          </p>
        </div>
        <div className="ml-auto flex items-center overflow-hidden rounded-lg border bg-card">
          <button onClick={() => changeMonth(-1)} className="px-3 py-2 text-muted-foreground hover:bg-muted">
            <ChevronLeft className="size-4" />
          </button>
          <div className="flex min-w-[150px] items-center justify-center gap-2 px-3 py-1.5 text-sm font-semibold">
            <CalendarDays className="size-3.5 text-primary" /> {MONTH_NAMES[month - 1]} {year}
          </div>
          <button onClick={() => changeMonth(1)} className="px-3 py-2 text-muted-foreground hover:bg-muted">
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          { icon: ClipboardCheck, t: "Табель", d: "Посещаемость учитывается только в рабочие дни графика" },
          { icon: Wallet, t: "Зарплата", d: "Ожидаемые дни = рабочие дни месяца по графику" },
          { icon: TrendingUp, t: "KPI", d: "План и факт считаются только за рабочие дни" }
        ].map((c) => (
          <Card key={c.t} className="flex gap-3 p-3">
            <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
              <c.icon className="size-4" />
            </div>
            <div>
              <div className="text-sm font-bold">{c.t}</div>
              <div className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{c.d}</div>
            </div>
          </Card>
        ))}
      </div>

      <Card className="flex flex-wrap items-center gap-2 p-2">
        <div className="flex rounded-lg bg-muted p-1">
          {(
            [
              ["assign", "Назначить", Pencil],
              ["view", "Просмотр", Eye],
              ["exceptions", "Исключения", CalendarClock],
              ["individual", "Индивидуальные", UserCog]
            ] as const
          ).map(([t, label, Icon]) => (
            <button
              key={t}
              onClick={() => {
                if (t === "assign" && !canEdit) return showToast("Назначать график может только Admin/Оператор");
                setTab(t);
              }}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-semibold transition",
                tab === t ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                t === "assign" && !canEdit && "opacity-50"
              )}
            >
              <Icon className="size-3.5" /> {label}
              {t === "exceptions" && monthExceptions.length > 0 && (
                <span className="rounded-full bg-rose-100 px-1.5 text-[10px] font-bold text-rose-600">{monthExceptions.length}</span>
              )}
              {t === "individual" && overrides.length > 0 && (
                <span className="rounded-full bg-purple-100 px-1.5 text-[10px] font-bold text-purple-600">{overrides.length}</span>
              )}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setHistOpen(true)}>
            <History className="mr-1 size-4" /> История {scheduleAudit.length > 0 && `(${scheduleAudit.length})`}
          </Button>
          {canEdit && tab === "individual" && (
            <Button size="sm" className="bg-purple-600 hover:bg-purple-700" onClick={() => setOvOpen(true)}>
              <Plus className="mr-1 size-4" /> Индивидуальный
            </Button>
          )}
          {canEdit && tab !== "individual" && (
            <Button size="sm" onClick={() => setExOpen(true)}>
              <Plus className="mr-1 size-4" /> Исключение
            </Button>
          )}
        </div>
      </Card>

      {(tab === "assign" || tab === "view") && (
        <ScheduleMatrix
          tab={tab}
          canEdit={canEdit}
          draft={draft}
          saved={saved}
          exceptions={exceptions}
          overrides={overrides}
          year={year}
          month={month}
          dirtyRoles={dirtyRoles}
          onToggleCell={toggleCell}
          onToggleCol={toggleCol}
          onCancel={() => setDraft(cloneSchedules(saved))}
          onSave={saveAll}
        />
      )}

      {tab === "exceptions" && (
        <ExceptionsTab
          year={year}
          month={month}
          monthExceptions={monthExceptions}
          canEdit={canEdit}
          onRemove={(id) => mut.removeException.mutate(id, { onSuccess: () => showToast("Исключение удалено") })}
        />
      )}

      {tab === "individual" && (
        <IndividualTab
          overrides={overrides}
          saved={saved}
          exceptions={exceptions}
          year={year}
          month={month}
          canEdit={canEdit}
          onRemove={(id) => mut.removeOverride.mutate(id, { onSuccess: () => showToast("Индивидуальный график удалён") })}
        />
      )}

      <ExceptionDialog open={exOpen} onOpenChange={setExOpen} year={year} month={month} onSave={onAddException} />
      <OverrideDialog
        open={ovOpen}
        onOpenChange={setOvOpen}
        employees={employees}
        roleSchedules={saved}
        existing={overrides}
        onSave={(ov) => {
          mut.upsertOverride.mutate(ov, {
            onSuccess: () => showToast(`Индивидуальный график сохранён: ${ov.employeeName}`),
            onError: () => showToast("Ошибка сохранения")
          });
          setOvOpen(false);
        }}
      />
      <ScheduleHistoryDialog open={histOpen} onOpenChange={setHistOpen} audit={scheduleAudit} />

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-foreground px-4 py-2.5 text-sm font-semibold text-background shadow-2xl">
          {toast}
        </div>
      )}
    </div>
  );
}
