"use client";

/**
 * /forbidden?from=Пользователи — 403 ruxsat yo‘q sahifasi.
 */
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { HttpStatusScreen } from "@/components/errors/http-status-screen";

function ForbiddenContent() {
  const from = useSearchParams().get("from") ?? undefined;

  return (
    <HttpStatusScreen
      code={403}
      resource={from}
      homePath="/dashboard"
      onRequestAccess={() => {
        window.location.assign("/access");
      }}
    />
  );
}

export default function ForbiddenPage() {
  return (
    <Suspense fallback={null}>
      <ForbiddenContent />
    </Suspense>
  );
}
