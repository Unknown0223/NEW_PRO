"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Camera, ExternalLink, LogIn, LogOut } from "lucide-react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { dayMarksHref } from "@/lib/tabel/day-marks-link";
import { STALE } from "@/lib/query-stale";
import type { TabelMarkRow } from "@/components/tabel/tabel-marks-workspace";

function MarkThumb({ punchId, hasPhoto }: { punchId: number; hasPhoto: boolean }) {
  const tenantSlug = useAuthStore((s) => s.tenantSlug ?? "");
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!hasPhoto || !tenantSlug) return;
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
  }, [hasPhoto, punchId, tenantSlug]);

  if (url) return <img src={url} alt="" className="size-12 rounded-md object-cover" />;
  return (
    <span className="grid size-12 place-items-center rounded-md bg-muted text-muted-foreground">
      <Camera className="size-4" />
    </span>
  );
}

export function TimesheetDayMarksPanel({
  userId,
  dateYmd,
  fio
}: {
  userId: number;
  dateYmd: string;
  fio: string;
}) {
  const tenantSlug = useAuthStore((s) => s.tenantSlug ?? "");
  const href = dayMarksHref(userId, dateYmd);

  const marksQ = useQuery({
    queryKey: ["tabel", "day-marks", tenantSlug, userId, dateYmd],
    enabled: Boolean(tenantSlug && userId && dateYmd),
    staleTime: STALE.list,
    queryFn: async () => {
      const { data } = await api.get<{ data: { items: TabelMarkRow[] } }>(
        `/api/${tenantSlug}/tabel/marks`,
        { params: { user_id: userId, from: dateYmd, to: dateYmd } }
      );
      return data.data.items ?? [];
    }
  });

  const items = marksQ.data ?? [];

  return (
    <div className="rounded-lg border bg-muted/30 px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Фото-отметки за день
        </div>
        {href ? (
          <Link
            href={href}
            className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs text-primary hover:underline"
          >
            Журнал <ExternalLink className="size-3" />
          </Link>
        ) : null}
      </div>
      {marksQ.isLoading ? (
        <p className="mt-2 text-xs text-muted-foreground">Загрузка…</p>
      ) : items.length === 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">
          У {fio} за этот день отметок нет.
        </p>
      ) : (
        <ul className="mt-2 max-h-48 space-y-2 overflow-y-auto">
          {items.map((row) => (
            <li key={row.id} className="flex items-center gap-2 text-xs">
              <MarkThumb punchId={row.id} hasPhoto={row.has_photo_front} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1 font-medium">
                  {row.direction === "IN" ? (
                    <LogIn className="size-3 text-teal-700" />
                  ) : (
                    <LogOut className="size-3 text-amber-700" />
                  )}
                  {row.direction === "IN" ? "Приход" : "Уход"}
                  <span className="tabular-nums text-muted-foreground">
                    {new Date(row.occurred_at).toLocaleTimeString("ru-RU", {
                      hour: "2-digit",
                      minute: "2-digit",
                      hour12: false
                    })}
                  </span>
                </div>
                <div className="truncate text-[11px] text-muted-foreground">
                  {row.has_photo_front ? "Есть снимок" : "Без снимка"}
                  {row.source ? ` · ${row.source}` : ""}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
