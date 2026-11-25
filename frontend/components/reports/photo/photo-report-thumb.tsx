"use client";

import { useEffect, useState } from "react";
import { Camera } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

type Props = {
  src: string | null;
  alt?: string;
  className?: string;
  onClick?: () => void;
};

function AuthBlobImg({ src, alt, className, onClick }: Omit<Props, "src"> & { src: string }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    void (async () => {
      try {
        const res = await api.get<Blob>(src, {
          responseType: "blob",
          headers: { Accept: "image/jpeg,image/png,image/webp,image/*,*/*" }
        });
        const blob = res.data as Blob;
        if (!blob || blob.size === 0 || cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        if (!cancelled) setUrl(objectUrl);
      } catch {
        if (!cancelled) setUrl(null);
      }
    })();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [src]);

  if (!url) {
    return (
      <div className={cn("flex items-center justify-center bg-muted text-muted-foreground", className)}>
        <Camera className="h-6 w-6 opacity-50" />
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- auth blob URL
    <img
      src={url}
      alt={alt}
      className={cn("object-cover", className, onClick ? "cursor-pointer" : undefined)}
      onClick={onClick}
    />
  );
}

export function PhotoReportThumb({ src, alt = "", className, onClick }: Props) {
  if (!src) {
    return (
      <div
        className={cn("flex items-center justify-center bg-muted text-muted-foreground", className)}
        aria-label="Нет фото"
      >
        <Camera className="h-6 w-6 opacity-50" />
      </div>
    );
  }
  return <AuthBlobImg key={src} src={src} alt={alt} className={className} onClick={onClick} />;
}
