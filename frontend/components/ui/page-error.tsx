"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  title?: string;
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
  action?: ReactNode;
  className?: string;
};

/** Sahifa yoki bo'lim yuklanmagan / xato holati (error boundary alternativasi). */
export function PageError({
  title = "Не удалось загрузить данные",
  message,
  onRetry,
  retryLabel = "Повторить",
  action,
  className
}: Props) {
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
