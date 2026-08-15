"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { STALE } from "@/lib/query-stale";
import { useQuery } from "@tanstack/react-query";
import { Download, X } from "lucide-react";
import { useMemo, useState } from "react";

type ErrorRow = {
  id: number;
  user_id: number | null;
  user_login: string | null;
  user_name: string | null;
  user_role: string | null;
  source: string;
  severity: string;
  occurred_at: string;
  request_id: string | null;
  http_status: number | null;
  error_code: string | null;
  message: string;
  path: string | null;
  method: string | null;
  platform: string;
  apk_version: string | null;
  device_name: string | null;
  module: string | null;
};

type ErrorMeta = {
  sources: { source: string; count: number }[];
  modules: { module: string; count: number }[];
  users: { id: number; login: string; name: string; role: string }[];
};

type ErrorDetail = {
  event: ErrorRow;
  related: ErrorRow[];
};

const fmt = (iso: string) => new Date(iso).toLocaleString("ru-RU", { hour12: false });

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

function sourceBadge(source: string) {
  if (source === "mobile") return "default" as const;
  return "secondary" as const;
}

export function ErrorLogsWorkspace({ tenantSlug }: { tenantSlug: string }) {
  const [page, setPage] = useState(1);
  const [userId, setUserId] = useState("");
  const [source, setSource] = useState("");
  const [moduleFilter, setModuleFilter] = useState("");
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const limit = 50;

  const meta = useQuery({
    queryKey: ["error-events-meta", tenantSlug],
    enabled: Boolean(tenantSlug),
    staleTime: STALE.list,
    queryFn: async () => {
      const { data } = await api.get<ErrorMeta>(`/api/${tenantSlug}/error-events/meta`);
      return data;
    }
  });

  const listQuery = useQuery({
    queryKey: ["error-events", tenantSlug, page, userId, source, moduleFilter, search, from, to],
    enabled: Boolean(tenantSlug),
    staleTime: STALE.list,
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (userId.trim()) params.set("user_id", userId.trim());
      if (source) params.set("source", source);
      if (moduleFilter) params.set("module", moduleFilter);
      if (search.trim()) params.set("search", search.trim());
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      const { data } = await api.get<{ data: ErrorRow[]; total: number; page: number; limit: number }>(
        `/api/${tenantSlug}/error-events?${params.toString()}`
      );
      return data;
    }
  });

  const detailQuery = useQuery({
    queryKey: ["error-event-detail", tenantSlug, selectedId],
    enabled: Boolean(tenantSlug) && selectedId != null,
    staleTime: STALE.list,
    queryFn: async () => {
      const { data } = await api.get<ErrorDetail>(`/api/${tenantSlug}/error-events/${selectedId}`);
      return data;
    }
  });

  const rows = listQuery.data?.data ?? [];
  const total = listQuery.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / limit));

  const userOptions = useMemo(() => meta.data?.users ?? [], [meta.data?.users]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Журнал ошибок</h1>
        <p className="text-sm text-muted-foreground">
          Только ошибки — мобильное приложение и backend. Диагностика по одному аккаунту.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-2 rounded-lg border bg-card p-3">
        <label className="grid gap-1 text-xs font-semibold text-muted-foreground">
          Пользователь
          <select
            className="h-9 min-w-[220px] rounded-md border bg-background px-2 text-sm"
            value={userId}
            onChange={(e) => {
              setUserId(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Все</option>
            {userOptions.map((u) => (
              <option key={u.id} value={String(u.id)}>
                {u.name || u.login} · {u.role} (#{u.id})
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-xs font-semibold text-muted-foreground">
          Источник
          <select
            className="h-9 rounded-md border bg-background px-2 text-sm"
            value={source}
            onChange={(e) => {
              setSource(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Все</option>
            <option value="mobile">Мобильное приложение</option>
            <option value="backend">Backend</option>
          </select>
        </label>
        <label className="grid gap-1 text-xs font-semibold text-muted-foreground">
          Модуль
          <select
            className="h-9 rounded-md border bg-background px-2 text-sm"
            value={moduleFilter}
            onChange={(e) => {
              setModuleFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Все</option>
            {(meta.data?.modules ?? []).map((m) => (
              <option key={m.module} value={m.module}>
                {m.module} ({m.count})
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-xs font-semibold text-muted-foreground">
          С
          <Input type="date" className="h-9 w-[150px]" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} />
        </label>
        <label className="grid gap-1 text-xs font-semibold text-muted-foreground">
          По
          <Input type="date" className="h-9 w-[150px]" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} />
        </label>
        <label className="grid gap-1 text-xs font-semibold text-muted-foreground">
          Поиск
          <Input
            className="h-9 w-[200px]"
            placeholder="сообщение, код, request_id…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </label>
        <Button
          variant="outline"
          size="sm"
          className="h-9"
          disabled={rows.length === 0}
          onClick={() =>
            downloadCsv(
              `error-logs-${tenantSlug}.csv`,
              ["id", "occurred_at", "source", "user", "code", "status", "message", "path", "request_id", "apk"],
              rows.map((r) => [
                r.id,
                r.occurred_at,
                r.source,
                r.user_name ?? r.user_login,
                r.error_code,
                r.http_status,
                r.message,
                r.path,
                r.request_id,
                r.apk_version
              ])
            )
          }
        >
          <Download className="mr-1.5 size-3.5" /> CSV
        </Button>
      </div>

      <div className="overflow-hidden rounded-lg border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-semibold">Время</th>
                <th className="px-3 py-2 font-semibold">Источник</th>
                <th className="px-3 py-2 font-semibold">Пользователь</th>
                <th className="px-3 py-2 font-semibold">Код</th>
                <th className="px-3 py-2 font-semibold">Сообщение</th>
                <th className="px-3 py-2 font-semibold">APK</th>
                <th className="px-3 py-2 font-semibold">request_id</th>
              </tr>
            </thead>
            <tbody>
              {listQuery.isLoading ? (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">
                    Загрузка…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">
                    Ошибки не найдены
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr
                    key={r.id}
                    className="cursor-pointer border-b last:border-0 hover:bg-muted/30"
                    onClick={() => setSelectedId(r.id)}
                  >
                    <td className="whitespace-nowrap px-3 py-2 font-mono text-xs">{fmt(r.occurred_at)}</td>
                    <td className="px-3 py-2">
                      <Badge variant={sourceBadge(r.source)}>
                        {r.source === "mobile" ? "Мобильное" : r.source === "backend" ? "Backend" : r.source}
                      </Badge>
                    </td>
                    <td className="max-w-[140px] truncate px-3 py-2 text-xs">
                      {r.user_name || r.user_login || "—"}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">
                      {r.error_code ?? "—"}
                      {r.http_status != null ? ` · ${r.http_status}` : ""}
                    </td>
                    <td className="max-w-[280px] truncate px-3 py-2">{r.message}</td>
                    <td className="whitespace-nowrap px-3 py-2 font-mono text-xs">{r.apk_version ?? "—"}</td>
                    <td className="max-w-[120px] truncate px-3 py-2 font-mono text-[11px] text-muted-foreground">
                      {r.request_id ?? "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t px-3 py-2 text-xs text-muted-foreground">
          <span>
            Всего: {total} · стр. {page}/{pages}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              ←
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= pages}
              onClick={() => setPage((p) => p + 1)}
            >
              →
            </Button>
          </div>
        </div>
      </div>

      {selectedId != null ? (
        <div className="fixed inset-y-0 right-0 z-40 flex w-full max-w-md flex-col border-l bg-background shadow-xl">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div>
              <div className="text-sm font-bold">Ошибка #{selectedId}</div>
              <div className="text-xs text-muted-foreground">Связанные по request_id</div>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setSelectedId(null)} aria-label="Закрыть">
              <X className="size-4" />
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 text-sm">
            {detailQuery.isLoading ? (
              <p className="text-muted-foreground">Загрузка…</p>
            ) : detailQuery.data ? (
              <div className="space-y-4">
                <ErrorCard row={detailQuery.data.event} />
                {detailQuery.data.related.length > 0 ? (
                  <div>
                    <div className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                      Связанные ({detailQuery.data.related.length})
                    </div>
                    <div className="space-y-3">
                      {detailQuery.data.related.map((r) => (
                        <ErrorCard key={r.id} row={r} compact />
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-xs italic text-muted-foreground">Других записей с этим request_id нет.</p>
                )}
              </div>
            ) : (
              <p className="text-destructive">Не найдено</p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ErrorCard({ row, compact }: { row: ErrorRow; compact?: boolean }) {
  return (
    <div className={`rounded-lg border p-3 ${compact ? "bg-muted/20" : "bg-card"}`}>
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <Badge variant={sourceBadge(row.source)}>
          {row.source === "mobile" ? "Мобильное" : row.source === "backend" ? "Backend" : row.source}
        </Badge>
        {row.severity === "fatal" ? <Badge variant="destructive">критично</Badge> : null}
        <span className="font-mono text-[11px] text-muted-foreground">{fmt(row.occurred_at)}</span>
      </div>
      <div className="font-semibold">{row.error_code ?? "ошибка"}{row.http_status != null ? ` · ${row.http_status}` : ""}</div>
      <p className="mt-1 text-[13px] leading-snug">{row.message}</p>
      <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        <div>
          <dt className="font-semibold">Пользователь</dt>
          <dd>{row.user_name || row.user_login || "—"}</dd>
        </div>
        <div>
          <dt className="font-semibold">Модуль</dt>
          <dd>{row.module ?? "—"}</dd>
        </div>
        <div className="col-span-2">
          <dt className="font-semibold">Путь</dt>
          <dd className="break-all font-mono">{row.method ? `${row.method} ` : ""}{row.path ?? "—"}</dd>
        </div>
        <div>
          <dt className="font-semibold">APK / устройство</dt>
          <dd>
            {row.apk_version ?? "—"}
            {row.device_name ? ` · ${row.device_name}` : ""}
          </dd>
        </div>
        <div>
          <dt className="font-semibold">request_id</dt>
          <dd className="break-all font-mono">{row.request_id ?? "—"}</dd>
        </div>
      </dl>
    </div>
  );
}
