"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  GalleryHorizontal,
  Grid2x2,
  LayoutGrid,
  LayoutTemplate,
  Square,
  X
} from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export type PhotoGalleryItem = {
  id: number;
  image_url: string;
  caption?: string | null;
  client_name?: string;
};

type LayoutColumns = 1 | 2 | 3 | 4;

type SupervisorPhotoGalleryLightboxProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  photos: PhotoGalleryItem[];
  initialIndex?: number;
  title?: string;
};

const LAYOUT_OPTIONS: { cols: LayoutColumns; label: string; Icon: typeof Square }[] = [
  { cols: 1, label: "1 фото", Icon: Square },
  { cols: 2, label: "2 фото", Icon: GalleryHorizontal },
  { cols: 3, label: "3 фото", Icon: LayoutTemplate },
  { cols: 4, label: "4 фото", Icon: Grid2x2 }
];

/** Namunadagidek — slot to‘liq balandlikni egallaydi, rasm siqilmaydi. */
function GalleryPhoto({
  src,
  alt,
  priority = false,
  thumb = false
}: {
  src: string;
  alt: string;
  priority?: boolean;
  thumb?: boolean;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      draggable={false}
      loading={priority ? "eager" : "lazy"}
      decoding={priority ? "sync" : "async"}
      fetchPriority={priority ? "high" : "auto"}
      className={cn(
        thumb ? "h-full w-full object-cover" : "h-full w-full object-contain"
      )}
    />
  );
}

