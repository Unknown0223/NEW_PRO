"use client";

import { ErrorPage } from "@/components/errors/ErrorPage";

export default function RootError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-dvh items-stretch justify-center bg-[#f2f5fa] p-3">
      <ErrorPage code={500} referenceId={error.digest} onRetry={reset} homeHref="/dashboard" />
    </div>
  );
}
