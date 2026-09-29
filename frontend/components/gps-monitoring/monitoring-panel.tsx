"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft, Truck, UserRound, RefreshCw, Search, Crosshair, Route as RouteIcon,
  ChevronLeft, ChevronRight, FileSpreadsheet, ArrowDownWideNarrow, ArrowUpWideNarrow, Filter, SlidersHorizontal,
  ShieldCheck, Users, MapPin, Wifi, WifiOff, ArrowRight, BatteryMedium, Banknote, PackageCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Employee, SupervisorOption, VisitModule, VisitPoint } from "./types";
import {
  STATUS_META, ROLE_META, regionOf, payMethodLabel,
  fmtHour, fmtKm, fmtDateLabel, fmtDateShort, fmtOrderValue, fmtSomAmount, MONTHS_RU, WEEKDAYS_RU,
} from "./types";

const ROLE_ORDER: Employee["type"][] = ["agent", "delivery", "supervisor", "inkasator", "vansell"];
const ROLE_ICONS: Record<Employee["type"], typeof UserRound> = {
  agent: UserRound, delivery: Truck, supervisor: ShieldCheck, inkasator: Banknote, vansell: PackageCheck,
};

/* ---------------- battery ---------------- */
function Battery({ level }: { level: number | null }) {
  if (level == null) {
    return <span className="text-[10px] font-bold tabular-nums text-ink-soft">—</span>;
  }
  const color = level > 50 ? "#16a34a" : level > 25 ? "#f59e0b" : "#e11d48";
  return (
    <span className="flex items-center gap-1">
      <svg width="21" height="12" viewBox="0 0 22 12" aria-hidden>
        <rect x="0.5" y="0.5" width="18" height="11" rx="2.5" fill="none" stroke={color} />
        <rect x="2" y="2" width={Math.max(1.5, (15 * level) / 100)} height="8" rx="1.2" fill={color}
          style={{ transition: "width .5s ease" }} />
        <rect x="19.5" y="3.5" width="2" height="5" rx="1" fill={color} />
      </svg>
      <span className="text-[11px] font-bold tabular-nums" style={{ color }}>{level} %</span>
    </span>
  );
}

/* ---------------- empty state ---------------- */
function Empty({ text = "Информация не найдена" }: { text?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <svg width="84" height="84" viewBox="0 0 96 96" fill="none" className="animate-[floaty_3.2s_ease-in-out_infinite]">
        <circle cx="48" cy="48" r="40" fill="#f1f5f4" />
        <rect x="30" y="26" width="36" height="46" rx="6" fill="#fff" stroke="#cbd8d4" strokeWidth="2" />
        <rect x="40" y="21" width="16" height="9" rx="3" fill="#e2eae7" stroke="#cbd8d4" strokeWidth="2" />
        <circle cx="41" cy="46" r="2.4" fill="#94a8a2" />
        <circle cx="55" cy="46" r="2.4" fill="#94a8a2" />
        <path d="M42 56l12 0" stroke="#94a8a2" strokeWidth="2" strokeLinecap="round" />
        <path d="M41 44l-3-3M55 44l3-3" stroke="#94a8a2" strokeWidth="2" strokeLinecap="round" />
        <path d="M22 34l3 3M74 60l-3-3" stroke="#cbd8d4" strokeWidth="2" strokeLinecap="round" />
        <circle cx="70" cy="30" r="2" fill="#cbd8d4" />
        <circle cx="25" cy="62" r="2" fill="#cbd8d4" />
      </svg>
      <div className="mt-3 text-[13px] font-semibold text-ink-soft">{text}</div>
    </div>
  );
}

/* ---------------- calendar ---------------- */
function Calendar({ value, onPick }: { value: Date; onPick: (d: Date) => void }) {
  const [view, setView] = useState(new Date(value.getFullYear(), value.getMonth(), 1));
  const first = new Date(view.getFullYear(), view.getMonth(), 1);
  const offset = (first.getDay() + 6) % 7; // Monday start
  const days = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
  const cells: (Date | null)[] = [
    ...Array.from({ length: offset }, () => null),
    ...Array.from({ length: days }, (_, i) => new Date(view.getFullYear(), view.getMonth(), i + 1)),
  ];
  const sameDay = (a: Date, b: Date) =>
    a.getDate() === b.getDate() && a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();

  return (
    <div className="modal-in absolute left-0 top-full z-40 mt-2 w-[264px] rounded-xl border border-slate-200 bg-gps-card p-3 shadow-xl">
      <div className="mb-2 flex items-center justify-between">
        <button onClick={() => setView(new Date(view.getFullYear(), view.getMonth() - 1, 1))}
          className="grid h-7 w-7 place-items-center rounded-lg text-teal-deep transition-colors hover:bg-teal-50">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="flex items-baseline gap-2">
          <span className="text-[13px] font-bold text-ink">{MONTHS_RU[view.getMonth()]}</span>
          <span className="font-display text-[12px] font-semibold text-ink-soft">{view.getFullYear()}</span>
        </div>
        <button onClick={() => setView(new Date(view.getFullYear(), view.getMonth() + 1, 1))}
          className="grid h-7 w-7 place-items-center rounded-lg text-teal-deep transition-colors hover:bg-teal-50">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center">
        {WEEKDAYS_RU.map((w) => (
          <div key={w} className="py-1 text-[10px] font-bold text-ink-soft/70">{w}</div>
        ))}
        {cells.map((d, i) =>
          d === null ? (
            <div key={`e${i}`} />
          ) : (
            <button
              key={d.toISOString()}
              onClick={() => onPick(d)}
              className={cn(
                "grid h-8 place-items-center rounded-lg text-[12px] font-semibold tabular-nums transition-all",
                sameDay(d, value)
                  ? "bg-teal-deep text-white shadow-[0_4px_10px_-3px_rgba(11,124,112,0.6)]"
                  : "text-ink hover:bg-teal-50 hover:text-teal-deep"
              )}
            >
              {d.getDate()}
            </button>
          )
        )}
      </div>
    </div>
  );
}

/* ================================================================ */
export default function MonitoringPanel({
  view, tab, onTab, onBack, selected, onSelectEmployee, date, onDate,
  points, hour, selectedPointId, onSelectPoint, onLocate, toast,
  modules, onModulesChange, subRoutes, onOpenAgent,
  employees, supervisors, onRefresh, loading, onVisibleEmployeesChange,
}: {
  view: "list" | "detail";
  tab: "detail" | "mini";
  onTab: (t: "detail" | "mini") => void;
  onBack: () => void;
  selected: Employee | null;
  onSelectEmployee: (e: Employee) => void;
  date: Date;
  onDate: (d: Date) => void;
  points: VisitPoint[];
  hour: number;
  selectedPointId: string | null;
  onSelectPoint: (p: VisitPoint) => void;
  onLocate: (e: Employee) => void;
  toast: (m: string) => void;
  modules: Record<VisitModule, boolean>;
  onModulesChange: (modules: Record<VisitModule, boolean>) => void;
  subRoutes: AgentRouteSummary[];
  onOpenAgent: (e: Employee) => void;
  employees: Employee[];
  supervisors: SupervisorOption[];
  onRefresh?: () => void;
  loading?: boolean;
  onVisibleEmployeesChange?: (ids: string[]) => void;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col bg-paper">
      {view === "list" ? (
        <ListMode
          selected={selected}
          onSelectEmployee={onSelectEmployee}
          date={date}
          onDate={onDate}
          onLocate={onLocate}
          employees={employees}
          supervisors={supervisors}
          onRefresh={onRefresh}
          loading={loading}
          onVisibleEmployeesChange={onVisibleEmployeesChange}
        />
      ) : (
        selected && (selected.type === "supervisor" ? (
          <SupervisorMode
            key={selected.id + tab}
            supervisor={selected} subRoutes={subRoutes} hour={hour} date={date} onDate={onDate}
            onBack={onBack} onOpenAgent={onOpenAgent} toast={toast}
            initialTab={tab === "mini" ? "mini" : "report"}
          />
        ) : (
          <DetailMode
            employee={selected} tab={tab} onTab={onTab} onBack={onBack} date={date} onDate={onDate}
            points={points} hour={hour} selectedPointId={selectedPointId} onSelectPoint={onSelectPoint} toast={toast}
            modules={modules} onModulesChange={onModulesChange}
          />
        ))
      )}
    </div>
  );
}