export function SupervisorPhotoGalleryLightbox({
  open,
  onOpenChange,
  photos,
  initialIndex = 0,
  title
}: SupervisorPhotoGalleryLightboxProps) {
  const [index, setIndex] = useState(initialIndex);
  const [columns, setColumns] = useState<LayoutColumns>(1);
  const [gridMode, setGridMode] = useState(false);

  useEffect(() => {
    if (open) {
      setIndex(Math.min(Math.max(0, initialIndex), Math.max(0, photos.length - 1)));
      setColumns(1);
      setGridMode(false);
    }
  }, [open, initialIndex, photos.length]);

  const visibleCount = columns;
  const pageSize = gridMode ? photos.length : visibleCount;
  const maxStart = Math.max(0, photos.length - pageSize);

  const visiblePhotos = useMemo(() => {
    if (gridMode) return photos;
    return photos.slice(index, index + visibleCount);
  }, [gridMode, photos, index, visibleCount]);

  const goPrev = useCallback(() => {
    if (gridMode) return;
    setIndex((i) => Math.max(0, i - visibleCount));
  }, [gridMode, visibleCount]);

  const goNext = useCallback(() => {
    if (gridMode) return;
    setIndex((i) => Math.min(maxStart, i + visibleCount));
  }, [gridMode, maxStart, visibleCount]);

  useEffect(() => {
    if (!open || gridMode) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "ArrowRight") goNext();
      if (e.key === "Escape") onOpenChange(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, gridMode, goPrev, goNext, onOpenChange]);

  useEffect(() => {
    if (index > maxStart) setIndex(maxStart);
  }, [index, maxStart]);

  const header = useMemo(() => title ?? "Фотоотчет", [title]);
  const hasMany = photos.length > 1;
  const canPrev = !gridMode && index > 0;
  const canNext = !gridMode && index < maxStart;

  const counterLabel = useMemo(() => {
    if (!photos.length) return "";
    const from = index + 1;
    const to = Math.min(index + visibleCount, photos.length);
    const range = from === to ? `${from}-${from}` : `${from}-${to}`;
    const client = visiblePhotos[0]?.client_name?.trim();
    return client ? `${range} / ${photos.length} · ${client}` : `${range} / ${photos.length}`;
  }, [index, photos.length, visibleCount, visiblePhotos]);

  if (!photos.length) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        overlayClassName="z-[100] bg-black/60"
        className={cn(
          "z-[100] flex flex-col gap-0 overflow-hidden rounded-xl bg-popover p-0 text-popover-foreground shadow-2xl ring-1 ring-foreground/10",
          /* Sidebar dan o‘ng chegara — namunadagi qizil hudud */
          "fixed !top-2 !bottom-2 !left-2 !right-2 !h-auto !max-h-none !w-auto !max-w-none !translate-x-0 !translate-y-0",
          "md:!left-[15.5rem]"
        )}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-2.5 sm:px-5">
          <p className="text-foreground min-w-0 flex-1 truncate text-sm font-semibold sm:text-base">{header}</p>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setGridMode((v) => !v)}
              className="inline-flex h-9 items-center gap-2 rounded-xl bg-teal-600 px-3 text-sm font-medium text-white hover:bg-teal-500 sm:h-10 sm:px-4"
            >
              {gridMode ? <Square className="h-4 w-4" /> : <LayoutGrid className="h-4 w-4" />}
              {gridMode ? "Просмотр" : "Все картинки"}
            </button>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="text-muted-foreground hover:bg-muted hover:text-foreground inline-flex h-9 w-9 items-center justify-center rounded-xl sm:h-10 sm:w-10"
              aria-label="Закрыть"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="relative flex min-h-0 flex-1">
          {gridMode ? (
            <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                {photos.map((p, i) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setIndex(i);
                      setGridMode(false);
                      setColumns(1);
                    }}
                    className="group bg-muted/50 relative aspect-[3/4] overflow-hidden rounded-lg ring-1 ring-border transition hover:ring-teal-500/60"
                  >
                    <GalleryPhoto src={p.image_url} alt={p.caption ?? p.client_name ?? `Фото ${p.id}`} thumb />
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              <div className="relative flex min-h-0 flex-1 flex-col">
                <div className="bg-muted/25 relative flex min-h-0 flex-1 items-stretch">
                  {hasMany && canPrev ? (
                    <button
                      type="button"
                      onClick={goPrev}
                      className="bg-background/90 hover:bg-background absolute left-2 top-1/2 z-20 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-border text-foreground shadow-md sm:left-3 sm:h-12 sm:w-12"
                      aria-label="Предыдущие фото"
                    >
                      <ChevronLeft className="h-7 w-7 sm:h-8 sm:w-8" />
                    </button>
                  ) : null}

                  <div className="flex min-h-0 w-full flex-1 items-stretch gap-1.5 px-11 py-1 sm:gap-2 sm:px-14 sm:py-1.5">
                    {visiblePhotos.map((p, vi) => (
                      <div
                        key={p.id}
                        className="flex min-h-0 min-w-0 flex-1 items-center justify-center overflow-hidden rounded-lg bg-black/20 dark:bg-black/35"
                      >
                        <GalleryPhoto
                          src={p.image_url}
                          alt={p.caption ?? p.client_name ?? `Фото ${p.id}`}
                          priority={vi === 0}
                        />
                      </div>
                    ))}
                  </div>

                  {hasMany && canNext ? (
                    <button
                      type="button"
                      onClick={goNext}
                      className="bg-background/90 hover:bg-background absolute right-[3.75rem] top-1/2 z-20 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-border text-foreground shadow-md sm:right-[4.25rem] sm:h-12 sm:w-12"
                      aria-label="Следующие фото"
                    >
                      <ChevronRight className="h-7 w-7 sm:h-8 sm:w-8" />
                    </button>
                  ) : null}
                </div>

                {hasMany ? (
                  <div className="shrink-0 border-t border-border px-3 py-2.5 sm:px-5">
                    <div className="flex justify-start gap-1.5 overflow-x-auto pb-1 sm:justify-center sm:gap-2">
                      {photos.map((p, i) => {
                        const inView =
                          columns === 1 ? i === index : i >= index && i < index + visibleCount;
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => setIndex(Math.min(i, maxStart))}
                            className={cn(
                              "h-14 w-11 shrink-0 overflow-hidden rounded-lg ring-2 transition sm:h-[60px] sm:w-[46px]",
                              inView ? "ring-teal-500 opacity-100" : "opacity-55 ring-transparent hover:opacity-90"
                            )}
                          >
                            <GalleryPhoto src={p.image_url} alt="" thumb />
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-muted-foreground mt-1.5 text-center text-xs">{counterLabel}</p>
                  </div>
                ) : null}
              </div>

              <div className="bg-muted/30 flex w-[3.25rem] shrink-0 flex-col gap-1 border-l border-border p-1.5 sm:w-14">
                {LAYOUT_OPTIONS.map(({ cols, label, Icon }) => (
                  <button
                    key={cols}
                    type="button"
                    title={label}
                    onClick={() => {
                      setColumns(cols);
                      setIndex((i) => Math.min(i, Math.max(0, photos.length - cols)));
                    }}
                    className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-lg transition",
                      columns === cols
                        ? "bg-teal-600 text-white"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                    aria-label={label}
                    aria-pressed={columns === cols}
                  >
                    <Icon className="h-5 w-5" />
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {!gridMode ? (
          <div className="flex shrink-0 justify-center gap-1 border-t border-border p-2 sm:hidden">
            {LAYOUT_OPTIONS.map(({ cols, label }) => (
              <button
                key={cols}
                type="button"
                onClick={() => {
                  setColumns(cols);
                  setIndex((i) => Math.min(i, Math.max(0, photos.length - cols)));
                }}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs font-medium",
                  columns === cols ? "bg-teal-600 text-white" : "text-muted-foreground hover:bg-muted"
                )}
              >
                {label}
              </button>
            ))}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
