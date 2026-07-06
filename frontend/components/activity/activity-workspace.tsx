"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { STALE } from "@/lib/query-stale";
import { HISTORY_EVENT_LABEL } from "@/lib/use-entity-history";
import { humanizeAction, humanizeEntity, summarizePayload } from "@/lib/history-labels";
import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { useMemo, useState } from "react";

type Tab = "behavior" | "mutations";

type ActivityRow = {
  id: number;
  event_type: string;
  module: string;
  section: string | null;
  entity_type: string | null;
  entity_id: string | null;
  route: string | null;
  label: string | null;
  duration_ms: number | null;
  actor_user_id: number | null;
  actor_login: string | null;
  actor_name: string | null;
  created_at: string;
};

type AuditRow = {
  id: number;
  entity_type: string;
  entity_id: string;
  action: string;
  payload: unknown;
  actor_user_id: number | null;
  actor_login: string | null;
  created_at: string;
};

type ActivityMeta = {
  modules: { module: string; count: number }[];
  event_types: { event_type: string; count: number }[];
};

const fmt = (iso: string) => new Date(iso).toLocaleString();

function downloadCsv(filename: string, headers: string[], rows: (string | number | null)[][]) {
  const esc = (v: string | number | null) => {
    const s = v == null ? "" : String(v);
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [headers.join(";"), ...rows.map((r) => r.map(esc).join(";"))].join("\n");
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function ActivityWorkspace({ tenantSlug }: { tenantSlug: string }) {
  const [tab, setTab] = useState<Tab>("behavior");
  const [page, setPage] = useState(1);
  const [moduleFilter, setModuleFilter] = useState("");
  const [eventType, setEventType] = useState("");
  const [actor, setActor] = useState("");
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const limit = 50;

  const meta = useQuery({
    queryKey: ["activity-meta", tenantSlug],
    enabled: Boolean(tenantSlug),
    staleTime: STALE.list,
    queryFn: async () => {
      const { data } = await api.get<ActivityMeta>(`/api/${tenantSlug}/activity/meta`);
      return data;
    }
  });

  const behaviorQuery = useQuery({
    queryKey: ["activity-feed", tenantSlug, page, moduleFilter, eventType, actor, search, from, to],
    enabled: Boolean(tenantSlug) && tab === "behavior",
    staleTime: STALE.list,
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (moduleFilter) params.set("module", moduleFilter);
      if (eventType) params.set("event_type", eventType);
      if (actor.trim()) params.set("actor_user_id", actor.trim());
      if (search.trim()) params.set("search", search.trim());
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      const { data } = await api.get<{ data: ActivityRow[]; total: number; page: number; limit: number }>(
        `/api/${tenantSlug}/activity?${params.toString()}`
      );
      return data;
    }
  });

  const mutationsQuery = useQuery({
    queryKey: ["audit-feed", tenantSlug, page, actor, from, to],
    enabled: Boolean(tenantSlug) && tab === "mutations",
    staleTime: STALE.list,
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (actor.trim()) params.set("actor_user_id", actor.trim());
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      const { data } = await api.get<{ data: AuditRow[]; total: number; page: number; limit: number }>(
        `/api/${tenantSlug}/audit-events?${params.toString()}`
      );
      return data;
    }
  });

  const active = tab === "behavior" ? behaviorQuery : mutationsQuery;
  const total = active.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  const resetFilters = () => {
    setModuleFilter("");
    setEventType("");
    setActor("");
    setSearch("");
    setFrom("");
    setTo("");
    setPage(1);
  };

  const exportCsv = () => {
    if (tab === "behavior") {
      const rows = (behaviorQuery.data?.data ?? []).map((r) => [
        fmt(r.created_at),
        r.actor_login ?? r.actor_user_id ?? "",
        r.module,
        r.section ?? "",
        HISTORY_EVENT_LABEL[r.event_type] ?? r.event_type,
        r.route ?? "",
        r.duration_ms ?? ""
      ]);
      downloadCsv("activity-behavior.csv", ["Время", "Кто", "Модуль", "Раздел", "Действие", "Маршрут", "Длит.(мс)"], rows);
    } else {
      const rows = (mutationsQuery.data?.data ?? []).map((r) => [
        fmt(r.created_at),
        r.actor_login ?? r.actor_user_id ?? "",
        humanizeEntity(r.entity_type, r.entity_id),
        humanizeAction(r.action),
        summarizePayload(r.payload)
      ]);
      downloadCsv("activity-mutations.csv", ["Время", "Кто", "Объект", "Действие", "Описание"], rows);
    }
  };

  const tabBtn = (id: Tab, label: string) => (
    <button
      type="button"
      onClick={() => {
        setTab(id);
        setPage(1);
      }}
      className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
        tab === id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
      }`}
    >
      {label}
    </button>
  );

  const eventOptions = useMemo(() => meta.data?.event_types ?? [], [meta.data]);
  const moduleOptions = useMemo(() => meta.data?.modules ?? [], [meta.data]);

  return (
    <div className="flex w-full min-w-0 flex-col gap-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Активность и история</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Кто, когда и что делал: действия пользователей (просмотры, открытие форм) и изменения данных.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {tabBtn("behavior", "Действия пользователей")}
        {tabBtn("mutations", "Изменения данных")}
        <div className="ml-auto">
          <Button type="button" variant="outline" size="sm" className="gap-1" onClick={exportCsv}>
            <Download className="size-3.5" /> CSV
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        {tab === "behavior" && (
          <>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Модуль</label>
              <select
                className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                value={moduleFilter}
                onChange={(e) => {
                  setModuleFilter(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">Все</option>
                {moduleOptions.map((m) => (
                  <option key={m.module} value={m.module}>
                    {m.module} ({m.count})
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Действие</label>
              <select
                className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                value={eventType}
                onChange={(e) => {
                  setEventType(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">Все</option>
                {eventOptions.map((e) => (
                  <option key={e.event_type} value={e.event_type}>
                    {HISTORY_EVENT_LABEL[e.event_type] ?? e.event_type} ({e.count})
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Поиск (маршрут/метка)</label>
              <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="w-52" />
            </div>
          </>
        )}
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Пользователь (ID)</label>
          <Input value={actor} onChange={(e) => { setActor(e.target.value); setPage(1); }} className="w-28" placeholder="напр. 1810" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">С</label>
          <Input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} className="w-40" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">По</label>
          <Input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} className="w-40" />
        </div>
        <Button type="button" variant="outline" size="sm" onClick={resetFilters}>
          Сбросить
        </Button>
      </div>

      {active.isError && (
        <p className="text-sm text-destructive">Ошибка загрузки — проверьте сеть или права.</p>
      )}

      <div className="overflow-x-auto rounded-lg border border-border">
        {tab === "behavior" ? (
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="app-table-thead">
              <tr>
                <th className="px-3 py-2 font-medium">Время</th>
                <th className="px-3 py-2 font-medium">Кто</th>
                <th className="px-3 py-2 font-medium">Модуль</th>
                <th className="px-3 py-2 font-medium">Действие</th>
                <th className="px-3 py-2 font-medium">Маршрут / объект</th>
                <th className="px-3 py-2 font-medium">Длит.</th>
              </tr>
            </thead>
            <tbody>
              {behaviorQuery.isLoading ? (
                <tr><td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">Загрузка...</td></tr>
              ) : (behaviorQuery.data?.data ?? []).length === 0 ? (
                <tr><td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">Нет записей</td></tr>
              ) : (
                (behaviorQuery.data?.data ?? []).map((r) => (
                  <tr key={r.id} className="border-b border-border/80 last:border-0">
                    <td className="whitespace-nowrap px-3 py-2 text-xs text-muted-foreground">{fmt(r.created_at)}</td>
                    <td className="px-3 py-2">{r.actor_login ?? (r.actor_user_id ? `#${r.actor_user_id}` : "—")}</td>
                    <td className="px-3 py-2"><span className="font-mono text-xs">{r.module}{r.section ? `/${r.section}` : ""}</span></td>
                    <td className="px-3 py-2"><Badge variant="secondary">{HISTORY_EVENT_LABEL[r.event_type] ?? r.event_type}</Badge></td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      <span className="font-mono">{r.route ?? r.label ?? "—"}</span>
                      {r.entity_type && r.entity_id ? <span className="ml-1">({r.entity_type}#{r.entity_id})</span> : null}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{r.duration_ms != null ? `${Math.round(r.duration_ms / 1000)}s` : "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        ) : (
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="app-table-thead">
              <tr>
                <th className="px-3 py-2 font-medium">Время</th>
                <th className="px-3 py-2 font-medium">Кто</th>
                <th className="px-3 py-2 font-medium">Объект</th>
                <th className="px-3 py-2 font-medium">Действие</th>
                <th className="px-3 py-2 font-medium">Payload</th>
              </tr>
            </thead>
            <tbody>
              {mutationsQuery.isLoading ? (
                <tr><td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">Загрузка...</td></tr>
              ) : (mutationsQuery.data?.data ?? []).length === 0 ? (
                <tr><td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">Нет записей</td></tr>
              ) : (
                (mutationsQuery.data?.data ?? []).map((r) => {
                  const summary = summarizePayload(r.payload);
                  return (
                    <tr key={r.id} className="border-b border-border/80 last:border-0">
                      <td className="whitespace-nowrap px-3 py-2 text-xs text-muted-foreground">{fmt(r.created_at)}</td>
                      <td className="px-3 py-2">{r.actor_login ?? (r.actor_user_id ? `#${r.actor_user_id}` : "—")}</td>
                      <td className="px-3 py-2">{humanizeEntity(r.entity_type, r.entity_id)}</td>
                      <td className="px-3 py-2">{humanizeAction(r.action)}</td>
                      <td className="px-3 py-2">
                        <span
                          className="block max-w-[320px] truncate text-xs text-muted-foreground"
                          title={JSON.stringify(r.payload)}
                        >
                          {summary || "—"}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        )}
      </div>

      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">Всего: {total} · Стр. {page} / {totalPages}</p>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
            Назад
          </Button>
          <Button type="button" variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            Вперёд
          </Button>
        </div>
      </div>
    </div>
  );
}
