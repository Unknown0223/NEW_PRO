"use client";

import { ErrorPage } from "@/components/errors/ErrorPage";

/** Root layout yiqilganda — alohida html/body kerak. */
export default function GlobalError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="ru">
      <body className="m-0 min-h-dvh bg-[#f2f5fa]">
        <div className="flex min-h-dvh items-stretch justify-center p-3">
          <ErrorPage code={500} referenceId={error.digest} onRetry={reset} homeHref="/login" />
        </div>
      </body>
    </html>
  );
}
