"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, ClipboardPaste, Trash2, Upload } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { useAppConfirm } from "@/components/ui/app-confirm-dialog";
import {
  invalidateStaffFaceAvatarCache,
  StaffFaceAvatar
} from "@/components/staff/staff-face-avatar";
import {
  compressImageForFaceUpload,
  ensureImageFile,
  isLikelyImageFile,
  pickImageFileFromClipboard,
  pickImageFileFromClipboardApi,
  pickImageFileFromDataTransfer
} from "@/lib/staff-face-drop";
import { getUserFacingError } from "@/lib/error-utils";
import { cn } from "@/lib/utils";
import { isAxiosError } from "axios";

type Meta = { has_reference: boolean; uploaded_at: string | null };

type Props = {
  tenantSlug: string;
  userId: number;
  enabled?: boolean;
  displayName?: string;
  /** Dialog yon panel — ixcham, scrollsiz */
  compact?: boolean;
};

function initialsFromName(name?: string): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2);
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`;
}

const DROP_HINT =
  "Telegram: фотони нусхаланг (ПКМ → Копировать) ва «Вставить» yoki Ctrl+V. Yoki «Загрузить» orqali fayl tanlang.";

export function StaffFaceReferencePanel({
  tenantSlug,
  userId,
  enabled = true,
  displayName,
  compact = false
}: Props) {
  const [meta, setMeta] = useState<Meta | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const dragDepthRef = useRef(0);
  const { confirm, dialog: confirmDialog } = useAppConfirm();

  const load = useCallback(async () => {
    if (!enabled || !userId) return;
    try {
      const { data } = await api.get<Meta>(`/api/${tenantSlug}/staff/users/${userId}/face-meta`);
      setMeta(data);
      setErr(null);
    } catch {
      setMeta({ has_reference: false, uploaded_at: null });
    }
  }, [tenantSlug, userId, enabled]);

  useEffect(() => {
    void load();
  }, [load, tick]);

  async function fileToBase64(file: File): Promise<string> {
    const buf = await file.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
    return btoa(binary);
  }

  const onPick = useCallback(
    async (file: File | null) => {
      if (!file) return;
      const normalized = (await ensureImageFile(file)) ?? (isLikelyImageFile(file) ? file : null);
      if (!normalized) {
        setErr(`Нужен JPEG / PNG / WebP. ${DROP_HINT}`);
        return;
      }
      setBusy(true);
      setErr(null);
      try {
        const { prepareFaceReferenceFromFile } = await import("@/lib/face-image-prepare");
        const prepared = await prepareFaceReferenceFromFile(normalized);
        if ("error" in prepared) {
          /* Fallback: eski siqilgan yuklash (MediaPipe yo‘q tarmoqda). */
          const compressed = await compressImageForFaceUpload(normalized);
          const image_base64 = await fileToBase64(compressed);
          await api.put(`/api/${tenantSlug}/staff/users/${userId}/face-reference`, {
            image_base64
          });
        } else {
          await api.put(`/api/${tenantSlug}/staff/users/${userId}/face-reference`, {
            image_base64: prepared.image_base64,
            landmarks: prepared.landmarks
          });
        }
        invalidateStaffFaceAvatarCache(tenantSlug, userId);
        setTick((t) => t + 1);
      } catch (e) {
        if (isAxiosError(e)) {
          const body = e.response?.data as { message?: string; error?: string } | undefined;
          if (body?.message) {
            setErr(body.message);
          } else if (e.response?.status === 400) {
            setErr("Фото не принято (слишком большое или нечёткое). Попробуйте другое фото.");
          } else {
            setErr(getUserFacingError(e, "Ошибка загрузки"));
          }
        } else {
          setErr(e instanceof Error ? e.message : "Ошибка загрузки");
        }
      } finally {
        setBusy(false);
        if (inputRef.current) inputRef.current.value = "";
      }
    },
    [tenantSlug, userId]
  );

  async function onDelete() {
    const ok = await confirm({
      title: "Удалить",
      message: "Удалить эталонное фото лица?",
      confirmLabel: "Да",
      cancelLabel: "Нет",
      destructive: true
    });
    if (!ok) return;
    setBusy(true);
    setErr(null);
    try {
      await api.delete(`/api/${tenantSlug}/staff/users/${userId}/face-reference`);
      invalidateStaffFaceAvatarCache(tenantSlug, userId);
      setTick((t) => t + 1);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Ошибка удаления");
    } finally {
      setBusy(false);
    }
  }

  async function onPasteFromClipboardButton() {
    if (busy) return;
    setErr(null);
    const fromApi = await pickImageFileFromClipboardApi();
    if (fromApi) {
      await onPick(fromApi);
      return;
    }
    setErr(
      "Буферда фото йўқ. Telegramда расмга ПКМ → «Копировать», сўнг яна «Вставить» босинг. Ёки «Загрузить»."
    );
  }

  // Dialog ichida drop ishonchli bo‘lishi uchun document-level dragover
  useEffect(() => {
    if (!enabled) return;
    const onDocDragOver = (e: DragEvent) => {
      if (!rootRef.current) return;
      e.preventDefault();
    };
    const onDocDrop = (e: DragEvent) => {
      if (!rootRef.current?.contains(e.target as Node) && e.target !== rootRef.current) {
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      dragDepthRef.current = 0;
      setDragOver(false);
      if (busy) return;
      void (async () => {
        const file = await pickImageFileFromDataTransfer(e.dataTransfer);
        if (!file) {
          setErr(
            `Telegram браузерга файл бермади (Windows чеклаши). ${DROP_HINT}`
          );
          return;
        }
        await onPick(file);
      })();
    };
    document.addEventListener("dragover", onDocDragOver);
    document.addEventListener("drop", onDocDrop);
    return () => {
      document.removeEventListener("dragover", onDocDragOver);
      document.removeEventListener("drop", onDocDrop);
    };
  }, [enabled, busy, onPick]);

  function onDragEnter(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    dragDepthRef.current += 1;
    setDragOver(true);
  }

  function onDragLeave(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) setDragOver(false);
  }

  function onDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    dragDepthRef.current = 0;
    setDragOver(false);
    if (busy) return;
    void (async () => {
      const file = await pickImageFileFromDataTransfer(e.dataTransfer);
      if (!file) {
        setErr(`Telegram браузерга файл бермади (Windows чеклаши). ${DROP_HINT}`);
        return;
      }
      await onPick(file);
    })();
  }

  function onPaste(e: React.ClipboardEvent) {
    if (busy) return;
    void (async () => {
      const file =
        (await pickImageFileFromClipboard(e.clipboardData?.items ?? null)) ||
        (await pickImageFileFromClipboardApi());
      if (!file) return;
      e.preventDefault();
      await onPick(file);
    })();
  }

  if (!enabled) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border/70 bg-muted/20 px-4 py-6 text-center">
        <div className="grid h-28 w-28 place-items-center rounded-full border-2 border-dashed border-border bg-muted/40 text-muted-foreground">
          <Camera className="h-8 w-8 opacity-50" />
        </div>
        <p className="text-xs text-muted-foreground">
          Эталонное фото лица можно загрузить после сохранения сотрудника.
        </p>
      </div>
    );
  }

  const hasPhoto = Boolean(meta?.has_reference);

  return (
    <div
      ref={rootRef}
      className={cn(
        "flex flex-col items-center rounded-2xl border bg-gradient-to-b from-slate-50 to-white transition-colors outline-none",
        compact ? "gap-2 px-3 py-3" : "gap-3 px-4 py-5",
        dragOver
          ? "border-teal-500 border-dashed bg-teal-50/80 ring-2 ring-teal-400/40"
          : "border-border/60"
      )}
      tabIndex={0}
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onPaste={onPaste}
    >
      <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
        <Camera className="h-4 w-4 text-teal-700" />
        Фото профиля
      </div>
      <div key={tick} className="relative">
        <StaffFaceAvatar
          tenantSlug={tenantSlug}
          userId={userId}
          initials={initialsFromName(displayName)}
          alt="Эталонное фото лица"
          size={compact ? "lg" : "xl"}
          hasPhoto={hasPhoto}
          className={cn(
            "border-[3px] shadow-md",
            dragOver ? "border-teal-400" : "border-teal-100"
          )}
        />
        {dragOver ? (
          <div className="pointer-events-none absolute inset-0 grid place-items-center rounded-full bg-teal-600/70 text-[11px] font-semibold text-white">
            Отпустите
          </div>
        ) : null}
      </div>
      <p
        className={cn(
          "text-center text-muted-foreground",
          compact ? "max-w-[240px] text-[11px] leading-snug" : "max-w-sm text-xs"
        )}
      >
        {compact ? (
          <>
            Telegram: <strong>Копировать</strong> → <strong>Вставить</strong> / Ctrl+V
          </>
        ) : (
          <>
            Telegramдан: расмга <strong>ПКМ → Копировать</strong>, кейин{" "}
            <strong>Вставить</strong> / Ctrl+V. Ёки «Загрузить». Селфи фақат шу эталон билан
            солиштирилади.
          </>
        )}
      </p>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/*"
          className="hidden"
          onChange={(e) => void onPick(e.target.files?.[0] ?? null)}
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          <Upload className="mr-1.5 h-3.5 w-3.5" />
          {hasPhoto ? "Заменить" : "Загрузить"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={busy}
          onClick={() => void onPasteFromClipboardButton()}
        >
          <ClipboardPaste className="mr-1.5 h-3.5 w-3.5" />
          Вставить
        </Button>
        {hasPhoto ? (
          <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => void onDelete()}>
            <Trash2 className="mr-1.5 h-3.5 w-3.5 text-destructive" />
            Удалить
          </Button>
        ) : null}
      </div>
      {meta?.uploaded_at && !compact ? (
        <span className="text-[11px] text-muted-foreground">
          Загружено: {new Date(meta.uploaded_at).toLocaleString()}
        </span>
      ) : null}
      {err ? <p className="text-xs text-destructive">{err}</p> : null}
      {confirmDialog}
    </div>
  );
}
