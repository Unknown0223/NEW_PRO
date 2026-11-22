"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Camera, Download, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { TabelMarkRow } from "@/components/tabel/tabel-marks-workspace";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { dayMarksHref } from "@/lib/tabel/day-marks-link";
import { STALE } from "@/lib/query-stale";
import { usePermissions } from "@/lib/use-permissions";
import { getUserFacingError } from "@/lib/error-utils";

function monthStartYmd(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function todayYmd(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Отчёт: посещения сотрудников (табель / Face ID отметки). */
export function StaffAttendanceReportWorkspace() {
  const tenantSlug = useAuthStore((s) => s.tenantSlug ?? "");
  const perms = usePermissions();
  const canExport = perms.hasAny("tabel.otmetki.export", "staff.tabel.export");
  const [from, setFrom] = useState(monthStartYmd());
  const [to, setTo] = useState(todayYmd());
  const [q, setQ] = useState("");
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const marksQ = useQuery({
    queryKey: ["reports", "staff-attendance", tenantSlug, from, to],
    enabled: Boolean(tenantSlug),
    staleTime: STALE.report,
    queryFn: async () => {
      const { data } = await api.get<{ data: { items: TabelMarkRow[] } }>(`/api/${tenantSlug}/tabel/marks`, {
        params: { from, to, take: 5000 }
      });
      return data.data.items ?? [];
    }
  });

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const items = marksQ.data ?? [];
    if (!needle) return items;
    return items.filter((r) =>
      [r.user_fio, r.user_branch, r.user_role, r.user_code, r.source]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(needle))
    );
  }, [marksQ.data, q]);

  async function onExport() {
    if (!tenantSlug) return;
    setExporting(true);
    setError(null);
    try {
      const res = await api.get<Blob>(`/api/${tenantSlug}/tabel/marks/export`, {
        params: { from, to },
        responseType: "blob"
      });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `poseshchenie-sotrudnikov_${from}_${to}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(getUserFacingError(e));
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Посещения сотрудников</h1>
          <p className="text-sm text-muted-foreground">
            Табель / Face ID отметки за период. Снимок — только с отметки (photo_front).
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Input type="date" className="h-9 w-auto" value={from} onChange={(e) => setFrom(e.target.value)} />
          <Input type="date" className="h-9 w-auto" value={to} onChange={(e) => setTo(e.target.value)} />
          <Input
            className="h-9 w-48"
            placeholder="ФИО / филиал…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <Button variant="outline" size="sm" onClick={() => void marksQ.refetch()} disabled={marksQ.isFetching}>
            <RefreshCw className="mr-1 size-3.5" /> Обновить
          </Button>
          {canExport ? (
            <Button size="sm" onClick={() => void onExport()} disabled={exporting}>
              <Download className="mr-1 size-3.5" /> Excel
            </Button>
          ) : null}
        </div>
      </div>

      {error ? <Card className="p-3 text-sm text-red-700">{error}</Card> : null}
      {marksQ.isError ? <Card className="p-3 text-sm text-red-700">Не удалось загрузить отметки.</Card> : null}

      <Card className="overflow-hidden">
        <div className="border-b px-4 py-2 text-sm text-muted-foreground">
          Строк: <span className="font-semibold tabular-nums text-foreground">{rows.length}</span>
        </div>
        <div className="max-h-[70vh] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-muted/80 text-left text-xs uppercase tracking-wider text-muted-foreground backdrop-blur">
              <tr>
                <th className="px-3 py-2">Дата</th>
                <th className="px-3 py-2">Время</th>
                <th className="px-3 py-2">Сотрудник</th>
                <th className="px-3 py-2">Филиал</th>
                <th className="px-3 py-2">Напр.</th>
                <th className="px-3 py-2">Источник</th>
                <th className="px-3 py-2">Фото</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const href = dayMarksHref(row.user_id, row.work_date_ymd);
                return (
                  <tr key={row.id} className="border-t">
                    <td className="px-3 py-2 tabular-nums">{row.work_date_ymd}</td>
                    <td className="px-3 py-2 tabular-nums">
                      {new Date(row.occurred_at).toLocaleTimeString("ru-RU", {
                        hour: "2-digit",
                        minute: "2-digit",
                        hour12: false
                      })}
                    </td>
                    <td className="px-3 py-2 font-medium">{row.user_fio}</td>
                    <td className="px-3 py-2">{row.user_branch || "—"}</td>
                    <td className="px-3 py-2">{row.direction}</td>
                    <td className="px-3 py-2">{row.source}</td>
                    <td className="px-3 py-2">
                      {row.has_photo_front ? (
                        <span className="inline-flex items-center gap-1 text-teal-700">
                          <Camera className="size-3.5" /> да
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {href ? (
                        <Link href={href} className="text-xs text-primary hover:underline">
                          День
                        </Link>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
              {!marksQ.isLoading && rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">
                    За период отметок нет
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