export interface AgentRouteSummary { employee: Employee; points: VisitPoint[] }

/* ================= LIST MODE ================= */
function ListMode({ selected, onSelectEmployee, date, onDate, onLocate, employees, supervisors, onRefresh, loading, onVisibleEmployeesChange }: {
  selected: Employee | null;
  onSelectEmployee: (e: Employee) => void;
  date: Date;
  onDate: (d: Date) => void;
  onLocate: (e: Employee) => void;
  employees: Employee[];
  supervisors: SupervisorOption[];
  onRefresh?: () => void;
  loading?: boolean;
  onVisibleEmployeesChange?: (ids: string[]) => void;
}) {
  void loading;
  const [seg, setSeg] = useState<Employee["type"]>("agent");
  const [query, setQuery] = useState("");
  const [sup, setSup] = useState<string>("all");
  const [supOpen, setSupOpen] = useState(false);
  const [region, setRegion] = useState<string>("all");
  const [regionOpen, setRegionOpen] = useState(false);
  const [calOpen, setCalOpen] = useState(false);
  const [spinning, setSpinning] = useState(false);

  const regions = useMemo(() => Array.from(new Set(employees.map(regionOf))).sort(), [employees]);

  const list = useMemo(() => {
    return employees
      .filter((e) => e.type === seg)
      .filter((e) => (sup === "all" ? true : sup === "none" ? e.supervisorId === null : e.supervisorId === sup))
      .filter((e) => (region === "all" ? true : regionOf(e) === region))
      .filter((e) => (`${e.code} ${e.name} ${e.territory}`).toLowerCase().includes(query.trim().toLowerCase()))
      .slice()
      .sort((a, b) => {
        const aa = a.activeOnDate === false ? 1 : 0;
        const bb = b.activeOnDate === false ? 1 : 0;
        if (aa !== bb) return aa - bb;
        return a.name.localeCompare(b.name, "uz");
      });
  }, [employees, seg, sup, region, query]);

  useEffect(() => {
    onVisibleEmployeesChange?.(list.map((e) => e.id));
  }, [list, onVisibleEmployeesChange]);

  const refresh = () => {
    setSpinning(true);
    onRefresh?.();
    setTimeout(() => setSpinning(false), 700);
  };

  return (
    <>
      <div className="border-b border-slate-200 bg-gps-card px-4 pb-3 pt-4">
        <h2 className="font-display text-[16px] font-semibold text-ink">GPS Мониторинг</h2>

        {/* role chips — scrollable, optimized for 5 roles */}
        <div className="scroll-slim mt-3 flex gap-1.5 overflow-x-auto pb-0.5">
          {ROLE_ORDER.map((r) => {
            const Icon = ROLE_ICONS[r];
            const active = seg === r;
            return (
              <button
                key={r}
                onClick={() => { setSeg(r); setSup("all"); setRegion("all"); }}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-bold transition-all",
                  active
                    ? "border-teal-deep bg-teal-deep text-white shadow-[0_4px_12px_-4px_rgba(11,124,112,0.7)]"
                    : "border-slate-200 bg-gps-card text-ink-soft hover:border-teal-brand/50 hover:text-teal-deep"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {ROLE_META[r].label}
              </button>
            );
          })}
        </div>
        <div className="mt-1.5 text-[10.5px] font-semibold text-ink-soft/80">{ROLE_META[seg].desc}</div>

        {/* supervisor + date */}
        <div className="mt-2.5 flex gap-2">
          {seg === "supervisor" ? (
            <div className="flex flex-1 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11.5px] font-semibold text-ink-soft">
              <Users className="h-4 w-4 text-teal-deep" />
              Контроль территории · без заказов
            </div>
          ) : (
          <div className="relative flex-1">
            <button onClick={() => setSupOpen((o) => !o)}
              className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-[12px] font-semibold text-ink-soft transition-colors hover:border-teal-brand/50">
              <span className="truncate">{sup === "all" ? "Супервайзеры" : sup === "none" ? "Без супервайзера" : supervisors.find((s) => s.id === sup)?.label}</span>
              <ChevronRight className={cn("h-3.5 w-3.5 transition-transform", supOpen ? "-rotate-90" : "rotate-90")} />
            </button>
            {supOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setSupOpen(false)} />
                <div className="modal-in absolute left-0 top-full z-40 mt-1.5 w-full overflow-hidden rounded-lg border border-slate-200 bg-gps-card py-1 shadow-lg">
                  {[["all", "Все супервайзеры"], ["none", "Агенты без супервайзера"], ...supervisors.map((s) => [s.id, s.label] as [string, string])].map(([k, l]) => (
                    <button key={k} onClick={() => { setSup(k); setSupOpen(false); }}
                      className={cn("block w-full truncate px-3 py-1.5 text-left text-[11.5px] font-medium transition-colors hover:bg-teal-50",
                        sup === k ? "text-teal-deep" : "text-ink")}>
                      {l}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          )}

          <div className="relative flex items-center rounded-lg border border-slate-200 bg-white">
            <button onClick={() => { const d = new Date(date); d.setDate(d.getDate() - 1); onDate(d); }}
              className="grid h-9 w-8 place-items-center text-ink-soft transition-colors hover:text-teal-deep">
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <button onClick={() => setCalOpen((o) => !o)}
              className="whitespace-nowrap border-x border-slate-200 px-2 text-[12px] font-bold text-ink">
              {fmtDateLabel(date)}
            </button>
            <button onClick={() => { const d = new Date(date); d.setDate(d.getDate() + 1); onDate(d); }}
              className="grid h-9 w-8 place-items-center text-ink-soft transition-colors hover:text-teal-deep">
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
            {calOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setCalOpen(false)} />
                <div className="absolute right-0 top-full z-40">
                  <Calendar value={date} onPick={(d) => { onDate(d); setCalOpen(false); }} />
                </div>
              </>
            )}
          </div>
        </div>

        {/* territory filter — location-based selection */}
        {seg !== "supervisor" && (
          <div className="relative mt-2.5">
            <button onClick={() => setRegionOpen((o) => !o)}
              className="flex w-full items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[12px] font-semibold text-ink-soft transition-colors hover:border-teal-brand/50">
              <MapPin className="h-3.5 w-3.5 text-teal-deep" />
              <span className="flex-1 truncate text-left">
                {region === "all" ? "Все территории" : region}
              </span>
              <span className="rounded-full bg-teal-50 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-teal-deep">
                {list.length}
              </span>
              <ChevronRight className={cn("h-3.5 w-3.5 transition-transform", regionOpen ? "-rotate-90" : "rotate-90")} />
            </button>
            {regionOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setRegionOpen(false)} />
                <div className="modal-in absolute left-0 top-full z-40 mt-1.5 max-h-56 w-full overflow-y-auto rounded-lg border border-slate-200 bg-gps-card py-1 shadow-lg scroll-slim">
                  <button onClick={() => { setRegion("all"); setRegionOpen(false); }}
                    className={cn("block w-full px-3 py-1.5 text-left text-[11.5px] font-medium transition-colors hover:bg-teal-50",
                      region === "all" ? "text-teal-deep" : "text-ink")}>
                    Все территории
                  </button>
                  {regions.map((r) => (
                    <button key={r} onClick={() => { setRegion(r); setRegionOpen(false); }}
                      className={cn("flex w-full items-center justify-between px-3 py-1.5 text-left text-[11.5px] font-medium transition-colors hover:bg-teal-50",
                        region === r ? "text-teal-deep" : "text-ink")}>
                      {r}
                      <span className="text-[10px] tabular-nums text-ink-soft">
                        {employees.filter((e) => e.type === seg && regionOf(e) === r).length}
                      </span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* search + refresh */}
        <div className="mt-2.5 flex gap-2">
          <label className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Поиск"
              className="w-full rounded-lg border border-slate-200 bg-slate-50/60 py-2 pl-9 pr-3 text-[12.5px] font-medium text-ink outline-none transition-all placeholder:text-ink-soft/70 focus:border-teal-brand focus:bg-white focus:ring-2 focus:ring-teal-brand/20" />
          </label>
          <button onClick={refresh} aria-label="Обновить"
            className="grid w-10 place-items-center rounded-lg border border-slate-200 bg-white text-teal-deep transition-colors hover:border-teal-brand/60">
            <RefreshCw className={cn("h-4 w-4", spinning && "animate-spin")} />
          </button>
        </div>
      </div>

      {/* rows */}
      <div className="scroll-slim min-h-0 flex-1 overflow-y-auto p-2.5">
        {list.length === 0 && <Empty text="Сотрудники не найдены" />}
        <ol key={seg + sup + region} className="space-y-1.5">
          {list.map((e, i) => {
            const active = selected?.id === e.id;
            const idle = e.activeOnDate === false;
            return (
              <li key={e.id} className="rise" style={{ animationDelay: `${Math.min(i, 12) * 35}ms` }}>
                <div
                  role="button"
                  tabIndex={idle ? -1 : 0}
                  aria-disabled={idle}
                  title={idle ? "В этот день не работал — выбрать нельзя" : undefined}
                  onClick={() => { if (!idle) onSelectEmployee(e); }}
                  onKeyDown={(ev) => { if (!idle && ev.key === "Enter") onSelectEmployee(e); }}
                  className={cn(
                    "group relative flex w-full items-center gap-3 overflow-hidden rounded-xl border bg-gps-card p-3 text-left transition-all",
                    idle
                      ? "cursor-not-allowed border-slate-100 opacity-40 grayscale"
                      : "cursor-pointer",
                    !idle && active
                      ? "border-teal-brand shadow-[0_6px_18px_-8px_rgba(15,158,142,0.55)]"
                      : !idle && "border-slate-200 hover:-translate-y-0.5 hover:border-teal-brand/40 hover:shadow-md"
                  )}
                >
                  {active && !idle && <span className="absolute inset-y-0 left-0 w-1 bg-teal-brand" />}
                  <span className="relative grid h-9 w-9 shrink-0 place-items-center rounded-full bg-teal-50 text-teal-deep">
                    <UserRound className="h-4.5 w-4.5" />
                    <span className={cn("absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-gps-card",
                      idle ? "bg-slate-300" : e.online ? "bg-emerald-500" : "bg-slate-300")} />
                  </span>
                  <span className="min-w-0 flex-1 leading-tight">
                    <span className="flex items-center gap-1.5">
                      <span className="shrink-0 rounded px-1 py-0.5 text-[8.5px] font-extrabold tracking-wide"
                        style={{ background: ROLE_META[e.type].color + "1c", color: ROLE_META[e.type].color }}>
                        {ROLE_META[e.type].short}
                      </span>
                      <span className="truncate text-[12.5px] font-bold text-ink">
                        {e.type === "supervisor" ? e.name : `${e.code} [${e.name}]`}
                      </span>
                      {idle && (
                        <span className="shrink-0 rounded bg-slate-100 px-1 py-0.5 text-[8.5px] font-bold uppercase text-slate-500">
                          не работал
                        </span>
                      )}
                    </span>
                    {e.type === "supervisor" ? (
                      <span className="mt-0.5 flex items-center gap-2 text-[10.5px] font-semibold text-ink-soft">
                        <span className="flex items-center gap-1"><Users className="h-3 w-3 text-teal-deep" />
                          {employees.filter((x) => x.supervisorId === e.id).length} агентов
                        </span>
                        <span className="flex items-center gap-1 text-emerald-600">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          {employees.filter((x) => x.supervisorId === e.id && x.online).length} онлайн
                        </span>
                      </span>
                    ) : (
                      <span className="block truncate text-[10.5px] text-ink-soft">
                        ({e.territory}) {e.segment}
                      </span>
                    )}
                    <span className="mt-0.5 block text-[10.5px] tabular-nums text-ink-soft/80">
                      {fmtDateShort(date)} {e.lastSeen}
                      {e.network ? ` · ${e.network}` : ""}
                    </span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-1.5">
                    <Battery level={e.battery} />
                    <span className="flex items-center gap-1">
                      <button
                        disabled={idle}
                        onClick={(ev) => { ev.stopPropagation(); if (!idle) onLocate(e); }}
                        aria-label="Показать на карте"
                        title="Показать на карте"
                        className="grid h-6 w-6 place-items-center rounded-md text-teal-deep transition-all hover:bg-teal-50 hover:scale-110 disabled:opacity-30 disabled:hover:scale-100"
                      >
                        <Crosshair className="h-4 w-4" />
                      </button>
                      <button
                        disabled={idle}
                        onClick={(ev) => { ev.stopPropagation(); if (!idle) onSelectEmployee(e); }}
                        aria-label="Маршрут"
                        title="Открыть маршрут"
                        className="grid h-6 w-6 place-items-center rounded-md text-teal-deep transition-all hover:bg-teal-50 hover:scale-110 disabled:opacity-30 disabled:hover:scale-100"
                      >
                        <RouteIcon className="h-4 w-4" />
                      </button>
                    </span>
                  </span>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </>
  );
}

/* Floating event-source filter shown beside the date control. */
function ModuleMenu({ modules, onChange }: {
  modules: Record<VisitModule, boolean>;
  onChange: (modules: Record<VisitModule, boolean>) => void;
}) {
  const items: { key: VisitModule; label: string; color: string }[] = [
    { key: "client", label: "Клиент", color: "#22c55e" },
    { key: "warehouse", label: "Склад", color: "#d69e27" },
    { key: "cash", label: "Касса", color: "#38a8aa" },
    { key: "fuel", label: "АЗС", color: "#3b9fe9" },
    { key: "start", label: "Начальная точка", color: "#a3b2ae" },
  ];
  const allOn = items.every((i) => modules[i.key]);
  const setAll = (next: boolean) => onChange(Object.fromEntries(items.map((i) => [i.key, next])) as Record<VisitModule, boolean>);

  return (
    <div className="modal-in absolute right-0 top-full z-40 mt-2 w-[272px] rounded-xl border border-slate-200 bg-gps-card p-2.5 shadow-xl">
      <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border-b border-slate-100 px-1.5 pb-2.5 text-[12px] font-bold text-ink">
        <input type="checkbox" checked={allOn} onChange={(e) => setAll(e.target.checked)} className="h-4 w-4 accent-teal-deep" />
        Выбрать все
      </label>
      <div className="mt-1.5 space-y-0.5">
        {items.map((item) => (
          <label key={item.key} className="flex cursor-pointer items-center gap-2.5 rounded-lg px-1.5 py-2 text-[12px] font-semibold text-ink transition-colors hover:bg-teal-50">
            <input type="checkbox" checked={modules[item.key]} onChange={() => onChange({ ...modules, [item.key]: !modules[item.key] })}
              className="h-4 w-4 accent-teal-deep" />
            <span className="flex-1">{item.label}</span>
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: item.color, boxShadow: `0 0 0 4px ${item.color}1a` }} />
          </label>
        ))}
      </div>
    </div>
  );
}

/* ================= DETAIL MODE ================= */
function DetailMode({ employee, tab, onTab, onBack, date, onDate, points, hour, selectedPointId, onSelectPoint, toast, modules, onModulesChange }: {
  employee: Employee;
  tab: "detail" | "mini";
  onTab: (t: "detail" | "mini") => void;
  onBack: () => void;
  date: Date;
  onDate: (d: Date) => void;
  points: VisitPoint[];
  hour: number;
  selectedPointId: string | null;
  onSelectPoint: (p: VisitPoint) => void;
  toast: (m: string) => void;
  modules: Record<VisitModule, boolean>;
  onModulesChange: (modules: Record<VisitModule, boolean>) => void;
}) {
  const [calOpen, setCalOpen] = useState(false);
  const [moduleOpen, setModuleOpen] = useState(false);

  const enabledPoints = points.filter((p) => modules[p.module]);
  const visited = enabledPoints.filter((p) => p.arrived !== null && p.arrived <= hour);
  const todo = enabledPoints.filter((p) => !(p.arrived !== null && p.arrived <= hour));
  const noun =
    employee.type === "inkasator" ? "точек инкассации"
    : employee.type === "vansell" ? "ванселл-визитов"
    : employee.type === "delivery" ? "доставок"
    : "клиентов";
  const subtitle = tab === "detail"
    ? `Отображено ${noun} на карте (${enabledPoints.length})`
    : `Отображено заказов на карте (${visited.filter((p) => p.status === "ordered").length})`;

  return (
    <>
      {/* header */}
      <div className="flex items-center gap-3 border-b border-slate-200 bg-gps-card px-3 py-3.5">
        <button onClick={onBack} aria-label="Назад"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-slate-200 text-ink-soft transition-all hover:-translate-x-0.5 hover:border-teal-brand/50 hover:text-teal-deep">
          <ArrowLeft className="h-4.5 w-4.5" />
        </button>
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl"
          style={{ background: ROLE_META[employee.type].color + "1c", color: ROLE_META[employee.type].color }}>
          {(() => { const Icon = ROLE_ICONS[employee.type]; return <Icon className="h-5 w-5" />; })()}
        </span>
        <div className="min-w-0 leading-tight">
          <div className="truncate text-[13px] font-extrabold text-ink">
            {employee.code} [{employee.name}] <span className="font-semibold text-ink-soft">({employee.territory}) {employee.segment}</span>
          </div>
          <div className="mt-0.5 text-[11px] font-medium text-teal-deep">{subtitle}</div>
        </div>
      </div>

      {/* date */}
      <div className="border-b border-slate-200 bg-gps-card px-3 py-2.5">
        <div className="flex gap-2">
          <div className="relative flex flex-1 items-center rounded-lg border border-slate-200 bg-white">
            <button onClick={() => { const d = new Date(date); d.setDate(d.getDate() - 1); onDate(d); }}
              className="grid h-9 w-9 place-items-center text-ink-soft transition-colors hover:text-teal-deep">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button onClick={() => setCalOpen((o) => !o)}
              className="flex-1 whitespace-nowrap border-x border-slate-200 py-2 text-center text-[12.5px] font-bold text-ink transition-colors hover:text-teal-deep">
              {fmtDateLabel(date)}
            </button>
            <button onClick={() => { const d = new Date(date); d.setDate(d.getDate() + 1); onDate(d); }}
              className="grid h-9 w-9 place-items-center text-ink-soft transition-colors hover:text-teal-deep">
              <ChevronRight className="h-4 w-4" />
            </button>
            {calOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setCalOpen(false)} />
                <div className="absolute left-2 top-full z-40">
                  <Calendar value={date} onPick={(d) => { onDate(d); setCalOpen(false); }} />
                </div>
              </>
            )}
          </div>
          <div className="relative">
            <button onClick={() => setModuleOpen((o) => !o)} aria-label="Фильтр модулей"
              className={cn("grid h-9 w-10 place-items-center rounded-lg border transition-all",
                moduleOpen ? "border-teal-deep bg-teal-deep text-white" : "border-slate-200 bg-white text-teal-deep hover:border-teal-brand") }>
              <SlidersHorizontal className="h-4 w-4" />
            </button>
            {moduleOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setModuleOpen(false)} />
                <ModuleMenu modules={modules} onChange={onModulesChange} />
              </>
            )}
          </div>
        </div>
      </div>

      {/* tabs */}
      <div className="flex gap-6 border-b border-slate-200 bg-gps-card px-4">
        {([["detail", "Детальный отчет"], ["mini", "Мини отчет"]] as const).map(([k, l]) => (
          <button key={k} onClick={() => onTab(k)}
            className={cn("relative py-2.5 text-[12.5px] font-bold transition-colors",
              tab === k ? "text-teal-deep" : "text-ink-soft hover:text-ink")}>
            {l}
            <span className={cn("absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-teal-deep transition-all duration-300",
              tab === k ? "opacity-100 scale-x-100" : "opacity-0 scale-x-0")} />
          </button>
        ))}
      </div>

      <div className="scroll-slim min-h-0 flex-1 overflow-y-auto">
        {tab === "detail" ? (
          <DetailTab employee={employee} points={enabledPoints} visited={visited} todo={todo} hour={hour}
            selectedPointId={selectedPointId} onSelectPoint={onSelectPoint} role={employee.type} />
        ) : (
          <MiniTab employee={employee} visited={visited} total={enabledPoints.length} date={date} toast={toast} role={employee.type} />
        )}
      </div>
    </>
  );
}

/* ---------- detail tab ---------- */
function DetailTab({ employee, points, visited, todo, hour, selectedPointId, onSelectPoint, role }: {
  employee: Employee;
  points: VisitPoint[];
  visited: VisitPoint[];
  todo: VisitPoint[];
  hour: number;
  selectedPointId: string | null;
  onSelectPoint: (p: VisitPoint) => void;
  role: Employee["type"];
}) {
  const [pill, setPill] = useState<"visited" | "todo">("todo");
  const [query, setQuery] = useState("");
  const [sortAsc, setSortAsc] = useState(true);
  const [spinning, setSpinning] = useState(false);

  const source = pill === "visited" ? visited : todo;
  const list = useMemo(() => {
    let out = source.filter((p) => p.name.toLowerCase().includes(query.trim().toLowerCase()));
    out = [...out].sort((a, b) => (sortAsc ? a.planned - b.planned : b.planned - a.planned));
    return out;
  }, [source, query, sortAsc]);

  void employee; void points; void hour;

  return (
    <div className="p-3">
      {/* pills */}
      <div className="flex items-center gap-2">
        <div className="flex flex-1 gap-1 rounded-xl bg-slate-100 p-1">
          <button onClick={() => setPill("visited")}
            className={cn("flex-1 rounded-lg py-1.5 text-[11.5px] font-bold transition-all",
              pill === "visited" ? "bg-teal-deep text-white shadow" : "text-ink-soft hover:text-ink")}>
            Посещенные ({visited.length})
          </button>
          <button onClick={() => setPill("todo")}
            className={cn("flex-1 rounded-lg py-1.5 text-[11.5px] font-bold transition-all",
              pill === "todo" ? "bg-teal-deep text-white shadow" : "text-ink-soft hover:text-ink")}>
            Надо посетить ({todo.length})
          </button>
        </div>
        <button onClick={() => { setSpinning(true); setTimeout(() => setSpinning(false), 700); }}
          aria-label="Обновить"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-slate-200 bg-gps-card text-teal-deep transition-colors hover:border-teal-brand/60">
          <RefreshCw className={cn("h-4 w-4", spinning && "animate-spin")} />
        </button>
      </div>

      {/* sort + search */}
      <div className="mt-2.5 flex gap-2">
        <button onClick={() => setSortAsc((s) => !s)}
          className="flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-gps-card px-2.5 py-2 text-[11.5px] font-bold text-ink transition-colors hover:border-teal-brand/50">
          {sortAsc ? <ArrowDownWideNarrow className="h-3.5 w-3.5 text-teal-deep" /> : <ArrowUpWideNarrow className="h-3.5 w-3.5 text-teal-deep" />}
          Сорт. по часам
        </button>
        <label className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-soft" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Поиск"
            className="w-full rounded-lg border border-slate-200 bg-slate-50/60 py-2 pl-8.5 pr-3 text-[12px] font-medium outline-none transition-all placeholder:text-ink-soft/70 focus:border-teal-brand focus:bg-white focus:ring-2 focus:ring-teal-brand/20" />
        </label>
      </div>

      {/* list */}
      {list.length === 0 ? (
        <Empty />
      ) : (
        <div className="relative mt-3 pl-5">
          <div className="absolute bottom-3 left-[7px] top-3 w-px bg-teal-100" />
          <ol key={pill + sortAsc + employee.id} className="space-y-2">
            {list.map((p, i) => {
              const done = p.arrived !== null && p.arrived <= hour;
              const active = selectedPointId === p.id;
              const color = done ? STATUS_META[p.status].color : "#c3d2cd";
              const routeDist = p.distance < 1 ? `${Math.round(p.distance * 1000)} м` : `${p.distance.toFixed(1).replace(".", ",")} км`;
              const clientDist =
                p.distanceToClient != null
                  ? fmtKm(p.distanceToClient)
                  : p.index === 1
                    ? "—"
                    : routeDist;
              const orderValue = fmtOrderValue(p);
              const cashFull =
                p.cashCollected > 0
                  ? fmtSomAmount(Math.round(p.cashCollected * 1_000_000))
                  : null;
              const wasAt = p.wasAtPoint ?? done;
              const photosCount = p.photos?.length ?? (p.photoTaken ? 1 : 0);
              return (
                <li key={p.id} className="rise relative pl-8" style={{ animationDelay: `${Math.min(i, 14) * 30}ms` }}>
                  <span className="absolute -left-5 top-1/2 z-10 h-3.5 w-3.5 -translate-y-1/2 rounded-full border-[2.5px] border-gps-card shadow"
                    style={{ background: done ? color : "#fff", boxShadow: `0 0 0 1.5px ${done ? color : "#c3d2cd"}` }} />
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 rounded-full bg-teal-deep px-2 py-1 text-[10px] font-extrabold tabular-nums text-white shadow-sm">
                    {fmtHour(p.arrived !== null ? p.arrived : p.planned)}
                  </span>
                  <button onClick={() => onSelectPoint(p)}
                    className={cn("w-full rounded-xl border bg-gps-card px-3 py-2.5 text-left transition-all",
                      active
                        ? "border-teal-brand shadow-[0_5px_16px_-7px_rgba(15,158,142,0.6)]"
                        : "border-slate-200 hover:-translate-y-0.5 hover:border-teal-brand/40 hover:shadow-md")}>
                    <div className="flex items-center gap-2">
                      <span className="truncate text-[12.5px] font-bold text-ink">{p.name}</span>
                      {done && (
                        <span className="ml-auto shrink-0 rounded-full px-2 py-0.5 text-[9.5px] font-extrabold"
                          style={{ background: color + "1c", color }}>
                          {STATUS_META[p.status].label}
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-[10.5px] text-ink-soft">
                      <span className="truncate">{p.address}</span>
                      {orderValue && (
                        <span className="ml-auto shrink-0 font-bold text-emerald-600">
                          {orderValue}
                        </span>
                      )}
                    </div>
                    <div className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-0.5 border-t border-slate-100 pt-1.5 text-[10px] font-semibold text-ink-soft">
                      <span>{role === "inkasator" ? "Расстояние:" : "Расстояние до клиента:"}</span>
                      <span className="text-right tabular-nums text-ink">{clientDist}</span>
                      <span>Был в точке:</span>
                      <span className={cn("text-right", wasAt ? "text-emerald-600" : "text-ink-soft")}>{wasAt ? "Да" : "Нет"}</span>
                      {orderValue && (
                        <>
                          <span>Заказ:</span>
                          <span className="text-right tabular-nums text-emerald-600">{orderValue}</span>
                        </>
                      )}
                      {p.orderReason && (
                        <>
                          <span>Причина заявки:</span>
                          <span className="text-right text-ink">{p.orderReason}</span>
                        </>
                      )}
                      {p.orderComment && (
                        <>
                          <span>Комментарий:</span>
                          <span className="text-right text-ink line-clamp-2">{p.orderComment}</span>
                        </>
                      )}
                      {(p.refusalReason || p.refusalComment || p.status === "rejected") && (
                        <>
                          <span className="text-rose-600">Отказ:</span>
                          <span className="text-right text-rose-600">{p.refusalReason || "Да"}</span>
                          {p.refusalComment && (
                            <>
                              <span>Коммент. отказа:</span>
                              <span className="text-right text-ink line-clamp-2">{p.refusalComment}</span>
                            </>
                          )}
                        </>
                      )}
                      {photosCount > 0 && (
                        <>
                          <span>Фотоотчёты:</span>
                          <span className="text-right text-teal-deep">{photosCount}</span>
                        </>
                      )}
                      {role === "inkasator" && done && (
                        <>
                          <span>Собрано:</span>
                          <span className={cn("text-right tabular-nums",
                            p.cashCollected >= p.cashExpected - 0.01 ? "text-emerald-600" : "text-amber-600")}>
                            {cashFull ?? `${p.cashCollected.toFixed(1).replace(".", ",")} млн`}
                            {" / "}
                            {fmtSomAmount(Math.round(p.cashExpected * 1_000_000))}
                          </span>
                          <span>Способ:</span>
                          <span className="text-right text-ink">{payMethodLabel(p.payMethod)}</span>
                        </>
                      )}
                      {role === "inkasator" && !done && p.cashExpected > 0 && (
                        <>
                          <span>Плановая сумма:</span>
                          <span className="text-right tabular-nums text-ink">{fmtSomAmount(Math.round(p.cashExpected * 1_000_000))}</span>
                        </>
                      )}
                      {role === "vansell" && (
                        <>
                          <span>Доставлено:</span>
                          <span className={cn("text-right", p.delivered ? "text-emerald-600" : "text-ink-soft")}>{p.delivered ? "Да" : "Нет"}</span>
                          <span>Оплата:</span>
                          <span className={cn("text-right", p.paid ? "text-emerald-600" : "text-ink-soft")}>
                            {p.paid ? "получена" : p.delivered ? "ожидается" : "—"}
                          </span>
                        </>
                      )}
                      {role === "delivery" && (
                        <>
                          <span>Доставлено:</span>
                          <span className={cn("text-right", p.delivered ? "text-emerald-600" : "text-ink-soft")}>{p.delivered ? "Да" : "Нет"}</span>
                        </>
                      )}
                    </div>
                  </button>
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </div>
  );
}

/* ---------- mini tab ---------- */
function MiniTab({ employee, visited, total, date, toast, role }: {
  employee: Employee;
  visited: VisitPoint[];
  total: number;
  date: Date;
  toast: (m: string) => void;
  role: Employee["type"];
}) {
  const [query, setQuery] = useState("");
  const [spinning, setSpinning] = useState(false);

  const rows = visited.filter((p) => p.name.toLowerCase().includes(query.trim().toLowerCase()));
  const progress = total ? Math.round((visited.length / total) * 100) : 0;

  const exportCsv = () => {
    const head = ["№", "Время активности", "Тип места", "Интервал (мин)", "Длительность (мин)", "Ожидаемая (мин)", "Расстояние (м)", "Точность (м)", "Батарея (%)", "Интернет", "Заказ (млн)"];
    if (role === "inkasator") head.push("Ожид. сумма (млн)", "Собрано (млн)", "Способ");
    if (role === "vansell") head.push("Доставлено", "Оплата");
    let prev: number | null = null;
    const lines = rows.map((p) => {
      const interval = prev !== null && p.arrived !== null ? Math.round((p.arrived - prev) * 60) : "";
      if (p.arrived !== null) prev = p.arrived;
      const base = [p.index, p.arrived !== null ? fmtHour(p.arrived) : "", p.placeType, interval, p.duration, p.expectedDuration,
        Math.round(p.distance * 1000), p.accuracy, p.batteryAt, p.internet, p.orderSum || ""];
      if (role === "inkasator") base.push(p.cashExpected || "", p.cashCollected || "", payMethodLabel(p.payMethod));
      if (role === "vansell") base.push(p.delivered ? "Да" : "Нет", p.paid ? "Да" : "Нет");
      return base.join(";");
    });
    const csv = "\uFEFF" + [head.join(";"), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `mini_${employee.code}_${dateKeySafe(date)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast("Excel-файл сформирован и скачан");
  };

  const cols = ["№", "Время активности", "Тип места", "Интервал между визитами", "Длительность визита", "Ожидаемая длительность", "Расстояние до клиента по маршруту (м)", "Ожидаемая длина маршрута", "Точность", "Батарея", "Интернет"];
  if (role === "inkasator") cols.push("Ожид. сумма", "Собрано", "Способ");
  if (role === "vansell") cols.push("Доставлено", "Оплата");

  let prevArr: number | null = null;

  return (
    <div className="p-3">
      <div className="rounded-xl border border-slate-200 bg-gps-card p-3">
        {/* toolbar */}
        <div className="flex gap-2">
          <label className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Поиск"
              className="w-full rounded-lg border border-slate-200 bg-slate-50/60 py-2 pl-9 pr-3 text-[12.5px] font-medium outline-none transition-all placeholder:text-ink-soft/70 focus:border-teal-brand focus:bg-white focus:ring-2 focus:ring-teal-brand/20" />
          </label>
          <button onClick={() => { setSpinning(true); setTimeout(() => setSpinning(false), 700); }}
            aria-label="Обновить"
            className="grid w-10 place-items-center rounded-lg border border-slate-200 text-teal-deep transition-colors hover:border-teal-brand/60">
            <RefreshCw className={cn("h-4 w-4", spinning && "animate-spin")} />
          </button>
          <button onClick={exportCsv}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-[12px] font-bold text-ink transition-all hover:-translate-y-0.5 hover:border-emerald-400 hover:text-emerald-700">
            <FileSpreadsheet className="h-4 w-4 text-emerald-600" /> Excel
          </button>
        </div>

        {/* table */}
        <div className="scroll-slim mt-3 overflow-x-auto rounded-lg border border-slate-100">
          <table className="w-full min-w-[760px] text-left text-[11px]">
            <thead>
              <tr className="bg-slate-50 text-[10px] font-bold text-ink-soft">
                {cols.map((c) => (
                  <th key={c} className="whitespace-nowrap px-2.5 py-2.5 align-top">{c}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.length === 0 && (
                <tr>
                  <td colSpan={cols.length} className="px-3 py-10 text-center text-[12.5px] font-semibold text-ink-soft">
                    Пусто
                  </td>
                </tr>
              )}
              {rows.map((p) => {
                const interval = prevArr !== null && p.arrived !== null ? Math.round((p.arrived - prevArr) * 60) : null;
                if (p.arrived !== null) prevArr = p.arrived;
                return (
                  <tr key={p.id} className="transition-colors hover:bg-teal-50/40">
                    <td className="px-2.5 py-2 font-display font-semibold text-ink-soft">{p.index}</td>
                    <td className="px-2.5 py-2 tabular-nums text-ink">{p.arrived !== null ? fmtHour(p.arrived) : "—"}</td>
                    <td className="px-2.5 py-2"><span className="rounded bg-slate-100 px-1.5 py-0.5 font-bold text-ink-soft">{p.placeType}</span></td>
                    <td className="px-2.5 py-2 tabular-nums text-ink">{interval ?? "—"}</td>
                    <td className="px-2.5 py-2 tabular-nums text-ink">{p.duration || "—"}</td>
                    <td className="px-2.5 py-2 tabular-nums text-ink-soft">{p.expectedDuration}</td>
                    <td className="px-2.5 py-2 tabular-nums text-ink">{Math.round(p.distance * 1000) || "—"}</td>
                    <td className="px-2.5 py-2 tabular-nums text-ink-soft">{Math.round(p.distance * 1250) || "—"}</td>
                    <td className="px-2.5 py-2 tabular-nums text-ink-soft">{p.accuracy} м</td>
                    <td className="px-2.5 py-2"><span className={cn("font-bold", (p.batteryAt ?? 0) > 40 ? "text-emerald-600" : (p.batteryAt ?? 0) > 20 ? "text-amber-600" : "text-rose-600")}>{p.batteryAt == null ? "—" : `${p.batteryAt}%`}</span></td>
                    <td className="px-2.5 py-2"><span className={cn("font-bold", p.internet === "4G" || p.internet === "WiFi" ? "text-teal-deep" : p.internet === "3G" ? "text-amber-600" : "text-slate-400")}>{p.internet}</span></td>
                    {role === "inkasator" && (
                      <>
                        <td className="px-2.5 py-2 tabular-nums text-ink">{p.cashExpected.toFixed(1).replace(".", ",")}</td>
                        <td className={cn("px-2.5 py-2 font-bold tabular-nums",
                          p.cashCollected >= p.cashExpected - 0.01 ? "text-emerald-600" : "text-amber-600")}>
                          {p.cashCollected.toFixed(1).replace(".", ",")}
                        </td>
                        <td className="px-2.5 py-2"><span className="rounded bg-slate-100 px-1.5 py-0.5 font-bold text-ink-soft">{payMethodLabel(p.payMethod)}</span></td>
                      </>
                    )}
                    {role === "vansell" && (
                      <>
                        <td className="px-2.5 py-2">
                          <span className={cn("rounded-full px-2 py-0.5 text-[9.5px] font-extrabold",
                            p.delivered ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-500")}>
                            {p.delivered ? "Да" : "Нет"}
                          </span>
                        </td>
                        <td className="px-2.5 py-2">
                          <span className={cn("rounded-full px-2 py-0.5 text-[9.5px] font-extrabold",
                            p.paid ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600")}>
                            {p.paid ? "Получена" : "Ожидается"}
                          </span>
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* progress */}
        <div className="mt-3">
          <div className="mb-1 flex justify-between text-[10px] font-bold text-ink-soft">
            <span>Выполнение маршрута</span>
            <span className="tabular-nums text-teal-deep">{progress}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-teal-deep transition-all duration-700" style={{ width: `${progress}%` }} />
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2 rounded-xl border border-dashed border-slate-200 bg-gps-card/60 px-3 py-2 text-[11px] text-ink-soft">
        <Filter className="h-3.5 w-3.5 text-teal-deep" />
        Данные телеметрии: {employee.code} · точность GPS ±{Math.round(visited.reduce((s, p) => s + p.accuracy, 0) / Math.max(1, visited.length))} м
      </div>
    </div>
  );
}

/* ================= SUPERVISOR MODE ================= */
function SupervisorMode({ supervisor, subRoutes, hour, date, onDate, onBack, onOpenAgent, toast, initialTab }: {
  supervisor: Employee;
  subRoutes: AgentRouteSummary[];
  hour: number;
  date: Date;
  onDate: (d: Date) => void;
  onBack: () => void;
  onOpenAgent: (e: Employee) => void;
  toast: (m: string) => void;
  initialTab: "report" | "mini";
}) {
  const [tab, setTab] = useState<"report" | "mini">(initialTab);
  const [pill, setPill] = useState<"all" | "offline">("all");
  const [query, setQuery] = useState("");
  const [calOpen, setCalOpen] = useState(false);
  const [spinning, setSpinning] = useState(false);

  const stats = useMemo(() => subRoutes.map((r) => {
    const visited = r.points.filter((p) => p.arrived !== null && p.arrived <= hour);
    const total = r.points.length;
    return {
      ...r,
      visited: visited.length,
      total,
      coverage: total ? Math.round((visited.length / total) * 100) : 0,
      km: r.points.reduce((s, p) => s + p.distance, 0),
      sum: r.points.reduce((s, p) => s + p.orderSum, 0),
      orders: r.points.filter((p) => p.status === "ordered").length,
    };
  }), [subRoutes, hour]);

  const offlineCount = stats.filter((s) => !s.employee.online).length;
  const list = stats
    .filter((s) => (pill === "all" ? true : !s.employee.online))
    .filter((s) => (`${s.employee.code} ${s.employee.name}`).toLowerCase().includes(query.trim().toLowerCase()));

  const agg = {
    visited: stats.reduce((s, a) => s + a.visited, 0),
    total: stats.reduce((s, a) => s + a.total, 0),
    km: stats.reduce((s, a) => s + a.km, 0),
    sum: stats.reduce((s, a) => s + a.sum, 0),
    online: stats.filter((s) => s.employee.online).length,
  };

  const exportCsv = () => {
    const head = ["№", "Агент", "Код", "Территория", "Точек", "Посещено", "Покрытие %", "Пробег (м)", "Заказов", "Сумма (млн)", "Батарея %", "Статус"];
    const lines = stats.map((s, i) => [
      i + 1, s.employee.name, s.employee.code, s.employee.territory, s.total, s.visited, s.coverage,
      Math.round(s.km * 1000), s.orders, s.sum.toFixed(1).replace(".", ","), s.employee.battery,
      s.employee.online ? "на маршруте" : "офлайн",
    ].join(";"));
    const csv = "\uFEFF" + [head.join(";"), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `nazorat_${supervisor.code}_${dateKeySafe(date)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast("Отчёт по контролю скачан в формате Excel");
  };

  return (
    <>
      {/* header */}
      <div className="flex items-center gap-3 border-b border-slate-200 bg-gps-card px-3 py-3.5">
        <button onClick={onBack} aria-label="Назад"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-slate-200 text-ink-soft transition-all hover:-translate-x-0.5 hover:border-teal-brand/50 hover:text-teal-deep">
          <ArrowLeft className="h-4.5 w-4.5" />
        </button>
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-pine-900 text-teal-200">
          <ShieldCheck className="h-5 w-5" />
        </span>
        <div className="min-w-0 leading-tight">
          <div className="truncate text-[13px] font-extrabold text-ink">{supervisor.name}</div>
          <div className="mt-0.5 text-[11px] font-medium text-teal-deep">
            Контроль территории · {stats.length} агентов · {agg.online} на маршруте
          </div>
        </div>
      </div>

      {/* date */}
      <div className="border-b border-slate-200 bg-gps-card px-3 py-2.5">
        <div className="relative flex items-center rounded-lg border border-slate-200 bg-white">
          <button onClick={() => { const d = new Date(date); d.setDate(d.getDate() - 1); onDate(d); }}
            className="grid h-9 w-9 place-items-center text-ink-soft transition-colors hover:text-teal-deep">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button onClick={() => setCalOpen((o) => !o)}
            className="flex-1 whitespace-nowrap border-x border-slate-200 py-2 text-center text-[12.5px] font-bold text-ink transition-colors hover:text-teal-deep">
            {fmtDateLabel(date)}
          </button>
          <button onClick={() => { const d = new Date(date); d.setDate(d.getDate() + 1); onDate(d); }}
            className="grid h-9 w-9 place-items-center text-ink-soft transition-colors hover:text-teal-deep">
            <ChevronRight className="h-4 w-4" />
          </button>
          {calOpen && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setCalOpen(false)} />
              <div className="absolute left-2 top-full z-40">
                <Calendar value={date} onPick={(d) => { onDate(d); setCalOpen(false); }} />
              </div>
            </>
          )}
        </div>
      </div>

      {/* tabs */}
      <div className="flex gap-6 border-b border-slate-200 bg-gps-card px-4">
        {([["report", "Отчёт по контролю"], ["mini", "Мини-отчёт"]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)}
            className={cn("relative py-2.5 text-[12.5px] font-bold transition-colors",
              tab === k ? "text-teal-deep" : "text-ink-soft hover:text-ink")}>
            {l}
            <span className={cn("absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-teal-deep transition-all duration-300",
              tab === k ? "opacity-100 scale-x-100" : "opacity-0 scale-x-0")} />
          </button>
        ))}
      </div>

      <div className="scroll-slim min-h-0 flex-1 overflow-y-auto">
        {tab === "report" ? (
          <div className="p-3">
            {/* aggregate chips */}
            <div className="grid grid-cols-3 gap-2">
              {[
                ["Визиты", `${agg.visited}/${agg.total}`, "text-teal-deep"],
                ["Пробег", fmtKm(agg.km), "text-ink"],
                ["Заказы", `${agg.sum.toFixed(1).replace(".", ",")} млн`, "text-emerald-600"],
              ].map(([l, v, c]) => (
                <div key={l} className="rounded-xl border border-slate-200 bg-gps-card px-2.5 py-2 text-center shadow-sm">
                  <div className={cn("font-display text-[13px] font-semibold tabular-nums", c)}>{v}</div>
                  <div className="text-[9.5px] font-bold uppercase tracking-wide text-ink-soft">{l}</div>
                </div>
              ))}
            </div>

            {/* pills + search */}
            <div className="mt-3 flex items-center gap-2">
              <div className="flex flex-1 gap-1 rounded-xl bg-slate-100 p-1">
                <button onClick={() => setPill("all")}
                  className={cn("flex-1 rounded-lg py-1.5 text-[11.5px] font-bold transition-all",
                    pill === "all" ? "bg-teal-deep text-white shadow" : "text-ink-soft hover:text-ink")}>
                  Все ({stats.length})
                </button>
                <button onClick={() => setPill("offline")}
                  className={cn("flex-1 rounded-lg py-1.5 text-[11.5px] font-bold transition-all",
                    pill === "offline" ? "bg-teal-deep text-white shadow" : "text-ink-soft hover:text-ink")}>
                  Офлайн ({offlineCount})
                </button>
              </div>
              <button onClick={() => { setSpinning(true); setTimeout(() => setSpinning(false), 700); }}
                aria-label="Обновить"
                className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-slate-200 bg-gps-card text-teal-deep transition-colors hover:border-teal-brand/60">
                <RefreshCw className={cn("h-4 w-4", spinning && "animate-spin")} />
              </button>
            </div>
            <label className="relative mt-2.5 block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-soft" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Поиск по агенту"
                className="w-full rounded-lg border border-slate-200 bg-slate-50/60 py-2 pl-8.5 pr-3 text-[12px] font-medium outline-none transition-all placeholder:text-ink-soft/70 focus:border-teal-brand focus:bg-white focus:ring-2 focus:ring-teal-brand/20" />
            </label>

            {/* agent cards */}
            {list.length === 0 ? (
              <Empty text="Агенты не найдены" />
            ) : (
              <ol key={pill + supervisor.id} className="mt-3 space-y-2">
                {list.map((s, i) => (
                  <li key={s.employee.id} className="rise" style={{ animationDelay: `${Math.min(i, 12) * 40}ms` }}>
                    <button onClick={() => onOpenAgent(s.employee)}
                      className="group w-full rounded-xl border border-slate-200 bg-gps-card p-3 text-left transition-all hover:-translate-y-0.5 hover:border-teal-brand/50 hover:shadow-md">
                      <div className="flex items-center gap-2.5">
                        <span className="relative grid h-9 w-9 shrink-0 place-items-center rounded-full bg-pine-900 font-display text-[10px] font-semibold text-teal-200">
                          {s.employee.name.split(" ").map((w) => w[0]).slice(0, 2).join("")}
                          <span className={cn("absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-gps-card",
                            s.employee.online ? "bg-emerald-500" : "bg-slate-300")} />
                        </span>
                        <span className="min-w-0 flex-1 leading-tight">
                          <span className="block truncate text-[12.5px] font-bold text-ink">{s.employee.name}</span>
                          <span className="block truncate text-[10.5px] text-ink-soft">
                            {s.employee.code} · ({s.employee.territory})
                          </span>
                        </span>
                        <span className={cn("flex items-center gap-1 text-[10.5px] font-bold",
                          s.employee.online ? "text-emerald-600" : "text-slate-400")}>
                          {s.employee.online ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
                          {s.employee.online ? "на маршруте" : "офлайн"}
                        </span>
                        <ArrowRight className="h-4 w-4 text-ink-soft opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100" />
                      </div>

                      <div className="mt-2.5">
                        <div className="mb-1 flex justify-between text-[10px] font-bold text-ink-soft">
                          <span>Визиты: {s.visited}/{s.total}</span>
                          <span className="tabular-nums" style={{ color: s.coverage >= 60 ? "#16a34a" : s.coverage >= 30 ? "#d69e27" : "#e11d48" }}>
                            {s.coverage}%
                          </span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                          <div className="h-full rounded-full transition-all duration-700"
                            style={{ width: `${s.coverage}%`, background: s.coverage >= 60 ? "#16a34a" : s.coverage >= 30 ? "#d69e27" : "#e11d48" }} />
                        </div>
                      </div>

                      <div className="mt-2 flex items-center gap-3 border-t border-slate-100 pt-2 text-[10.5px] font-semibold text-ink-soft">
                        <span className="flex items-center gap-1"><MapPin className="h-3 w-3 text-teal-deep" />{fmtKm(s.km)}</span>
                        <span className="text-emerald-600">{s.orders} заказ</span>
                        <span className="ml-auto flex items-center gap-1">
                          <BatteryMedium className={cn("h-3.5 w-3.5", (s.employee.battery ?? 0) > 50 ? "text-emerald-500" : (s.employee.battery ?? 0) > 25 ? "text-amber-500" : "text-rose-500")} />
                          {s.employee.battery == null ? "—" : `${s.employee.battery}%`}
                        </span>
                      </div>
                    </button>
                  </li>
                ))}
              </ol>
            )}
          </div>
        ) : (
          /* mini tab */
          <div className="p-3">
            <div className="rounded-xl border border-slate-200 bg-gps-card p-3">
              <div className="flex gap-2">
                <label className="relative flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" />
                  <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Поиск"
                    className="w-full rounded-lg border border-slate-200 bg-slate-50/60 py-2 pl-9 pr-3 text-[12.5px] font-medium outline-none transition-all placeholder:text-ink-soft/70 focus:border-teal-brand focus:bg-white focus:ring-2 focus:ring-teal-brand/20" />
                </label>
                <button onClick={() => { setSpinning(true); setTimeout(() => setSpinning(false), 700); }}
                  aria-label="Обновить"
                  className="grid w-10 place-items-center rounded-lg border border-slate-200 text-teal-deep transition-colors hover:border-teal-brand/60">
                  <RefreshCw className={cn("h-4 w-4", spinning && "animate-spin")} />
                </button>
                <button onClick={exportCsv}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-[12px] font-bold text-ink transition-all hover:-translate-y-0.5 hover:border-emerald-400 hover:text-emerald-700">
                  <FileSpreadsheet className="h-4 w-4 text-emerald-600" /> Excel
                </button>
              </div>

              <div className="scroll-slim mt-3 overflow-x-auto rounded-lg border border-slate-100">
                <table className="w-full min-w-[680px] text-left text-[11px]">
                  <thead>
                    <tr className="bg-slate-50 text-[10px] font-bold text-ink-soft">
                      {["№", "Агент", "Точек", "Визиты", "Покрытие", "Расстояние", "Заказы", "Посл. активность", "Батарея", "Статус"].map((c) => (
                        <th key={c} className="whitespace-nowrap px-2.5 py-2.5 align-top">{c}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {list.length === 0 && (
                      <tr><td colSpan={10} className="px-3 py-10 text-center text-[12.5px] font-semibold text-ink-soft">Пусто</td></tr>
                    )}
                    {list.map((s, i) => (
                      <tr key={s.employee.id} onClick={() => onOpenAgent(s.employee)}
                        className="cursor-pointer transition-colors hover:bg-teal-50/40">
                        <td className="px-2.5 py-2 font-display font-semibold text-ink-soft">{i + 1}</td>
                        <td className="px-2.5 py-2">
                          <div className="font-bold text-ink">{s.employee.name}</div>
                          <div className="text-[10px] text-ink-soft">{s.employee.code}</div>
                        </td>
                        <td className="px-2.5 py-2 tabular-nums text-ink">{s.total}</td>
                        <td className="px-2.5 py-2 tabular-nums text-ink">{s.visited}</td>
                        <td className="px-2.5 py-2">
                          <span className="font-bold tabular-nums" style={{ color: s.coverage >= 60 ? "#16a34a" : s.coverage >= 30 ? "#d69e27" : "#e11d48" }}>
                            {s.coverage}%
                          </span>
                        </td>
                        <td className="px-2.5 py-2 tabular-nums text-ink">{fmtKm(s.km)}</td>
                        <td className="px-2.5 py-2 tabular-nums text-emerald-600">{s.sum ? `${s.sum.toFixed(1).replace(".", ",")} млн` : "—"}</td>
                        <td className="px-2.5 py-2 tabular-nums text-ink-soft">{s.employee.lastSeen}</td>
                        <td className="px-2.5 py-2"><span className={cn("font-bold", (s.employee.battery ?? 0) > 40 ? "text-emerald-600" : (s.employee.battery ?? 0) > 20 ? "text-amber-600" : "text-rose-600")}>{s.employee.battery == null ? "—" : `${s.employee.battery}%`}</span></td>
                        <td className="px-2.5 py-2">
                          <span className={cn("rounded-full px-2 py-0.5 text-[9.5px] font-extrabold",
                            s.employee.online ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-500")}>
                            {s.employee.online ? "онлайн" : "офлайн"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-3">
                <div className="mb-1 flex justify-between text-[10px] font-bold text-ink-soft">
                  <span>Покрытие территории</span>
                  <span className="tabular-nums text-teal-deep">
                    {agg.total ? Math.round((agg.visited / agg.total) * 100) : 0}%
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-teal-deep transition-all duration-700"
                    style={{ width: `${agg.total ? (agg.visited / agg.total) * 100 : 0}%` }} />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

const dateKeySafe = (d: Date) => `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
