"use client";

import { useEffect, useState } from "react";
import { ImagePlus, Trash2, X } from "lucide-react";
import { buttonVariants } from "@/components/ui/button-variants";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

const blobUrlByKey = new Map<string, string>();
const emptyKeys = new Set<string>();

function cacheKey(tenantSlug: string, clientId: number): string {
  return `${tenantSlug}:${clientId}`;
}

export function dropClientProfilePhotoCache(tenantSlug: string, clientId: number): void {
  const key = cacheKey(tenantSlug, clientId);
  emptyKeys.delete(key);
  const old = blobUrlByKey.get(key);
  if (old) URL.revokeObjectURL(old);
  blobUrlByKey.delete(key);
}

async function loadPhotoBlob(tenantSlug: string, clientId: number): Promise<string | null> {
  const key = cacheKey(tenantSlug, clientId);
  if (emptyKeys.has(key)) return null;
  const cached = blobUrlByKey.get(key);
  if (cached) return cached;
  try {
    const res = await api.get<Blob>(`/api/${tenantSlug}/clients/${clientId}/profile-photo`, {
      responseType: "blob",
      headers: { Accept: "image/jpeg,image/*" }
    });
    const blob = res.data;
    if (!(blob instanceof Blob) || blob.size === 0) {
      emptyKeys.add(key);
      return null;
    }
    const type = (blob.type || "").toLowerCase();
    if (type.includes("application/json") || type.startsWith("text/")) {
      emptyKeys.add(key);
      return null;
    }
    const url = URL.createObjectURL(blob);
    blobUrlByKey.set(key, url);
    return url;
  } catch {
    emptyKeys.add(key);
    return null;
  }
}

export async function fileToClientPhotoDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const maxEdge = 1600;
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.82);
}

function PhotoFrame({
  src,
  large,
  onOpen
}: {
  src: string | null;
  large?: boolean;
  onOpen?: () => void;
}) {
  const frame = (
    <span
      className={cn(
        "flex items-center justify-center overflow-hidden rounded-2xl bg-muted",
        large ? "aspect-[4/3] w-full" : "h-24 w-24 shrink-0"
      )}
    >
      {src ? (
        <img src={src} alt="Фото клиента" className="h-full w-full object-cover" />
      ) : (
        <ImagePlus className="h-8 w-8 text-muted-foreground" aria-hidden />
      )}
    </span>
  );
  if (!src || !onOpen) return frame;
  return (
    <button type="button" className="block w-full text-left" onClick={onOpen}>
      {frame}
    </button>
  );
}

function PhotoLightbox({ src, onClose }: { src: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <button
        type="button"
        className="absolute right-4 top-4 rounded-full bg-white/90 p-2 text-foreground"
        onClick={onClose}
        aria-label="Закрыть"
      >
        <X className="h-5 w-5" />
      </button>
      <img
        src={src}
        alt="Фото клиента"
        className="max-h-[85vh] max-w-full rounded-xl object-contain"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}

/** Kartochkada faqat ko'rish. Qo'yish — yaratish va tahrirlashda. */
export function ClientProfilePhotoView({ tenantSlug, clientId }: { tenantSlug: string; clientId: number }) {
  const [src, setSrc] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let live = true;
    void loadPhotoBlob(tenantSlug, clientId).then((url) => {
      if (live) setSrc(url);
    });
    return () => {
      live = false;
    };
  }, [tenantSlug, clientId]);

  if (!src) {
    return (
      <section className="rounded-lg border border-dashed border-border/80 bg-card px-3 py-2 text-xs text-muted-foreground">
        Фото клиента ещё не задано. Его можно добавить при создании или редактировании.
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-lg border border-border/70 bg-card p-3 shadow-sm">
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Фото клиента</p>
      <PhotoFrame src={src} large onOpen={() => setOpen(true)} />
      <p className="mt-2 text-xs text-muted-foreground">Нажмите, чтобы открыть.</p>
      {open ? <PhotoLightbox src={src} onClose={() => setOpen(false)} /> : null}
    </section>
  );
}

type FieldProps = {
  tenantSlug: string;
  /** Yo'q bo'lsa — yaratish: rasm saqlanguncha qoralamada turadi. */
  clientId?: number;
  draft: string | null;
  onDraft: (dataUrl: string | null) => void;
};

/** Yaratish va tahrirlash: faqat bitta rasm. */
export function ClientProfilePhotoField({ tenantSlug, clientId, draft, onDraft }: FieldProps) {
  const [src, setSrc] = useState<string | null>(draft);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    if (!clientId || !tenantSlug) {
      setSrc(draft);
      return;
    }
    let live = true;
    void loadPhotoBlob(tenantSlug, clientId).then((url) => {
      if (live) setSrc(url);
    });
    return () => {
      live = false;
    };
  }, [tenantSlug, clientId, draft, reload]);

  async function onFile(file: File | undefined) {
    if (!file || busy) return;
    if (!file.type.startsWith("image/")) {
      setError("Выберите изображение");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const imageUrl = await fileToClientPhotoDataUrl(file);
      if (!clientId) {
        onDraft(imageUrl);
        setSrc(imageUrl);
        return;
      }
      await api.put(`/api/${tenantSlug}/clients/${clientId}/profile-photo`, { image_url: imageUrl });
      dropClientProfilePhotoCache(tenantSlug, clientId);
      setReload((n) => n + 1);
    } catch {
      setError("Не удалось сохранить фото");
    } finally {
      setBusy(false);
    }
  }

  async function onRemove() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      if (!clientId) {
        onDraft(null);
        setSrc(null);
        return;
      }
      await api.delete(`/api/${tenantSlug}/clients/${clientId}/profile-photo`);
      dropClientProfilePhotoCache(tenantSlug, clientId);
      setSrc(null);
      setReload((n) => n + 1);
    } catch {
      setError("Не удалось удалить фото");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-lg border bg-card p-4 shadow-sm sm:p-5">
      <p className="text-sm font-semibold">Фото клиента</p>
      <p className="mt-1 text-xs text-muted-foreground">Только одно фото. Новое заменяет предыдущее и видно в мобильном приложении.</p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <PhotoFrame src={src} onOpen={src ? () => setOpen(true) : undefined} />
        <div className="flex flex-wrap gap-2">
          <label className={cn(buttonVariants({ size: "sm", variant: "outline" }), busy && "pointer-events-none opacity-60")}>
            {src ? "Заменить" : "Загрузить"}
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              disabled={busy}
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                void onFile(file);
              }}
            />
          </label>
          {src ? (
            <button
              type="button"
              className={cn(buttonVariants({ size: "sm", variant: "ghost" }), "text-destructive")}
              disabled={busy}
              onClick={() => void onRemove()}
            >
              <Trash2 className="h-4 w-4" />
              Удалить
            </button>
          ) : null}
        </div>
      </div>
      {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
      {src && open ? <PhotoLightbox src={src} onClose={() => setOpen(false)} /> : null}
    </section>
  );
}
