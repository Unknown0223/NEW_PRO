"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PhotoReportThumb } from "./photo-report-thumb";
import { fmtPhotoDt, type PhotoReportRow } from "./photo-report-config";

function fullUrl(thumb: string | null): string | null {
  if (!thumb) return null;
  return thumb.replace(/\?thumb=1$/, "").replace(/([?&])thumb=1/, "");
}

type Props = {
  agentName: string;
  agentRole: string;
  photos: PhotoReportRow[];
  loading?: boolean;
  onClose: () => void;
};

/** Bitta agent fotolarini bir vaqtda (grid) ko‘rsatish. */
export function PhotoReportAgentGallery({
  agentName,
  agentRole,
  photos,
  loading,
  onClose
}: Props) {
  const viewable = photos.filter((p) => p.thumb_url && !p.content_purged);
  const [focusId, setFocusId] = useState<number | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (focusId != null) setFocusId(null);
        else onClose();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [focusId, onClose]);

  const focus = viewable.find((p) => p.photo_id === focusId) ?? null;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black/75 p-3 sm:p-5"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="mx-auto flex h-full w-full max-w-6xl flex-col rounded-lg bg-background shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">
              {agentName || "—"}
              {agentRole ? ` · ${agentRole}` : ""}
            </div>
            <div className="text-xs text-muted-foreground">
              Фотоотчёты сотрудника: {viewable.length}
              {photos.length !== viewable.length ? ` (всего ${photos.length})` : ""}
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Закрыть">
            <X className="h-5 w-5" />
          </Button>
        </div>

        {loading ? (
          <p className="px-3 py-10 text-center text-sm text-muted-foreground">Загрузка…</p>
        ) : viewable.length === 0 ? (
          <p className="px-3 py-10 text-center text-sm text-muted-foreground">Нет доступных фото</p>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {viewable.map((row) => (
                <button
                  key={row.photo_id}
                  type="button"
                  className="overflow-hidden rounded-lg border bg-card text-left transition hover:border-primary/50"
                  onClick={() => setFocusId(row.photo_id)}
                >
                  <PhotoReportThumb
                    src={row.thumb_url}
                    alt={row.client_name}
                    className="aspect-[4/3] w-full bg-muted"
                  />
                  <div className="space-y-0.5 p-2">
                    <div className="truncate text-xs font-medium">{row.client_name}</div>
                    <div className="truncate text-[11px] text-muted-foreground">{row.category}</div>
                    <div className="text-[11px] text-muted-foreground">{fmtPhotoDt(row.created_at)}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {focus ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4"
          onClick={() => setFocusId(null)}
        >
          <div className="relative max-h-full max-w-5xl" onClick={(e) => e.stopPropagation()}>
            <PhotoReportThumb
              src={fullUrl(focus.thumb_url)}
              alt={focus.client_name}
              className="max-h-[85vh] max-w-full rounded object-contain"
            />
            <div className="mt-2 text-center text-sm text-white">
              {focus.client_name} · {focus.category} · {fmtPhotoDt(focus.created_at)}
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-0 top-0 text-white hover:bg-white/10"
              onClick={() => setFocusId(null)}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
