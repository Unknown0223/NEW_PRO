"use client";

import { MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { timesheetRoleLabel } from "@/components/timesheet/timesheet-shared";
import { MEDIA_SLOT_LABEL, ROLE_IN_DAY_LABEL, type TabelMarkRow } from "@/components/tabel/tabel-marks-types";

export function TabelMarksCardDialog({
  card,
  media,
  mediaLoading,
  mediaError,
  onClose,
  onOpenMedia
}: {
  card: TabelMarkRow | null;
  media: { url: string; slot: string } | null;
  mediaLoading: boolean;
  mediaError: string | null;
  onClose: () => void;
  onOpenMedia: (row: TabelMarkRow, slot: string) => void;
}) {
  return (
    <Dialog
      open={card != null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{card?.user_fio ?? "Отметка"}</DialogTitle>
        </DialogHeader>
        {card ? (
          <div className="space-y-3 text-sm">
            <div className="text-xs text-muted-foreground">
              {timesheetRoleLabel(card.user_role)} · {card.work_date_ymd} ·{" "}
              {ROLE_IN_DAY_LABEL[card.role_in_day]?.label ?? card.role_in_day}
              {card.day_code ? ` · код ${card.day_code}` : ""}
            </div>
            <div>Face ID: {card.face_score != null ? `${(card.face_score * 100).toFixed(0)}%` : "нет балла"}</div>
            {typeof card.lat === "number" && typeof card.lng === "number" ? (
              <a
                className="inline-flex items-center gap-1 text-primary underline-offset-2 hover:underline"
                href={`https://maps.google.com/?q=${card.lat},${card.lng}`}
                target="_blank"
                rel="noreferrer"
              >
                <MapPin className="size-3.5" /> Точка на карте
                {card.accuracy_m != null ? ` · ±${Math.round(card.accuracy_m)} м` : ""}
              </a>
            ) : (
              <div className="text-muted-foreground">GPS точки нет</div>
            )}
            <div className="flex flex-wrap gap-1">
              {card.has_photo_front ? (
                <Button size="sm" variant="outline" onClick={() => onOpenMedia(card, "photo_front")}>
                  Фото фронт
                </Button>
              ) : null}
              {card.has_photo_back ? (
                <Button size="sm" variant="outline" onClick={() => onOpenMedia(card, "photo_back")}>
                  Фото заднее
                </Button>
              ) : null}
              {card.has_video_front ? (
                <Button size="sm" variant="outline" onClick={() => onOpenMedia(card, "video_front")}>
                  Видео
                </Button>
              ) : null}
              {card.has_video_back ? (
                <Button size="sm" variant="outline" onClick={() => onOpenMedia(card, "video_back")}>
                  Видео 2
                </Button>
              ) : null}
            </div>
            {mediaLoading ? <div className="text-xs text-muted-foreground">Загрузка файла…</div> : null}
            {mediaError ? <div className="text-xs text-rose-700">{mediaError}</div> : null}
            {media?.url && media.slot.startsWith("photo") ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={media.url}
                alt={MEDIA_SLOT_LABEL[media.slot] ?? "Фото"}
                className="max-h-80 w-full rounded-lg object-contain bg-muted"
              />
            ) : null}
            {media?.url && media.slot.startsWith("video") ? (
              <video src={media.url} controls className="max-h-80 w-full rounded-lg bg-black" />
            ) : null}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
