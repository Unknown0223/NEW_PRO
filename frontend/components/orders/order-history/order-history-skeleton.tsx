"use client";

export function OrderHistorySkeleton() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-24">
      <div
        className="size-8 animate-spin rounded-full border-2 border-muted border-t-teal-600"
        aria-hidden
      />
      <span className="text-sm text-muted-foreground">Загрузка...</span>
    </div>
  );
}
