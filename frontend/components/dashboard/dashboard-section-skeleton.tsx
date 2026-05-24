import { Skeleton } from "@/components/ui/skeleton";

export function DashboardFiltersSkeleton({ fields = 6 }: { fields?: number }) {
  return (
    <div className="flex flex-wrap gap-2">
      {Array.from({ length: fields }).map((_, i) => (
        <Skeleton key={i} className="h-9 w-28 rounded-md" />
      ))}
    </div>
  );
}

export function DashboardKpiSkeleton({ cards = 4 }: { cards?: number }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: cards }).map((_, i) => (
        <Skeleton key={i} className="h-24 rounded-xl" />
      ))}
    </div>
  );
}

export function DashboardTableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      <Skeleton className="h-8 w-full rounded-md" />
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-9 w-full rounded-md" />
      ))}
    </div>
  );
}
