"use client";

import { useMemo, useState } from "react";
import { ArrowRight, CalendarRange, ClipboardList, History, RefreshCw, RotateCcw, Search, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useTabelAudit, type TabelAuditModule, type TabelAuditRecord } from "@/lib/tabel/tabel-api";

const MODULE_META: Record<TabelAuditModule, { label: string; icon: typeof ClipboardList; badge: string }> = {
  timesheet: { label: "Табель", icon: ClipboardList, badge: "bg-emerald-100 text-emerald-700" },
  workdays: { label: "Рабочие дни", icon: CalendarRange, badge: "bg-blue-100 text-blue-700" }
};

const KIND_LABEL: Record<TabelAuditRecord["kind"], string> = {
  status: "Статус посещаемости",
  schedule: "График роли",
  exception: "Исключение",
  override: "Индивидуальный график"
};

type ModuleFilter = "all" | TabelAuditModule;

export function AuditWorkspace() {
  const auditQ = useTabelAudit();
  const audit = useMemo(() => auditQ.data ?? [], [auditQ.data]);

  const [q, setQ] = useState("");
  const [moduleFilter, setModuleFilter] = useState<ModuleFilter>("all");

  const counts = useMemo(() => {
    const byModule: Record<string, number> = { timesheet: 0, workdays: 0 };
    for (const a of audit) byModule[a.module] = (byModule[a.module] ?? 0) + 1;
    return byModule;
  }, [audit]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return audit.filter((a) => {
      if (moduleFilter !== "all" && a.module !== moduleFilter) return false;
      if (!s) return true;
      return (
        a.title.toLowerCase().includes(s) ||
        (a.subtitle ?? "").toLowerCase().includes(s) ||
        a.changedBy.toLowerCase().includes(s) ||
        (a.comment ?? "").toLowerCase().includes(s)
      );
    });
  }, [audit, q, moduleFilter]);

  if (auditQ.isLoading) return <p className="text-sm text-muted-foreground">Загрузка...</p>;

  return (
    <div className="tabel-theme space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-semibold">
            <History className="size-5 text-primary" /> Аудит
          </h1>
          <p className="text-xs text-muted-foreground">
            Журнал изменений: Табель (посещаемость) и Рабочие дни (графики, исключения) — что, кто и когда изменил
          </p>
        </div>
        <div className="relative ml-auto w-full max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Сотрудник, дата, пользователь..." className="pl-8" />
        </div>
        <Button variant="ghost" size="icon-sm" onClick={() => void auditQ.refetch()} aria-label="Обновить">
          <RefreshCw className={cn("size-4", auditQ.isFetching && "animate-spin")} />
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Card className="flex items-center gap-3 p-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
            <ClipboardList className="size-5" />
          </div>
          <div>
            <div className="text-2xl font-bold leading-none">{audit.length}</div>
            <div className="mt-1 text-[11px] text-muted-foreground">Всего записей</div>
          </div>
        </Card>
        {(Object.keys(MODULE_META) as TabelAuditModule[]).map((m) => {
          const meta = MODULE_META[m];
          return (
            <Card key={m} className="flex items-center gap-3 p-3">
              <div className={cn("grid size-10 shrink-0 place-items-center rounded-lg", meta.badge)}>
                <meta.icon className="size-5" />
              </div>
              <div>
                <div className="text-2xl font-bold leading-none">{counts[m] ?? 0}</div>
                <div className="mt-1 text-[11px] text-muted-foreground">{meta.label}</div>
              </div>
            </Card>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {(
          [
            ["all", "Все"],
            ["timesheet", "Табель"],
            ["workdays", "Рабочие дни"]
          ] as const
        ).map(([v, label]) => (
          <button
            key={v}
            onClick={() => setModuleFilter(v)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-semibold transition",
              moduleFilter === v ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:border-primary/50"
            )}
          >
            {label}
          </button>
        ))}
        {(q || moduleFilter !== "all") && (
          <button
            onClick={() => {
              setQ("");
              setModuleFilter("all");
            }}
            className="flex items-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="size-3.5" /> Сбросить
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <Card className="border-dashed p-14 text-center">
          <ShieldCheck className="mx-auto mb-3 size-9 text-muted-foreground/40" />
          <div className="font-bold">
            {audit.length === 0 ? "Пока изменений нет" : "Ничего не найдено"}
          </div>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            {audit.length === 0
              ? "Измените ячейку в Табеле или график в разделе «Рабочие дни» — здесь появится запись: было, стало, комментарий, кто и когда."
              : "Измените параметры фильтра или поиск."}
          </p>
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="hidden grid-cols-[110px_1fr_260px_170px] gap-x-4 border-b bg-muted px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground sm:grid">
            <div>Модуль</div>
            <div>Объект / изменение</div>
            <div>Комментарий</div>
            <div className="text-right">Кто / когда</div>
          </div>
          <div className="divide-y">
            {filtered.map((a) => {
              const meta = MODULE_META[a.module];
              return (
                <div
                  key={a.id}
                  className="grid grid-cols-1 gap-x-4 gap-y-1 px-4 py-3 text-sm hover:bg-muted/50 sm:grid-cols-[110px_1fr_260px_170px] sm:items-center"
                >
                  <div>
                    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold", meta.badge)}>
                      <meta.icon className="size-3" /> {meta.label}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold">{a.title}</div>
                    <div className="mt-0.5 text-[10px] text-muted-foreground">
                      {KIND_LABEL[a.kind]}
                      {a.subtitle ? ` · ${a.subtitle}` : ""}
                    </div>
                    {(a.oldValue || a.newValue) && (
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        {a.oldValue && <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono font-bold">{a.oldValue}</span>}
                        {a.oldValue && a.newValue && <ArrowRight className="size-3 text-muted-foreground" />}
                        {a.newValue && <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-mono font-bold text-emerald-700">{a.newValue}</span>}
                      </div>
                    )}
                  </div>
                  <div className="truncate text-xs italic text-muted-foreground">{a.comment || "—"}</div>
                  <div className="text-left sm:text-right">
                    <div className="text-xs font-semibold">{a.changedBy}</div>
                    <div className="font-mono text-[10px] text-muted-foreground">
                      {new Date(a.changedAt).toLocaleString("ru-RU", { hour12: false })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
