"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, Camera, Clock, LogIn, LogOut, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { api } from "@/lib/api";
import { accessRoleLabel } from "@/lib/access-role-label";
import { useAuthStore } from "@/lib/auth-store";

type VisitDashboard = {
  date: string;
  today?: string;
  time_zone?: string;
  kpi: {
    headcount: number;
    present: number;
    present_prev: number;
    away: number;
    away_prev: number;
    late: number;
    late_prev: number;
  };
  month: Array<{ day: number; present: number; absent: number }>;
  branches: Array<{ name: string; count: number }>;
  recent: Array<{ id: number; name: string; branch: string | null; role: string; punch_id: number | null }>;
  activity: Array<{
    id: number;
    at: string;
    direction: "IN" | "OUT";
    source: string;
    name: string;
    branch: string | null;
    role?: string;
    has_terminal_photo: boolean;
  }>;
  absences: Array<{ id: number; name: string; type: string; from: string; to: string }>;
};

const ABSENCE_LABEL: Record<string, string> = {
  vacation: "Отпуск",
  sick: "Больничный",
  trip: "Командировка",
  unpaid_leave: "Неоплачиваемый",
  overtime: "Сверхурочные",
  weekend_work: "Выходной",
  early_leave: "Ранний уход"
};

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase();
}

function timeLabel(iso: string, timeZone: string) {
  return new Date(iso).toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone
  });
}

function roleText(raw: string | null | undefined) {
  const t = (raw ?? "").trim();
  if (!t || t === "—") return "—";
  const labeled = accessRoleLabel(t);
  return labeled !== t ? labeled : t;
}

function TerminalPhoto({ punchId, name }: { punchId: number | null; name: string }) {
  const tenantSlug = useAuthStore((s) => s.tenantSlug ?? "");
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!punchId || !tenantSlug) return;
    let objectUrl = "";
    let cancelled = false;
    void api
      .get<Blob>(`/api/${tenantSlug}/tabel/marks/${punchId}/media/photo_front`, { responseType: "blob" })
      .then((res) => {
        objectUrl = URL.createObjectURL(res.data);
        if (!cancelled) setUrl(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setUrl(null);
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [punchId, tenantSlug]);

  if (url) return <img src={url} alt="" className="size-10 rounded-full object-cover" />;
  return (
    <span className="flex size-10 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
      {initials(name) || "•"}
    </span>
  );
}

function Kpi({ label, value, prev, icon }: { label: string; value: number; prev: number; icon: ReactNode }) {
  const delta = value - prev;
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between text-sm text-slate-500">
        <span>{label}</span>
        {icon}
      </div>
      <div className="mt-2 text-3xl font-semibold tabular-nums">{value}</div>
      <div className="mt-1 text-xs text-slate-500">
        вчера {prev}
        {delta === 0 ? "" : delta > 0 ? ` · +${delta}` : ` · ${delta}`}
      </div>
    </Card>
  );
}

