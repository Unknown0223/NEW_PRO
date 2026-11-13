"use client";

/**
 * /system-error?code=503&retryAfter=30&ref=req-…
 * Infra / rate-limit / gateway — to‘liq ishlaydigan ErrorPage (studio yo‘q).
 */
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { HttpStatusScreen } from "@/components/errors/http-status-screen";
import { isErrorCode } from "@/components/errors/error-data";

function SystemErrorContent() {
  const params = useSearchParams();
  const raw = Number(params.get("code") ?? 500);
  const code = isErrorCode(raw) ? raw : 500;
  const lang = params.get("lang") === "uz" ? "uz" : "ru";

  return (
    <HttpStatusScreen
      code={code}
      lang={lang}
      retryAfter={params.get("retryAfter") ?? undefined}
      resource={params.get("from") ?? undefined}
      referenceId={params.get("ref") ?? undefined}
      homePath="/dashboard"
      onRetry={async () => {
        window.location.reload();
      }}
    />
  );
}

export default function SystemErrorPage() {
  return (
    <Suspense
      fallback={<div className="flex h-dvh items-center justify-center text-sm text-muted-foreground">…</div>}
    >
      <SystemErrorContent />
    </Suspense>
  );
}
