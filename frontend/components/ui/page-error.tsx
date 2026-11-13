"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { PageLoadHttpError } from "@/components/errors/page-load-http-error";
import { errorCodeFromUnknown } from "@/lib/http-status-from-error";
import { cn } from "@/lib/utils";

type Props = {
  title?: string;
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
  action?: ReactNode;
  className?: string;
  /** Agar HTTP status 401…504 bo‘lsa — to‘liq ErrorPage. */
  error?: unknown;
  resource?: string;
};

/** Sahifa yoki bo'lim yuklanmagan / xato holati. */
export function PageError({
  title = "Не удалось загрузить данные",
  message,
  onRetry,
  retryLabel = "Повторить",
  action,
  className,
  error,
  resource
}: Props) {
  if (error != null && errorCodeFromUnknown(error) != null) {
    return (
      <PageLoadHttpError
        error={error}
        resource={resource}
        onRetry={onRetry ? () => onRetry() : undefined}
      />
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-4 rounded-lg border border-destructive/30 bg-destructive/5 px-6 py-10 text-center",
        className
      )}
      role="alert"
    >
      <div className="space-y-1">
        <p className="text-sm font-semibold text-destructive">{title}</p>
        <p className="max-w-lg text-sm text-muted-foreground">{message}</p>
      </div>
      {onRetry ? (
        <Button type="button" size="sm" variant="outline" onClick={onRetry}>
          {retryLabel}
        </Button>
      ) : null}
      {action}
    </div>
  );
}
