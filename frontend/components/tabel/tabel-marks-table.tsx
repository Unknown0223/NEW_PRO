"use client";

import type { ReactNode } from "react";
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  Clock,
  LogOut,
  MapPin,
  ShieldAlert,
  Video
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { TabelMarkPhotoThumb } from "@/components/tabel/tabel-marks-photo-thumb";
import {
  ROLE_IN_DAY_LABEL,
  SOURCE_BADGE,
  type OpenDayRow,
  type TabelMarkRow
} from "@/components/tabel/tabel-marks-types";
import { timesheetRoleLabel } from "@/components/timesheet/timesheet-shared";

export function TabelMarksTable({
  pageRows,
  loading,
  errored,
  onOpenCard,
  onOpenMedia,
  reviewSlot
}: {
  pageRows: TabelMarkRow[];
  loading: boolean;
  errored: boolean;
  onOpenCard: (row: TabelMarkRow) => void;
  onOpenMedia: (row: TabelMarkRow, slot: string) => void;
  reviewSlot: (row: TabelMarkRow) => ReactNode;
}) {
  return (
    <table className="w-full text-left text-xs">
      <thead className="border-b bg-muted/50 text-[11px] font-semibold uppercase text-muted-foreground">
        <tr>
          <th className="px-3 py-2.5">Фото</th>
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
        {pageRows.length === 0 ? (
          <tr>
            <td colSpan={9} className="px-4 py-8 text-center text-sm text-muted-foreground">
              {loading
                ? "Загрузка отметок..."
                : errored
                  ? "Ошибка загрузки — см. сообщение выше"
                  : "За выбранный период отметок не найдено"}
            </td>
          </tr>
        ) : (
          pageRows.map((row) => {
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
                <td className="px-3 py-2.5">
                  <TabelMarkPhotoThumb
                    punchId={row.id}
                    name={row.user_fio}
                    hasPhoto={row.has_photo_front}
                    onOpen={
                      row.has_photo_front
                        ? () => {
                            onOpenMedia(row, "photo_front");
                          }
                        : undefined
                    }
                  />
                </td>
                <td className="whitespace-nowrap px-3 py-2.5">
                  <div className="font-semibold text-foreground">{timeStr}</div>
                  <div className="text-[11px] text-muted-foreground">{row.work_date_ymd}</div>
                </td>
                <td className="px-3 py-2.5">
                  <div className="font-semibold text-foreground">{row.user_fio}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {timesheetRoleLabel(row.user_role)}
                    {row.user_branch ? ` · ${row.user_branch}` : ""}
                  </div>
                </td>
                <td className="px-3 py-2.5">
                  <span
                    className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-semibold ${roleBadge.cls}`}
                  >
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
                    {typeof row.lat === "number" && typeof row.lng === "number" ? (
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
                  {row.comment ? (
                    <div className="mt-0.5 text-[11px] italic text-muted-foreground">«{row.comment}»</div>
                  ) : null}
                </td>
                <td className="px-3 py-2.5">
                  {row.face_score != null ? (
                    <div className="font-semibold">Face ID: {(row.face_score * 100).toFixed(0)}%</div>
                  ) : null}
                  {(row.problem_reasons ?? []).length > 0 ? (
                    <div className="mb-1 flex flex-wrap gap-1">
                      {(row.problem_reasons ?? []).map((reason) => (
                        <span
                          key={reason}
                          className="inline-flex items-center gap-1 rounded bg-rose-50 px-1.5 py-0.5 text-[10px] font-semibold text-rose-800"
                        >
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
                      <ShieldAlert className="size-3" />{" "}
                      {row.integrity_json?.failedMessage ?? "Нарушение анти-фрода"}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex flex-wrap gap-1">
                    {row.has_photo_front ? (
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 rounded bg-teal-50 px-1.5 py-0.5 text-[10px] font-semibold text-teal-800 hover:bg-teal-100"
                        onClick={() => onOpenMedia(row, "photo_front")}
                      >
                        <Camera className="size-3" /> Фронт
                      </button>
                    ) : null}
                    {row.has_photo_back ? (
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 rounded bg-teal-50 px-1.5 py-0.5 text-[10px] font-semibold text-teal-800 hover:bg-teal-100"
                        onClick={() => onOpenMedia(row, "photo_back")}
                      >
                        <Camera className="size-3" /> Задняя
                      </button>
                    ) : null}
                    {row.has_video_front ? (
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 rounded bg-purple-50 px-1.5 py-0.5 text-[10px] font-semibold text-purple-800 hover:bg-purple-100"
                        onClick={() => onOpenMedia(row, "video_front")}
                      >
                        <Video className="size-3" /> Видео
                      </button>
                    ) : null}
                    {row.has_video_back ? (
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 rounded bg-purple-50 px-1.5 py-0.5 text-[10px] font-semibold text-purple-800 hover:bg-purple-100"
                        onClick={() => onOpenMedia(row, "video_back")}
                      >
                        <Video className="size-3" /> Видео 2
                      </button>
                    ) : null}
                  </div>
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-right">
                  <div className="inline-flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-2 text-[11px]"
                      onClick={() => onOpenCard(row)}
                    >
                      Карточка
                    </Button>
                    {reviewSlot(row)}
                  </div>
                </td>
              </tr>
            );
          })
        )}
      </tbody>
    </table>
  );
}

export function TabelOpenDaysTable({
  rows,
  loading
}: {
  rows: OpenDayRow[];
  loading: boolean;
}) {
  return (
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
          {rows.length === 0 ? (
            <tr>
              <td colSpan={4} className="px-4 py-6 text-center text-sm text-muted-foreground">
                {loading ? "Загрузка..." : "Дней без выхода нет"}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
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
                  {new Date(row.first_in_at).toLocaleTimeString("ru-RU", {
                    hour: "2-digit",
                    minute: "2-digit"
                  })}
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
  );
}
