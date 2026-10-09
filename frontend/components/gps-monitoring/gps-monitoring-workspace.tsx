"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  CircleDashed,
  Layers3,
  FileBarChart2,
  ReceiptText
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { api } from "@/lib/api";
import { useAuthStore, useAuthStoreHydrated } from "@/lib/auth-store";
import { STALE } from "@/lib/query-stale";
import { cn } from "@/lib/utils";
import MonitoringPanel from "./monitoring-panel";
import BottomBar from "./bottom-bar";
import type {
  AgentRoute,
  Employee,
  OverviewAgent,
  OverviewCluster,
  SupervisorOption,
  TrackPoint,
  TradingPoint,
  VisitModule,
  VisitPoint
} from "./types";
import { ROLE_META, dateKey } from "./types";
import "./gps-monitoring.css";

const MapView = dynamic(() => import("./map-view"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center bg-paper text-sm text-ink-soft">
      Загрузка карты…
    </div>
  )
});

function useCountUp(value: number, ms = 500) {
  const [display, setDisplay] = useState(value);
  const prev = useRef(value);
  useEffect(() => {
    const from = prev.current;
    prev.current = value;
    if (from === value) return;
    const t0 = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / ms);
      const e = 1 - (1 - p) ** 3;
      setDisplay(Math.round(from + (value - from) * e));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, ms]);
  return display;
}

type EmployeesPayload = {
  employees: Employee[];
  supervisors: SupervisorOption[];
};

type DayPayload = {
  employee: Employee;
  points: VisitPoint[];
  track: TrackPoint[];
  date: string;
};

