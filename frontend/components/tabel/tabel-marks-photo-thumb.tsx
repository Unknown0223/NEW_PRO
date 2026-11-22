"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { personDisplayInitials } from "@/lib/person-display";

function initials(name: string) {
  return personDisplayInitials({ fio: name });
}

/** Ro‘yxat uchun frontal foto thumb (visits TerminalPhoto uslubi). */
export function TabelMarkPhotoThumb({
  punchId,
  name,
  hasPhoto,
  onOpen
}: {
  punchId: number;
  name: string;
  hasPhoto: boolean;
  onOpen?: () => void;
}) {
  const tenantSlug = useAuthStore((s) => s.tenantSlug ?? "");
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!hasPhoto || !punchId || !tenantSlug) {
      setUrl(null);
      return;
    }
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

  const body = url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="" className="size-10 rounded-md object-cover" />
  ) : (
    <span className="flex size-10 items-center justify-center rounded-md bg-muted text-[10px] font-semibold text-muted-foreground">
      {hasPhoto ? "…" : initials(name) || "•"}
    </span>
  );

  if (!onOpen) return body;
  return (
    <button type="button" className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={onOpen} aria-label="Открыть фото">
      {body}
    </button>
  );
}
