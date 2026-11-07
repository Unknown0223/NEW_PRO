"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Camera, CheckCircle2, Clock, Download, LogIn, LogOut, MapPin, RefreshCw, ShieldAlert, Timer, Video, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { timesheetRoleLabel } from "@/components/timesheet/timesheet-shared";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { getUserFacingError } from "@/lib/error-utils";
import { usePermissions } from "@/lib/use-permissions";
import { cn } from "@/lib/utils";

export type TabelMarkRow = {
  id: number;
  user_id: number;
  user_fio: string;
  user_role: string;
  user_branch: string | null;
  user_code: string | null;
  work_date_ymd: string;
  occurred_at: string;
  direction: "IN" | "OUT";
  role_in_day: "in" | "estimated_out" | "out";
  source: string;
  lat: number | null;
  lng: number | null;
  accuracy_m: number | null;
  outside_geofence: boolean;
  location_name: string | null;
  day_code: number | null;
  face_score: number | null;
  is_valid: boolean;
  review_status: string;
  comment: string | null;
  has_photo_front: boolean;
  has_photo_back: boolean;
  has_video_front: boolean;
  has_video_back: boolean;
  integrity_json?: {
    verdict?: string;
    failedMessage?: string | null;
    distanceMeters?: number | null;
  };
  problem_reasons?: string[];
};

type OpenDayRow = {
  user_id: number;
  user_fio: string;
  user_role: string;
  user_branch: string | null;
  work_date_ymd: string;
  first_in_at: string;
};