export function GpsMonitoringWorkspace() {
  const tenantSlug = useAuthStore((s) => s.tenantSlug);
  const hydrated = useAuthStoreHydrated();

  const [view, setView] = useState<"list" | "detail">("list");
  const [tab, setTab] = useState<"detail" | "mini">("detail");
  const [selected, setSelected] = useState<Employee | null>(null);
  const [date, setDate] = useState<Date>(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [hour, setHour] = useState(() => {
    const n = new Date();
    return Math.min(23, n.getHours() + n.getMinutes() / 60);
  });
  const [playing, setPlaying] = useState(false);
  const [selectedPointId, setSelectedPointId] = useState<string | null>(null);
  const [modules, setModules] = useState<Record<VisitModule, boolean>>({
    client: true,
    warehouse: true,
    cash: true,
    fuel: true,
    start: true
  });
  const [locateNonce, setLocateNonce] = useState(0);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [visibleEmployeeIds, setVisibleEmployeeIds] = useState<string[] | null>(null);
  const toastTimer = useRef<number>(0);

  const dateIso = dateKey(date);
  const isSupervisor = selected?.type === "supervisor";

  const employeesQ = useQuery({
    queryKey: ["gps-monitoring-employees", tenantSlug, dateIso],
    enabled: Boolean(tenantSlug) && hydrated,
    staleTime: STALE.reference,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data } = await api.get<{ data: EmployeesPayload }>(
        `/api/${tenantSlug}/gps-monitoring/employees`,
        { params: { date: dateIso } }
      );
      return data.data;
    }
  });

  const employees = employeesQ.data?.employees ?? [];
  const supervisors = employeesQ.data?.supervisors ?? [];

  useEffect(() => {
    if (!selected) return;
    const row = employees.find((e) => e.id === selected.id);
    if (row && row.activeOnDate === false) {
      setSelected(null);
      setSelectedPointId(null);
    }
  }, [employees, selected]);

  const dayQ = useQuery({
    queryKey: ["gps-monitoring-day", tenantSlug, selected?.id, dateIso],
    enabled: Boolean(tenantSlug) && hydrated && Boolean(selected) && !isSupervisor,
    staleTime: STALE.live,
    queryFn: async () => {
      const { data } = await api.get<{ data: DayPayload }>(`/api/${tenantSlug}/gps-monitoring/day`, {
        params: { employee_id: selected!.id, date: dateIso }
      });
      return data.data;
    }
  });

  const points = dayQ.data?.points ?? [];
  const rawTrack = dayQ.data?.track ?? [];

  /** To‘liq trek (soat bilan); ping bo‘lmasa — tashriflardan */
  const trackTimed: TrackPoint[] = useMemo(() => {
    if (rawTrack.length > 1) return rawTrack;
    const visited = points
      .filter((p) => p.arrived !== null)
      .sort((a, b) => (a.arrived ?? 0) - (b.arrived ?? 0))
      .map((p) => ({ lat: p.lat, lng: p.lng, hour: p.arrived ?? 0 }));
    return visited.length > 1 ? visited : rawTrack;
  }, [rawTrack, points]);

  /** Playback: joriy soatgacha bo‘lgan GPS yo‘li — map ichida filter qilinadi */
  /** Agent pozitsiyasi — oxirgi ping / interpolatsiya */
  const agentCursor = useMemo((): [number, number] | null => {
    if (!trackTimed.length) {
      const visited = points
        .filter((p) => p.arrived !== null && p.arrived <= hour)
        .sort((a, b) => (a.arrived ?? 0) - (b.arrived ?? 0));
      const last = visited[visited.length - 1];
      return last ? [last.lat, last.lng] : null;
    }
    let prev = trackTimed[0]!;
    if (hour < prev.hour) return [prev.lat, prev.lng];
    for (let i = 1; i < trackTimed.length; i++) {
      const next = trackTimed[i]!;
      if (hour < next.hour) {
        const span = next.hour - prev.hour || 1;
        const t = Math.min(1, Math.max(0, (hour - prev.hour) / span));
        return [prev.lat + (next.lat - prev.lat) * t, prev.lng + (next.lng - prev.lng) * t];
      }
      prev = next;
    }
    const last = trackTimed[trackTimed.length - 1]!;
    return [last.lat, last.lng];
  }, [trackTimed, hour, points]);

  const visitMarks = useMemo(
    () =>
      points
        .filter((p) => p.arrived !== null)
        .map((p) => ({
          id: p.id,
          hour: p.arrived as number,
          label: p.name
        })),
    [points]
  );

  /** Timeline: faqat marshrut boshidan oxirigacha */
  const timeRange = useMemo(() => {
    const times: number[] = [];
    for (const t of trackTimed) times.push(t.hour);
    for (const p of points) {
      if (p.arrived != null) times.push(p.arrived);
      if (p.planned != null) times.push(p.planned);
    }
    if (!times.length) return { start: 8, end: 20 };
    const minT = Math.min(...times);
    const maxT = Math.max(...times);
    const start = Math.max(0, Math.floor(minT));
    const end = Math.min(23, Math.max(start + 1, Math.ceil(maxT)));
    return { start, end };
  }, [trackTimed, points]);

  const subIds = useMemo(() => {
    if (!selected || !isSupervisor) return [] as string[];
    return employees.filter((e) => e.supervisorId === selected.id && e.type !== "supervisor").map((e) => e.id);
  }, [selected, isSupervisor, employees]);

  const subRoutesQ = useQuery({
    queryKey: ["gps-monitoring-sub-routes", tenantSlug, selected?.id, dateIso, subIds.join(",")],
    enabled: Boolean(tenantSlug) && hydrated && isSupervisor && subIds.length > 0,
    staleTime: STALE.live,
    queryFn: async () => {
      const routes: AgentRoute[] = [];
      for (const id of subIds) {
        const { data } = await api.get<{ data: DayPayload }>(`/api/${tenantSlug}/gps-monitoring/day`, {
          params: { employee_id: id, date: dateIso }
        });
        routes.push({ employee: data.data.employee, points: data.data.points });
      }
      return routes;
    }
  });

  const subRoutes = subRoutesQ.data ?? [];

  const overviewQ = useQuery({
    queryKey: ["gps-monitoring-overview", tenantSlug],
    enabled: Boolean(tenantSlug) && hydrated,
    staleTime: STALE.reference,
    queryFn: async () => {
      const { data } = await api.get<{
        data: { clusters: OverviewCluster[]; agents?: OverviewAgent[] };
      }>(`/api/${tenantSlug}/gps-monitoring/overview`);
      return data.data;
    }
  });

  const tradingQ = useQuery({
    queryKey: ["gps-monitoring-trading", tenantSlug],
    enabled: Boolean(tenantSlug) && hydrated,
    staleTime: STALE.reference,
    queryFn: async () => {
      const { data } = await api.get<{ data: { points: TradingPoint[] } }>(
        `/api/${tenantSlug}/gps-monitoring/trading-points`,
        { params: { limit: 80 } }
      );
      return data.data.points;
    }
  });

  const trading = tradingQ.data ?? [];
  const overviewClusters = overviewQ.data?.clusters ?? [];
  const overviewAgentsAll = overviewQ.data?.agents ?? [];
  const overviewAgents = useMemo(() => {
    if (visibleEmployeeIds == null) return overviewAgentsAll;
    const allow = new Set(visibleEmployeeIds);
    return overviewAgentsAll.filter((a) => allow.has(a.id));
  }, [overviewAgentsAll, visibleEmployeeIds]);

  const toast = useCallback((m: string) => {
    setToastMsg(m);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToastMsg(null), 2600);
  }, []);

  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => {
      setHour((h) => {
        if (h >= timeRange.end) {
          setPlaying(false);
          return timeRange.end;
        }
        return Math.min(timeRange.end, Math.round((h + 0.15) * 100) / 100);
      });
    }, 200);
    return () => clearInterval(t);
  }, [playing, timeRange.end]);

  useEffect(() => {
    setSelectedPointId(null);
    setPlaying(false);
  }, [selected?.id, dateIso]);

  /** Agent tanlanganda — timeline oxiriga (to‘liq marshrut) */
  useEffect(() => {
    if (!selected || isSupervisor) return;
    if (!dayQ.isSuccess) return;
    setHour(timeRange.end);
  }, [selected?.id, dateIso, dayQ.isSuccess, timeRange.end, isSupervisor, selected]);

  /** Range o‘zgasa — hour oralig‘ida qolsin */
  useEffect(() => {
    setHour((h) => Math.min(timeRange.end, Math.max(timeRange.start, h)));
  }, [timeRange.start, timeRange.end]);

  const handleSelectEmployee = useCallback((e: Employee) => {
    setSelected(e);
    setView("detail");
    setTab("detail");
    setPlaying(false);
  }, []);

  const handleSelectOverviewAgent = useCallback(
    (agentId: string) => {
      const e = employees.find((x) => x.id === agentId);
      if (!e) {
        toast("Сотрудник не найден в списке");
        return;
      }
      handleSelectEmployee(e);
      toast(`${e.code} — маршрут`);
    },
    [employees, handleSelectEmployee, toast]
  );

  const handleBack = useCallback(() => {
    setView("list");
    setSelectedPointId(null);
    setPlaying(false);
  }, []);

  const handleOpenAgent = useCallback(
    (e: Employee) => {
      setSelected(e);
      setView("detail");
      setTab("detail");
      setPlaying(false);
      setSelectedPointId(null);
      toast(`Агент маршрути: ${e.code} · ${e.name}`);
    },
    [toast]
  );

  const openReport = (t: "detail" | "mini") => {
    if (!selected) {
      toast("Сначала выберите сотрудника из списка");
      return;
    }
    setView("detail");
    setTab(t);
  };

  const aggVisited = isSupervisor
    ? subRoutes.reduce((s, r) => s + r.points.filter((p) => p.arrived !== null && p.arrived <= hour).length, 0)
    : points.filter((p) => p.arrived !== null && p.arrived <= hour).length;
  const aggTotal = isSupervisor ? subRoutes.reduce((s, r) => s + r.points.length, 0) : points.length;
  const visited = aggVisited;
  const total = aggTotal;
  const need = total - visited;
  const vA = useCountUp(visited);
  const nA = useCountUp(need);
  const tA = useCountUp(total);

  return (
    <div className="gps-mon flex h-[calc(100vh-4.5rem)] min-h-[640px] flex-col overflow-hidden rounded-xl border border-slate-200 bg-paper shadow-sm">
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-gps-card/70 px-4 py-2.5">
          <div className="min-w-0 leading-tight">
            <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-ink-soft">
              {selected
                ? isSupervisor
                  ? "Супервайзер · назорат территории"
                  : `${ROLE_META[selected.type].label} · ${ROLE_META[selected.type].desc}`
                : "Маршрут сотрудника"}
            </div>
            <div className="truncate font-display text-[13.5px] font-semibold text-ink">
              {selected
                ? isSupervisor
                  ? `${selected.name} · ${subRoutes.length} агентов`
                  : `${selected.code} · ${selected.name}`
                : "Выберите сотрудника из панели мониторинга"}
            </div>
          </div>

        <div className="mx-1 hidden h-8 w-px bg-slate-200 sm:block" />

        <div className="flex items-center gap-2">
          {[
            {
              icon: CheckCircle2,
              label: "Посещено",
              value: selected ? vA : "—",
              tone: "text-emerald-600",
              bg: "bg-emerald-100"
            },
            {
              icon: CircleDashed,
              label: "Надо посетить",
              value: selected ? nA : "—",
              tone: "text-amber-600",
              bg: "bg-amber-100"
            },
            {
              icon: Layers3,
              label: "Всего",
              value: selected ? tA : "—",
              tone: "text-teal-deep",
              bg: "bg-teal-100"
            }
          ].map((s) => (
            <div
              key={s.label}
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-gps-card px-3 py-1.5 shadow-sm"
            >
              <span className={cn("grid h-7 w-7 place-items-center rounded-lg", s.bg)}>
                <s.icon className={cn("h-4 w-4", s.tone)} />
              </span>
              <div className="leading-tight">
                <div className={cn("font-display text-[15px] font-semibold tabular-nums", s.tone)}>
                  {s.value}
                </div>
                <div className="text-[9.5px] font-bold uppercase tracking-wide text-ink-soft">{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => openReport("detail")}
            className="flex items-center gap-1.5 rounded-lg bg-teal-deep px-3 py-2 text-[12px] font-bold text-white shadow-[0_6px_16px_-6px_rgba(11,124,112,0.8)] transition-all hover:-translate-y-0.5 hover:bg-teal-brand"
          >
            <FileBarChart2 className="h-3.5 w-3.5" /> Детальный отчёт
          </button>
          <button
            type="button"
            onClick={() => openReport("mini")}
            className="flex items-center gap-1.5 rounded-lg border border-teal-deep/30 bg-gps-card px-3 py-2 text-[12px] font-bold text-teal-deep shadow-sm transition-all hover:-translate-y-0.5 hover:border-teal-deep hover:bg-teal-50"
          >
            <ReceiptText className="h-3.5 w-3.5" /> Мини отчёт
          </button>
        </div>
      </div>

      <main className="flex min-h-0 flex-1">
        <div className="relative min-w-0 flex-1">
          <MapView
            points={points}
            trading={trading}
            hour={hour}
            employee={selected}
            selectedId={selectedPointId}
            onSelect={(p) => setSelectedPointId(p.id)}
            fitKey={(selected?.id ?? "overview") + dateIso + String(overviewAgents.length)}
            locateNonce={locateNonce}
            modules={modules}
            supervisorRoutes={isSupervisor ? subRoutes : null}
            trackFull={trackTimed}
            agentCursor={agentCursor}
            overviewClusters={overviewClusters}
            overviewAgents={overviewAgents}
            onSelectOverviewAgent={handleSelectOverviewAgent}
          />
          {!selected && (
            <div className="pointer-events-none absolute inset-x-0 top-16 z-[400] flex justify-center">
              <div className="rise flex items-center gap-2 rounded-full border border-slate-200 bg-white/95 px-4 py-2 text-[12.5px] font-bold text-ink shadow-lg backdrop-blur">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal-brand opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-teal-deep" />
                </span>
                Выберите сотрудника справа, чтобы построить маршрут
              </div>
            </div>
          )}
        </div>

        <div className="w-[420px] shrink-0 border-l border-slate-200">
          <MonitoringPanel
            view={view}
            tab={tab}
            onTab={setTab}
            onBack={handleBack}
            selected={selected}
            onSelectEmployee={handleSelectEmployee}
            date={date}
            onDate={setDate}
            points={points}
            hour={hour}
            selectedPointId={selectedPointId}
            onSelectPoint={(p) => setSelectedPointId(p.id)}
            onLocate={(e) => {
              if (selected?.id !== e.id) setSelected(e);
              setLocateNonce((n) => n + 1);
              toast(`${e.code} — позиция на карте`);
            }}
            toast={toast}
            modules={modules}
            onModulesChange={setModules}
            subRoutes={subRoutes}
            onOpenAgent={handleOpenAgent}
            employees={employees}
            supervisors={supervisors}
            onRefresh={() => {
              void employeesQ.refetch();
              void dayQ.refetch();
              void overviewQ.refetch();
            }}
            loading={employeesQ.isFetching}
            onVisibleEmployeesChange={setVisibleEmployeeIds}
          />
        </div>
      </main>

      <div className="border-t border-slate-200 bg-gps-card p-2">
        <BottomBar
          hour={hour}
          onHour={setHour}
          playing={playing}
          onPlaying={setPlaying}
          visitMarks={visitMarks}
          rangeStart={timeRange.start}
          rangeEnd={timeRange.end}
          disabled={!selected || isSupervisor}
        />
      </div>

      <div
        className={cn(
          "pointer-events-none fixed bottom-6 left-1/2 z-[2000] -translate-x-1/2 transition-all duration-300",
          toastMsg ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
        )}
      >
        <div className="flex items-center gap-2 rounded-full bg-pine-950 px-4 py-2.5 text-[12.5px] font-bold text-white shadow-2xl">
          <CheckCircle2 className="h-4 w-4 text-teal-300" />
          {toastMsg}
        </div>
      </div>
    </div>
  );
}
