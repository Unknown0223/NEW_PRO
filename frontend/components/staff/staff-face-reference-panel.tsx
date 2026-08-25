"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Trash2, Upload } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { StaffFaceAvatar } from "@/components/staff/staff-face-avatar";

type Meta = { has_reference: boolean; uploaded_at: string | null };

type Props = {
  tenantSlug: string;
  userId: number;
  /** Edit mode only — create da user hali yo‘q */
  enabled?: boolean;
  /** Display name for initials fallback */
  displayName?: string;
};

function initialsFromName(name?: string): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2);
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`;
}

export function StaffFaceReferencePanel({
  tenantSlug,
  userId,
  enabled = true,
  displayName
}: Props) {
  const [meta, setMeta] = useState<Meta | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

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

  async function onPick(file: File | null) {
    if (!file) return;
    setBusy(true);
    setErr(null);
    try {
      const image_base64 = await fileToBase64(file);
      await api.put(`/api/${tenantSlug}/staff/users/${userId}/face-reference`, {
        image_base64
      });
      setTick((t) => t + 1);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Yuklash xatosi");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function onDelete() {
    if (!confirm("Etalon yuz rasmini o‘chirishni tasdiqlaysizmi?")) return;
    setBusy(true);
    setErr(null);
    try {
      await api.delete(`/api/${tenantSlug}/staff/users/${userId}/face-reference`);
      setTick((t) => t + 1);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "O‘chirish xatosi");
    } finally {
      setBusy(false);
    }
  }

  if (!enabled) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border/70 bg-muted/20 px-4 py-6 text-center">
        <div className="grid h-28 w-28 place-items-center rounded-full border-2 border-dashed border-border bg-muted/40 text-muted-foreground">
          <Camera className="h-8 w-8 opacity-50" />
        </div>
        <p className="text-xs text-muted-foreground">
          Etalon yuz rasmi — xodim saqlangandan keyin yuklanadi.
        </p>
      </div>
    );
  }

  const hasPhoto = Boolean(meta?.has_reference);

  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-border/60 bg-gradient-to-b from-slate-50 to-white px-4 py-5">
      <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
        <Camera className="h-4 w-4 text-teal-700" />
        Foto profil
      </div>
      <div key={tick} className="relative">
        <StaffFaceAvatar
          tenantSlug={tenantSlug}
          userId={userId}
          initials={initialsFromName(displayName)}
          alt="Etalon yuz"
          size="xl"
          hasPhoto={hasPhoto}
          className="border-[3px] border-teal-100 shadow-md"
        />
      </div>
      <p className="max-w-sm text-center text-xs text-muted-foreground">
        Bu rasm akkauntga birikadi. Mobil selfie faqat shu rasm bilan solishtiriladi.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
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
          {hasPhoto ? "Almashtirish" : "Yuklash"}
        </Button>
        {hasPhoto ? (
          <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => void onDelete()}>
            <Trash2 className="mr-1.5 h-3.5 w-3.5 text-destructive" />
            O‘chirish
          </Button>
        ) : null}
      </div>
      {meta?.uploaded_at ? (
        <span className="text-[11px] text-muted-foreground">
          Yuklangan: {new Date(meta.uploaded_at).toLocaleString()}
        </span>
      ) : null}
      {err ? <p className="text-xs text-destructive">{err}</p> : null}
    </div>
  );
}
