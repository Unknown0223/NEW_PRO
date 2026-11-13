"use client";

import { HttpStatusScreen } from "@/components/errors/http-status-screen";

export default function DashboardError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // Faqat correlation ID — stack / ichki tafsilot chiqarilmaydi.
  return (
    <HttpStatusScreen
      code={500}
      referenceId={error.digest}
      onRetry={async () => {
        reset();
      }}
    />
  );
}
