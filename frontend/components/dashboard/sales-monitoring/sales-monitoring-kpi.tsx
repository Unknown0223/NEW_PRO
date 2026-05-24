"use client";

import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface SalesKpiCardProps {
  title: string;
  value: string | number;
  change?: number;
  isLoading?: boolean;
  icon?: React.ReactNode;
}

export function SalesKpiCard({ title, value, change, isLoading, icon }: SalesKpiCardProps) {
  if (isLoading) {
    return (
      <Card className="p-4">
        <Skeleton className="h-4 w-20 mb-2" />
        <Skeleton className="h-8 w-32" />
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{title}</span>
        {icon && <span className="text-muted-foreground">{icon}</span>}
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-2xl font-semibold">{value}</span>
        {change !== undefined && (
          <span
            className={`text-sm ${change >= 0 ? "text-emerald-600" : "text-red-600"}`}
          >
            {change >= 0 ? "+" : ""}
            {change}%
          </span>
        )}
      </div>
    </Card>
  );
}

export function SalesKpiRow({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-4 md:grid-cols-4">{children}</div>;
}