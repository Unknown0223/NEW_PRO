"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Camera, CheckCircle2, Clock, MapPin, RefreshCw, ShieldAlert, Video, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { getUserFacingError } from "@/lib/error-utils";

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
  const qc = useQueryClient();
  const today = new Date().toISOString().slice(0, 10);
  const [from, setFrom] = useState(today.slice(0, 8) + "01");
  const [to, setTo] = useState(today);
  const [branch, setBranch] = useState("");
  const [source, setSource] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  const marksQ = useQuery({
    queryKey: ["tabel", "marks", tenantSlug, { from, to, branch, source, onlyProblems }],
    enabled: Boolean(tenantSlug),
    queryFn: async () => {
      const endpoint = onlyProblems ? `/api/${tenantSlug}/tabel/problems` : `/api/${tenantSlug}/tabel/marks`;
      const { data } = await api.get<{ data: { items: TabelMarkRow[] } }>(endpoint, {
        params: {
          from: from || undefined,
          to: to || undefined,
          branch: branch.trim() || undefined,
          source: source || undefined,
          only_problems: onlyProblems ? "true" : undefined
        }
      });
      return data.data.items ?? [];
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

  const items = marksQ.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4 shadow-sm">
        <div>
          <h1 className="text-lg font-bold text-foreground">
            {onlyProblems ? "Проблемные отметки и нарушения (Анти-фрод)" : "Журнал отметок (Приход / Примерный уход / Уход)"}
          </h1>
          <p className="text-xs text-muted-foreground">
            {onlyProblems
              ? "Отметки вне гео-зоны, с низким совпадением Face ID, подозрением на Fake GPS или ожидающие проверки."
              : "1-я отметка дня — Приход, промежуточные — Примерный уход, последняя после окончания смены (или в 23:59) — Официальный уход."}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void marksQ.refetch()} disabled={marksQ.isFetching}>
          <RefreshCw className="mr-1.5 size-4" />
          Обновить
        </Button>
      </div>

      {notice ? (
        <div className="rounded-lg border border-emerald-500/40 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-900">
          {notice}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-3 rounded-xl border bg-card p-3 sm:grid-cols-4">
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
          <Input placeholder="Все филиалы" value={branch} onChange={(e) => setBranch(e.target.value)} />
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
          </select>
        </div>
      </div>

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
            {items.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  {marksQ.isLoading ? "Загрузка отметок..." : "За выбранный период отметок не найдено"}
                </td>
              </tr>
            ) : (
              items.map((row) => {
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
                        {row.user_role} {row.user_branch ? `· ${row.user_branch}` : ""}
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
                        <span>{row.location_name ?? (row.lat ? `${row.lat.toFixed(4)}, ${row.lng?.toFixed(4)}` : "—")}</span>
                      </div>
                      {row.outside_geofence ? (
                        <span className="mt-0.5 inline-flex items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
                          <AlertTriangle className="size-3" /> Вне гео-зоны
                        </span>
                      ) : null}
                      {row.comment ? <div className="mt-0.5 text-[11px] italic text-muted-foreground">«{row.comment}»</div> : null}
                    </td>
                    <td className="px-3 py-2.5">
                      {row.face_score != null ? (
                        <div className="font-semibold">
                          Face ID: {(row.face_score * 100).toFixed(0)}%
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
                          <span className="inline-flex items-center gap-1 rounded bg-teal-50 px-1.5 py-0.5 text-[10px] font-semibold text-teal-800">
                            <Camera className="size-3" /> Фронт
                          </span>
                        ) : null}
                        {row.has_photo_back ? (
                          <span className="inline-flex items-center gap-1 rounded bg-teal-50 px-1.5 py-0.5 text-[10px] font-semibold text-teal-800">
                            <Camera className="size-3" /> Задняя
                          </span>
                        ) : null}
                        {row.has_video_front ? (
                          <span className="inline-flex items-center gap-1 rounded bg-purple-50 px-1.5 py-0.5 text-[10px] font-semibold text-purple-800">
                            <Video className="size-3" /> Видео 1
                          </span>
                        ) : null}
                        {row.has_video_back ? (
                          <span className="inline-flex items-center gap-1 rounded bg-purple-50 px-1.5 py-0.5 text-[10px] font-semibold text-purple-800">
                            <Video className="size-3" /> Видео 2
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right">
                      <div className="inline-flex items-center gap-1">
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
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