export function TabelVisitsWorkspace() {
  const tenantSlug = useAuthStore((s) => s.tenantSlug ?? "");
  const [date, setDate] = useState("");
  const query = useQuery({
    queryKey: ["tabel", "visit-dashboard", tenantSlug, date],
    enabled: Boolean(tenantSlug),
    queryFn: async () => {
      const { data } = await api.get<{ data: VisitDashboard }>(`/api/${tenantSlug}/tabel/visit-dashboard`, {
        params: date ? { date } : undefined
      });
      return data.data;
    },
    refetchInterval: 60_000
  });

  const data = query.data;
  const tz = data?.time_zone || "Asia/Tashkent";
  const maxBar = Math.max(1, ...(data?.month.map((row) => row.present + row.absent) ?? [1]));
  const maxBranch = Math.max(1, ...(data?.branches.map((row) => row.count) ?? [1]));

  useEffect(() => {
    if (!date && data?.date) setDate(data.date);
  }, [data?.date, date]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Статистика посещений</h1>
          <p className="text-sm text-slate-500">Снимок только с отметки (photo_front). Аватар сотрудника не подставляется.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <input
            type="date"
            className="h-9 rounded-md border px-2"
            value={date || data?.date || ""}
            max={data?.today || data?.date}
            onChange={(e) => setDate(e.target.value)}
          />
          <Link href="/tabel/marks" className="rounded-md border px-3 py-1.5 hover:bg-slate-50">
            Журнал отметок
          </Link>
          <Link href="/tabel/devices" className="rounded-md border px-3 py-1.5 hover:bg-slate-50">
            Терминалы
          </Link>
        </div>
      </div>

      {query.isError ? <Card className="p-4 text-sm text-red-700">Не удалось загрузить статистику.</Card> : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Сотрудники" value={data?.kpi.headcount ?? 0} prev={data?.kpi.headcount ?? 0} icon={<Users className="size-4" />} />
        <Kpi label="На работе" value={data?.kpi.present ?? 0} prev={data?.kpi.present_prev ?? 0} icon={<LogIn className="size-4" />} />
        <Kpi label="Отсутствуют" value={data?.kpi.away ?? 0} prev={data?.kpi.away_prev ?? 0} icon={<CalendarDays className="size-4" />} />
        <Kpi label="Опоздания" value={data?.kpi.late ?? 0} prev={data?.kpi.late_prev ?? 0} icon={<Clock className="size-4" />} />
      </div>

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.8fr)]">
        <Card className="p-4">
          <h2 className="text-sm font-semibold">Посещаемость за месяц</h2>
          <div className="mt-4 flex h-40 items-end gap-1">
            {(data?.month ?? []).map((row) => (
              <div
                key={row.day}
                className="flex h-full min-w-0 flex-1 flex-col justify-end gap-0.5"
                title={`${row.day}: на работе ${row.present}, нет ${row.absent}`}
              >
                <div className="rounded-sm bg-teal-500" style={{ height: `${Math.max(2, (row.present / maxBar) * 100)}%` }} />
                {row.absent > 0 ? (
                  <div className="rounded-sm bg-slate-200" style={{ height: `${Math.max(1, (row.absent / maxBar) * 100)}%` }} />
                ) : null}
              </div>
            ))}
          </div>
          <div className="mt-2 text-xs text-slate-500">{data?.date ?? "—"} · бирюзовый — отметились · серый — без отметки</div>
        </Card>

        <Card className="p-4">
          <h2 className="text-sm font-semibold">По филиалам</h2>
          <div className="mt-3 space-y-2">
            {(data?.branches ?? []).map((row) => (
              <div key={row.name}>
                <div className="flex justify-between text-sm">
                  <span className="truncate">{row.name}</span>
                  <span className="tabular-nums text-slate-500">{row.count}</span>
                </div>
                <div className="mt-1 h-1.5 rounded-full bg-slate-100">
                  <div className="h-1.5 rounded-full bg-sky-500" style={{ width: `${(row.count / maxBranch) * 100}%` }} />
                </div>
              </div>
            ))}
            {!data?.branches.length && !query.isLoading ? <p className="text-sm text-slate-500">Филиалов нет</p> : null}
          </div>
        </Card>
      </div>

      <div className="grid gap-3 xl:grid-cols-2">
        <Card className="p-4">
          <h2 className="text-sm font-semibold">На работе ({data?.date ?? "—"})</h2>
          <ul className="mt-3 divide-y">
            {(data?.recent ?? []).map((row) => (
              <li key={row.id} className="flex items-center gap-3 py-2">
                <TerminalPhoto punchId={row.punch_id} name={row.name} />
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{row.name}</div>
                  <div className="truncate text-xs text-slate-500">
                    {row.branch || "—"} · {roleText(row.role)}
                  </div>
                </div>
                {row.punch_id ? <Camera className="ml-auto size-4 text-teal-700" /> : null}
              </li>
            ))}
            {!data?.recent.length && !query.isLoading ? <li className="py-3 text-sm text-slate-500">Отметок нет</li> : null}
          </ul>
        </Card>

        <Card className="p-4">
          <h2 className="text-sm font-semibold">Последние отметки</h2>
          <ul className="mt-3 divide-y">
            {(data?.activity ?? []).map((row) => (
              <li key={row.id} className="flex items-center gap-3 py-2">
                <TerminalPhoto punchId={row.has_terminal_photo ? row.id : null} name={row.name} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{row.name}</div>
                  <div className="truncate text-xs text-slate-500">
                    {row.direction === "IN" ? "Приход" : "Уход"}
                    {row.branch ? ` · ${row.branch}` : ""}
                    {row.has_terminal_photo ? " · снимок" : " · без снимка"}
                  </div>
                </div>
                <span className="text-xs tabular-nums text-slate-500">{timeLabel(row.at, tz)}</span>
                {row.direction === "IN" ? (
                  <LogIn className="size-4 text-teal-700" />
                ) : (
                  <LogOut className="size-4 text-amber-700" />
                )}
              </li>
            ))}
            {!data?.activity.length && !query.isLoading ? <li className="py-3 text-sm text-slate-500">Отметок нет</li> : null}
          </ul>
        </Card>
      </div>

      <Card className="p-4">
        <h2 className="text-sm font-semibold">Ближайшие отсутствия</h2>
        <ul className="mt-3 divide-y">
          {(data?.absences ?? []).map((row) => (
            <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
              <span className="font-medium">{row.name}</span>
              <span className="text-slate-500">{ABSENCE_LABEL[row.type] ?? row.type}</span>
              <span className="tabular-nums text-slate-500">
                {row.from} — {row.to}
              </span>
            </li>
          ))}
          {!data?.absences.length && !query.isLoading ? (
            <li className="py-3 text-sm text-slate-500">На неделю вперёд заявок нет</li>
          ) : null}
        </ul>
      </Card>
    </div>
  );
}
