"use client";

export function OrderDetailSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="h-72 rounded-xl border border-border/60 bg-muted/30" />
          <div className="h-56 rounded-xl border border-border/60 bg-muted/30" />
          <div className="h-80 rounded-xl border border-border/60 bg-muted/30" />
        </div>
        <div className="space-y-4">
          <div className="h-16 rounded-xl border border-border/60 bg-muted/30" />
          <div className="grid grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-36 rounded-xl border border-border/60 bg-muted/30" />
            ))}
          </div>
          <div className="h-48 rounded-xl border border-border/60 bg-muted/30" />
        </div>
      </div>
    </div>
  );
}