const ROLE_IN_DAY_LABEL: Record<string, { label: string; cls: string }> = {
  in: { label: "1-я отметка · Приход", cls: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  estimated_out: { label: "Промежуточная · Примерный уход", cls: "bg-amber-100 text-amber-800 border-amber-200" },
  out: { label: "Официальный уход", cls: "bg-sky-100 text-sky-800 border-sky-200" }
};

const SOURCE_BADGE: Record<string, string> = {
  mobile_photo: "Фото + Face ID",
  mobile_video: "Видео + 3-код",
  kiosk: "Киоск бригады",
  terminal: "Терминал Face ID",
  gps: "GPS визит",
  manual: "Вручную"
};

export function TabelMarksWorkspace({ onlyProblems = false }: { onlyProblems?: boolean }) {
  const { tenantSlug } = useAuthStore();
  const perms = usePermissions();
  const qc = useQueryClient();
  const today = new Date().toISOString().slice(0, 10);
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [branches, setBranches] = useState<string[]>([]);
  const [source, setSource] = useState("");
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [card, setCard] = useState<TabelMarkRow | null>(null);
  const [media, setMedia] = useState<{ url: string; slot: string } | null>(null);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const canExport = perms.hasAny("tabel.otmetki.export", "staff.tabel.export");

  const marksQ = useQuery({
    queryKey: ["tabel", "marks", tenantSlug, { from, to, branches, source, onlyProblems }],
    enabled: Boolean(tenantSlug),
    queryFn: async () => {
      const endpoint = onlyProblems ? `/api/${tenantSlug}/tabel/problems` : `/api/${tenantSlug}/tabel/marks`;
      const { data } = await api.get<{ data: { items: TabelMarkRow[]; open_days?: OpenDayRow[] } }>(endpoint, {
        params: {
          from: from || undefined,
          to: to || undefined,
          branch: branches.length ? branches.join(",") : undefined,
          source: source || undefined,
          only_problems: onlyProblems ? "true" : undefined
        }
      });
      return { items: data.data.items ?? [], openDays: data.data.open_days ?? [] };
    }
  });

  const branchesQ = useQuery({
    queryKey: ["timesheet-filters", tenantSlug],
    enabled: Boolean(tenantSlug),
    queryFn: async () => {
      const { data } = await api.get<{ data: { branches: string[] } }>(`/api/${tenantSlug}/timesheet/filters`);
      return data.data.branches ?? [];
    }
  });

  const reviewMut = useMutation({
    mutationFn: async (vars: { id: number; decision: "approved" | "rejected"; comment?: string }) => {
      await api.post(`/api/${tenantSlug}/tabel/marks/${vars.id}/review`, {
        decision: vars.decision,
        comment: vars.comment
      });
    },
    onSuccess: async () => {
      setNotice("Статус отметки обновлён, дневной табель пересчитан.");
      await qc.invalidateQueries({ queryKey: ["tabel", "marks", tenantSlug] });
    }
  });

  const items = marksQ.data?.items ?? [];
  const openDays = marksQ.data?.openDays ?? [];
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((r) => {
      if (kind && kind !== "Нет ухода" && !(r.problem_reasons ?? []).includes(kind)) return false;
      if (!q) return true;
      return `${r.user_fio} ${r.user_code ?? ""} ${r.user_role} ${r.user_branch ?? ""}`.toLowerCase().includes(q);
    });
  }, [items, search, kind]);
  const visibleOpen = useMemo(() => {
    const q = search.trim().toLowerCase();
    return openDays.filter((r) => {
      if (!q) return true;
      return `${r.user_fio} ${r.user_role} ${r.user_branch ?? ""}`.toLowerCase().includes(q);
    });
  }, [openDays, search]);
  const stats = useMemo(() => {
    let inn = 0;
    let mid = 0;
    let out = 0;
    let withMedia = 0;
    for (const r of visible) {
      if (r.role_in_day === "in") inn += 1;
      else if (r.role_in_day === "estimated_out") mid += 1;
      else if (r.role_in_day === "out") out += 1;
      if (r.has_photo_front || r.has_photo_back || r.has_video_front || r.has_video_back) withMedia += 1;
    }
    return { inn, mid, out, withMedia, total: visible.length };
  }, [visible]);

  useEffect(() => {
    return () => {
      if (media?.url) URL.revokeObjectURL(media.url);
    };
  }, [media]);

  async function exportExcel() {
    if (!tenantSlug || !canExport) return;
    setExporting(true);
    setNotice(null);
    try {
      const res = await api.get<Blob>(`/api/${tenantSlug}/tabel/marks/export`, {
        responseType: "blob",
        params: {
          from: from || undefined,
          to: to || undefined,
          branch: branches.length ? branches.join(",") : undefined,
          source: source || undefined,
          only_problems: onlyProblems ? "true" : undefined
        }
      });
      const cd = String(res.headers["content-disposition"] ?? "");
      const m = /filename="([^"]+)"/i.exec(cd);
      const filename = m?.[1] ?? `tabel-${onlyProblems ? "problems" : "marks"}.xlsx`;
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      setNotice("Excel файл скачан.");
    } catch (e) {
      setNotice(getUserFacingError(e, "Не удалось выгрузить Excel"));
    } finally {
      setExporting(false);
    }
  }

  async function openMedia(row: TabelMarkRow, slot: string) {
    setCard(row);
    setMediaError(null);
    setMediaLoading(true);
    if (media?.url) URL.revokeObjectURL(media.url);
    setMedia(null);
    try {
      const res = await api.get<Blob>(`/api/${tenantSlug}/tabel/marks/${row.id}/media/${slot}`, { responseType: "blob" });
      setMedia({ url: URL.createObjectURL(res.data), slot });
    } catch (e) {
      setMediaError(getUserFacingError(e, "Не удалось открыть файл"));
    } finally {
      setMediaLoading(false);
    }
  }

  const slotLabel: Record<string, string> = {
    photo_front: "Фронтальная камера",
    photo_back: "Задняя камера",
    video_front: "Видео, фронт",
    video_back: "Видео, задняя камера"
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4 shadow-sm">
        <div>
          <h1 className="text-lg font-bold text-foreground">
            {onlyProblems ? "Проблемные отметки и нарушения (Анти-фрод)" : "Журнал отметок (Приход / Примерный уход / Уход)"}
          </h1>
          <p className="text-xs text-muted-foreground">
            {onlyProblems
              ? "Вне гео-зоны, лицо не совпало, Fake GPS и дни без нажатого выхода. Одобрение или отклонение пересчитывает дневной табель."
              : "За выбранный день: приход, примерный уход и официальный уход. Фото, видео с кодом и точка GPS открываются в карточке."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canExport ? (
            <Button variant="outline" size="sm" onClick={() => void exportExcel()} disabled={exporting}>
              <Download className="mr-1.5 size-4" />
              {exporting ? "Выгрузка…" : "Excel"}
            </Button>
          ) : null}
          <Button variant="outline" size="sm" onClick={() => void marksQ.refetch()} disabled={marksQ.isFetching}>
            <RefreshCw className="mr-1.5 size-4" />
            Обновить
          </Button>
        </div>
      </div>

      {notice ? (
        <div className="rounded-lg border border-emerald-500/40 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-900">
          {notice}
        </div>
      ) : null}

      {onlyProblems ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { label: "Вне гео-зоны", value: items.filter((r) => (r.problem_reasons ?? []).includes("Вне гео-зоны")).length },
            { label: "Лицо не совпало", value: items.filter((r) => (r.problem_reasons ?? []).includes("Лицо не совпало")).length },
            { label: "Fake GPS", value: items.filter((r) => (r.problem_reasons ?? []).includes("Fake GPS")).length },
            { label: "Нет ухода", value: openDays.length }
          ].map((c) => (
            <button
              key={c.label}
              type="button"
              className={cn(
                "rounded-xl border bg-card p-3 text-left",
                kind === c.label && "border-primary ring-2 ring-primary/30"
              )}
              onClick={() => setKind((cur) => (cur === c.label ? "" : c.label))}
            >
              <div className="text-xl font-bold leading-none">{c.value}</div>
              <div className="mt-1 text-[11px] text-muted-foreground">{c.label}</div>
            </button>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { label: "Приход", value: stats.inn, icon: LogIn, chip: "bg-emerald-50 text-emerald-700" },
            { label: "Примерный уход", value: stats.mid, icon: Timer, chip: "bg-amber-50 text-amber-800" },
            { label: "Официальный уход", value: stats.out, icon: LogOut, chip: "bg-sky-50 text-sky-800" },
            { label: "С фото или видео", value: stats.withMedia, icon: Camera, chip: "bg-teal-50 text-teal-800" }
          ].map((c) => (
            <Card key={c.label} className="flex items-center gap-2.5 p-3">
              <div className={cn("grid size-9 shrink-0 place-items-center rounded-lg", c.chip)}>
                <c.icon className="size-4" />
              </div>
              <div>
                <div className="text-xl font-bold leading-none">{c.value}</div>
                <div className="mt-1 text-[11px] text-muted-foreground">{c.label}</div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 rounded-xl border bg-card p-3 sm:grid-cols-5">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Дата с</label>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Дата по</label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Филиал</label>
          <select
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={branches[0] ?? ""}
            onChange={(e) => {
              const v = e.target.value;
              setBranches(v ? [v] : []);
            }}
          >
            <option value="">Все филиалы</option>
            {(branchesQ.data ?? []).map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Источник</label>
          <select
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={source}
            onChange={(e) => setSource(e.target.value)}
          >
            <option value="">Все источники</option>
            <option value="mobile_photo">Фото + Face ID</option>
            <option value="mobile_video">Видео + 3-значный код</option>
            <option value="kiosk">Киоск бригады</option>
            <option value="terminal">Терминал Face ID</option>
            <option value="gps">GPS визит</option>
            <option value="manual">Вручную</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Сотрудник</label>
          <Input placeholder="ФИО, код, филиал" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      {kind === "Нет ухода" ? null : (
      <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
        <table className="w-full text-left text-xs">
          <thead className="border-b bg-muted/50 text-[11px] font-semibold uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2.5">Время / Дата</th>
              <th className="px-3 py-2.5">Сотрудник</th>
              <th className="px-3 py-2.5">Роль в дне</th>
              <th className="px-3 py-2.5">Источник и Код</th>
              <th className="px-3 py-2.5">Гео-зона / GPS</th>
              <th className="px-3 py-2.5">Face ID / Анти-фрод</th>
              <th className="px-3 py-2.5">Медиа</th>
              <th className="px-3 py-2.5 text-right">Действие</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {visible.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  {marksQ.isLoading ? "Загрузка отметок..." : "За выбранный период отметок не найдено"}
                </td>
              </tr>
            ) : (
              visible.map((row) => {
                const roleBadge = ROLE_IN_DAY_LABEL[row.role_in_day] ?? {
                  label: row.role_in_day,
                  cls: "bg-slate-100 text-slate-800"
                };
                const timeStr = new Date(row.occurred_at).toLocaleTimeString("ru-RU", {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit"
                });
                return (
                  <tr key={row.id} className="hover:bg-muted/30">
                    <td className="whitespace-nowrap px-3 py-2.5">
                      <div className="font-semibold text-foreground">{timeStr}</div>
                      <div className="text-[11px] text-muted-foreground">{row.work_date_ymd}</div>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="font-semibold text-foreground">{row.user_fio}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {timesheetRoleLabel(row.user_role)} {row.user_code ? `· ${row.user_code}` : ""} {row.user_branch ? `· ${row.user_branch}` : ""}
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-semibold ${roleBadge.cls}`}>
                        <Clock className="size-3" />
                        {roleBadge.label}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="font-medium">{SOURCE_BADGE[row.source] ?? row.source}</div>
                      {row.day_code ? (
                        <span className="mt-0.5 inline-block rounded bg-indigo-50 px-1.5 py-0.5 font-mono text-[11px] font-bold text-indigo-700">
                          Код: {row.day_code}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1">
                        <MapPin className="size-3.5 text-muted-foreground" />
                        {row.lat != null && row.lng != null ? (
                          <a
                            className="font-medium text-primary underline-offset-2 hover:underline"
                            href={`https://maps.google.com/?q=${row.lat},${row.lng}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {row.location_name ?? `${row.lat.toFixed(5)}, ${row.lng.toFixed(5)}`}
                          </a>
                        ) : (
                          <span>{row.location_name ?? "—"}</span>
                        )}
                      </div>
                      {row.outside_geofence ? (
                        <span className="mt-0.5 inline-flex items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
                          <AlertTriangle className="size-3" /> Вне гео-зоны
                        </span>
                      ) : null}
                      {row.accuracy_m != null ? (
                        <div className="text-[11px] text-muted-foreground">Точность ±{Math.round(row.accuracy_m)} м</div>
                      ) : null}
                      {row.comment ? <div className="mt-0.5 text-[11px] italic text-muted-foreground">«{row.comment}»</div> : null}
                    </td>
                    <td className="px-3 py-2.5">
                      {row.face_score != null ? (
                        <div className="font-semibold">
                          Face ID: {(row.face_score * 100).toFixed(0)}%
                        </div>
                      ) : null}
                      {(row.problem_reasons ?? []).length > 0 ? (
                        <div className="mb-1 flex flex-wrap gap-1">
                          {(row.problem_reasons ?? []).map((reason) => (
                            <span key={reason} className="inline-flex items-center gap-1 rounded bg-rose-50 px-1.5 py-0.5 text-[10px] font-semibold text-rose-800">
                              <ShieldAlert className="size-3" /> {reason}
                            </span>
                          ))}
                        </div>
                      ) : null}
                      {row.is_valid ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700">
                          <CheckCircle2 className="size-3" /> Проверено ({row.review_status})
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700">
                          <ShieldAlert className="size-3" /> {row.integrity_json?.failedMessage ?? "Нарушение анти-фрода"}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex flex-wrap gap-1">
                        {row.has_photo_front ? (
                          <button type="button" className="inline-flex items-center gap-1 rounded bg-teal-50 px-1.5 py-0.5 text-[10px] font-semibold text-teal-800 hover:bg-teal-100" onClick={() => void openMedia(row, "photo_front")}>
                            <Camera className="size-3" /> Фронт
                          </button>
                        ) : null}
                        {row.has_photo_back ? (
                          <button type="button" className="inline-flex items-center gap-1 rounded bg-teal-50 px-1.5 py-0.5 text-[10px] font-semibold text-teal-800 hover:bg-teal-100" onClick={() => void openMedia(row, "photo_back")}>
                            <Camera className="size-3" /> Задняя
                          </button>
                        ) : null}
                        {row.has_video_front ? (
                          <button type="button" className="inline-flex items-center gap-1 rounded bg-purple-50 px-1.5 py-0.5 text-[10px] font-semibold text-purple-800 hover:bg-purple-100" onClick={() => void openMedia(row, "video_front")}>
                            <Video className="size-3" /> Видео
                          </button>
                        ) : null}
                        {row.has_video_back ? (
                          <button type="button" className="inline-flex items-center gap-1 rounded bg-purple-50 px-1.5 py-0.5 text-[10px] font-semibold text-purple-800 hover:bg-purple-100" onClick={() => void openMedia(row, "video_back")}>
                            <Video className="size-3" /> Видео 2
                          </button>
                        ) : null}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right">
                      <div className="inline-flex items-center gap-1">
                        <Button size="sm" variant="outline" className="h-7 px-2 text-[11px]" onClick={() => { setCard(row); setMedia(null); setMediaError(null); }}>
                          Карточка
                        </Button>
                        {onlyProblems ? (
                          <>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-[11px] text-emerald-700"
                          disabled={reviewMut.isPending}
                          onClick={() =>
                            void reviewMut
                              .mutateAsync({ id: row.id, decision: "approved" })
                              .catch((e) => window.alert(getUserFacingError(e, "Ошибка")))
                          }
                        >
                          Одобрить
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-[11px] text-rose-700"
                          disabled={reviewMut.isPending}
                          onClick={() =>
                            void reviewMut
                              .mutateAsync({ id: row.id, decision: "rejected" })
                              .catch((e) => window.alert(getUserFacingError(e, "Ошибка")))
                          }
                        >
                          <XCircle className="mr-1 size-3" />
                          Отклонить
                        </Button>
                          </>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      )}

      {onlyProblems && (kind === "" || kind === "Нет ухода") ? (
        <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
          <div className="border-b px-3 py-2 text-xs font-semibold">Дни без нажатого выхода</div>
          <table className="w-full text-left text-xs">
            <thead className="border-b bg-muted/50 text-[11px] font-semibold uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2.5">Дата</th>
                <th className="px-3 py-2.5">Сотрудник</th>
                <th className="px-3 py-2.5">Приход</th>
                <th className="px-3 py-2.5">Нарушение</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {visibleOpen.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-sm text-muted-foreground">
                    {marksQ.isLoading ? "Загрузка..." : "Дней без выхода нет"}
                  </td>
                </tr>
              ) : (
                visibleOpen.map((row) => (
                  <tr key={`${row.user_id}-${row.work_date_ymd}`}>
                    <td className="px-3 py-2.5 font-semibold">{row.work_date_ymd}</td>
                    <td className="px-3 py-2.5">
                      <div className="font-semibold">{row.user_fio}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {timesheetRoleLabel(row.user_role)}
                        {row.user_branch ? ` · ${row.user_branch}` : ""}
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      {new Date(row.first_in_at).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
                        <LogOut className="size-3" /> Выход не нажат
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : null}

      <Dialog open={card != null} onOpenChange={(open) => { if (!open) { setCard(null); if (media?.url) URL.revokeObjectURL(media.url); setMedia(null); } }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{card?.user_fio ?? "Отметка"}</DialogTitle>
          </DialogHeader>
          {card ? (
            <div className="space-y-3 text-sm">
              <div className="text-xs text-muted-foreground">
                {timesheetRoleLabel(card.user_role)} · {card.work_date_ymd} · {ROLE_IN_DAY_LABEL[card.role_in_day]?.label ?? card.role_in_day}
                {card.day_code ? ` · код ${card.day_code}` : ""}
              </div>
              <div>
                Face ID: {card.face_score != null ? `${(card.face_score * 100).toFixed(0)}%` : "нет балла"}
              </div>
              {card.lat != null && card.lng != null ? (
                <a className="inline-flex items-center gap-1 text-primary underline-offset-2 hover:underline" href={`https://maps.google.com/?q=${card.lat},${card.lng}`} target="_blank" rel="noreferrer">
                  <MapPin className="size-3.5" /> Точка на карте
                  {card.accuracy_m != null ? ` · ±${Math.round(card.accuracy_m)} м` : ""}
                </a>
              ) : (
                <div className="text-muted-foreground">GPS точки нет</div>
              )}
              <div className="flex flex-wrap gap-1">
                {card.has_photo_front ? <Button size="sm" variant="outline" onClick={() => void openMedia(card, "photo_front")}>Фото фронт</Button> : null}
                {card.has_photo_back ? <Button size="sm" variant="outline" onClick={() => void openMedia(card, "photo_back")}>Фото заднее</Button> : null}
                {card.has_video_front ? <Button size="sm" variant="outline" onClick={() => void openMedia(card, "video_front")}>Видео</Button> : null}
                {card.has_video_back ? <Button size="sm" variant="outline" onClick={() => void openMedia(card, "video_back")}>Видео 2</Button> : null}
              </div>
              {mediaLoading ? <div className="text-xs text-muted-foreground">Загрузка файла…</div> : null}
              {mediaError ? <div className="text-xs text-rose-700">{mediaError}</div> : null}
              {media?.url && media.slot.startsWith("photo") ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={media.url} alt={slotLabel[media.slot] ?? "Фото"} className="max-h-80 w-full rounded-lg object-contain bg-muted" />
              ) : null}
              {media?.url && media.slot.startsWith("video") ? (
                <video src={media.url} controls className="max-h-80 w-full rounded-lg bg-black" />
              ) : null}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
