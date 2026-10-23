"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

export type PhotoGalleryItem = {
  id: number;
  /** Auth talab qiladigan relative API path yoki tayyor blob/http URL. */
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

/** Auth orqali yuklangan object URL kesh (bir xil /content qayta so‘ralmasin). */
const blobUrlBySrc = new Map<string, string>();
const failedSrc = new Set<string>();
const inflightBySrc = new Map<string, Promise<string | null>>();

function isPublicOrBlobUrl(src: string): boolean {
  return (
    src.startsWith("blob:") ||
    src.startsWith("data:") ||
    src.startsWith("http://") ||
    src.startsWith("https://")
  );
}

async function loadAuthImageBlobUrl(src: string): Promise<string | null> {
  if (!src) return null;
  if (isPublicOrBlobUrl(src)) return src;
  if (failedSrc.has(src)) return null;
  const cached = blobUrlBySrc.get(src);
  if (cached) return cached;
  const inflight = inflightBySrc.get(src);
  if (inflight) return inflight;

  const promise = (async () => {
    try {
      const res = await api.get<Blob>(src, {
        responseType: "blob",
        headers: { Accept: "image/jpeg,image/png,image/webp,image/*,*/*" }
      });
      const blob = res.data;
      if (!(blob instanceof Blob) || blob.size === 0) {
        failedSrc.add(src);
        return null;
      }
      const type = (blob.type || "").toLowerCase();
      if (type.includes("application/json") || type.startsWith("text/")) {
        failedSrc.add(src);
        return null;
      }
      const url = URL.createObjectURL(blob);
      blobUrlBySrc.set(src, url);
      return url;
    } catch {
      failedSrc.add(src);
      return null;
    } finally {
      inflightBySrc.delete(src);
    }
  })();

  inflightBySrc.set(src, promise);
  return promise;
}

function GalleryPhoto({
  src,
  alt,
  priority = false,
  thumb = false,
  enabled = true
}: {
  src: string;
  alt: string;
  priority?: boolean;
  thumb?: boolean;
  /** false bo‘lsa — tarmoq so‘rovi yo‘q (placeholder). */
  enabled?: boolean;
}) {
  const [objectUrl, setObjectUrl] = useState<string | null>(() => {
    if (!src) return null;
    if (isPublicOrBlobUrl(src)) return src;
    return blobUrlBySrc.get(src) ?? null;
  });
  const [failed, setFailed] = useState(() => failedSrc.has(src));

  useEffect(() => {
    if (!enabled || !src) {
      setObjectUrl(null);
      return;
    }
    if (isPublicOrBlobUrl(src)) {
      setObjectUrl(src);
      setFailed(false);
      return;
    }
    if (failedSrc.has(src)) {
      setFailed(true);
      setObjectUrl(null);
      return;
    }
    const cached = blobUrlBySrc.get(src);
    if (cached) {
      setObjectUrl(cached);
      setFailed(false);
      return;
    }
    let cancelled = false;
    void loadAuthImageBlobUrl(src).then((url) => {
      if (cancelled) return;
      if (url) {
        setObjectUrl(url);
        setFailed(false);
      } else {
        setObjectUrl(null);
        setFailed(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [src, enabled]);

  if (!enabled) {
    return (
      <div
        className={cn(
          "bg-muted flex h-full w-full items-center justify-center text-[10px] font-medium text-muted-foreground",
          thumb ? "" : "text-sm"
        )}
        aria-hidden
      />
    );
  }

  if (failed || !objectUrl) {
    return (
      <div
        className={cn(
          "bg-muted flex h-full w-full items-center justify-center px-2 text-center text-[10px] text-muted-foreground",
          thumb ? "" : "text-sm"
        )}
        title={alt || undefined}
      >
        {failed ? (alt?.trim() || "Нет фото") : "…"}
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={objectUrl}
      alt={alt}
      draggable={false}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      fetchPriority={priority ? "high" : "low"}
      className={cn(thumb ? "h-full w-full object-cover" : "h-full w-full object-contain")}
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
  const wasOpenRef = useRef(false);
  const thumbStripRef = useRef<HTMLDivElement | null>(null);
  const thumbBtnRefs = useRef<Map<number, HTMLButtonElement>>(new Map());

  useEffect(() => {
    if (open && !wasOpenRef.current) {
      setIndex(Math.min(Math.max(0, initialIndex), Math.max(0, photos.length - 1)));
      setColumns(1);
      setGridMode(false);
    }
    wasOpenRef.current = open;
  }, [open, initialIndex, photos.length]);

  const visibleCount = columns;
  const pageSize = gridMode ? photos.length : visibleCount;
  const maxStart = Math.max(0, photos.length - pageSize);
  const lastIndex = Math.max(0, photos.length - 1);

  const visiblePhotos = useMemo(() => {
    if (gridMode) return [];
    return photos.slice(index, index + visibleCount);
  }, [gridMode, photos, index, visibleCount]);

  /** Navigatsiya — har doim 1 ta rasm (tez va tushunarli). */
  const goPrev = useCallback(() => {
    setGridMode(false);
    setIndex((i) => Math.max(0, i - 1));
  }, []);

  const goNext = useCallback(() => {
    setGridMode(false);
    setIndex((i) => Math.min(lastIndex, i + 1));
  }, [lastIndex]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      const isLeft = e.key === "ArrowLeft" || e.code === "ArrowLeft";
      const isRight = e.key === "ArrowRight" || e.code === "ArrowRight";
      if (!isLeft && !isRight) return;
      e.preventDefault();
      e.stopPropagation();
      if (isLeft) goPrev();
      else goNext();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, goPrev, goNext]);

  useEffect(() => {
    if (index > maxStart && columns > 1) {
      setIndex(maxStart);
    } else if (index > lastIndex) {
      setIndex(lastIndex);
    }
  }, [index, maxStart, lastIndex, columns]);

  // Joriy + qo‘shni rasmlarni oldindan yuklash (auth blob).
  useEffect(() => {
    if (!open || gridMode) return;
    for (let d = -1; d <= 2; d += 1) {
      const p = photos[index + d];
      if (p?.image_url) void loadAuthImageBlobUrl(p.image_url);
    }
  }, [open, gridMode, index, photos]);

  useEffect(() => {
    if (!open || gridMode) return;
    const el = thumbBtnRefs.current.get(index);
    el?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [open, gridMode, index]);

  const header = useMemo(() => title ?? "Фотоотчет", [title]);
  const hasMany = photos.length > 1;
  const canPrev = !gridMode && index > 0;
  const canNext = !gridMode && index < lastIndex;

  const counterLabel = useMemo(() => {
    if (!photos.length) return "";
    const from = index + 1;
    const to = Math.min(index + (gridMode ? 1 : visibleCount), photos.length);
    const range = from === to ? `${from}` : `${from}–${to}`;
    const client = photos[index]?.client_name?.trim();
    return client ? `${range} / ${photos.length} · ${client}` : `${range} / ${photos.length}`;
  }, [index, photos, visibleCount, gridMode]);

  /** Thumbnail: faqat yaqin atrofdagilar (to‘liq 24 ta so‘rov emas). */
  const thumbLoadRadius = 5;
  /** Grid: faqat joriy atrofida + scroll paytida lazy. */
  const gridLoadRadius = 12;

  if (!photos.length) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        overlayClassName="z-[100] bg-black/60"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft" || e.code === "ArrowLeft") {
            e.preventDefault();
            e.stopPropagation();
            goPrev();
          } else if (e.key === "ArrowRight" || e.code === "ArrowRight") {
            e.preventDefault();
            e.stopPropagation();
            goNext();
          }
        }}
        className={cn(
          "z-[100] flex flex-col gap-0 overflow-hidden rounded-xl bg-popover p-0 text-popover-foreground shadow-2xl ring-1 ring-foreground/10",
          "fixed !top-2 !bottom-2 !left-2 !right-2 !h-auto !max-h-none !w-auto !max-w-none !translate-x-0 !translate-y-0",
          "md:!left-[15.5rem]"
        )}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b px-4 py-2.5 sm:px-5">
          <p className="text-foreground min-w-0 flex-1 truncate text-sm font-semibold sm:text-base">{header}</p>
          <div className="flex shrink-0 items-center gap-2">
            <span className="text-muted-foreground hidden text-xs sm:inline">← → клавиатура</span>
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
                {photos.map((p, i) => {
                  const near = Math.abs(i - index) <= gridLoadRadius;
                  return (
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
                      <GalleryPhoto
                        src={p.image_url}
                        alt={p.caption ?? p.client_name ?? `Фото ${p.id}`}
                        thumb
                        enabled={near}
                      />
                      {!near ? (
                        <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-muted-foreground">
                          {i + 1}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <>
              <div className="relative flex min-h-0 flex-1 flex-col">
                <div className="bg-muted/25 relative flex min-h-0 flex-1 items-stretch">
                  {hasMany ? (
                    <button
                      type="button"
                      disabled={!canPrev}
                      onClick={goPrev}
                      className="bg-background/90 hover:bg-background absolute left-2 top-1/2 z-20 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-border text-foreground shadow-md disabled:opacity-30 sm:left-3 sm:h-12 sm:w-12"
                      aria-label="Предыдущее фото"
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
                          enabled
                        />
                      </div>
                    ))}
                  </div>

                  {hasMany ? (
                    <button
                      type="button"
                      disabled={!canNext}
                      onClick={goNext}
                      className="bg-background/90 hover:bg-background absolute right-[3.75rem] top-1/2 z-20 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-border text-foreground shadow-md disabled:opacity-30 sm:right-[4.25rem] sm:h-12 sm:w-12"
                      aria-label="Следующее фото"
                    >
                      <ChevronRight className="h-7 w-7 sm:h-8 sm:w-8" />
                    </button>
                  ) : null}
                </div>

                {hasMany ? (
                  <div className="shrink-0 border-t border-border px-3 py-2.5 sm:px-5">
                    <div
                      ref={thumbStripRef}
                      className="flex justify-start gap-1.5 overflow-x-auto pb-1 sm:gap-2"
                    >
                      {photos.map((p, i) => {
                        const inView =
                          columns === 1 ? i === index : i >= index && i < index + visibleCount;
                        const loadThumb = Math.abs(i - index) <= thumbLoadRadius;
                        return (
                          <button
                            key={p.id}
                            type="button"
                            ref={(el) => {
                              if (el) thumbBtnRefs.current.set(i, el);
                              else thumbBtnRefs.current.delete(i);
                            }}
                            onClick={() => setIndex(i)}
                            className={cn(
                              "relative h-14 w-11 shrink-0 overflow-hidden rounded-lg ring-2 transition sm:h-[60px] sm:w-[46px]",
                              inView
                                ? "opacity-100 ring-teal-500"
                                : "opacity-55 ring-transparent hover:opacity-90"
                            )}
                            title={`${i + 1}`}
                          >
                            <GalleryPhoto src={p.image_url} alt="" thumb enabled={loadThumb} />
                            {!loadThumb ? (
                              <span className="absolute inset-0 flex items-center justify-center bg-muted text-[10px] font-semibold text-muted-foreground">
                                {i + 1}
                              </span>
                            ) : null}
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
