"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Briefcase } from "lucide-react";
import { api } from "@/lib/api";
import { STALE } from "@/lib/query-stale";
import { useAuthStore, useAuthStoreHydrated } from "@/lib/auth-store";
import { cn } from "@/lib/utils";

export function WorkSlotsPendingBell({ tenantSlug }: { tenantSlug: string | null }) {
  const authHydrated = useAuthStoreHydrated();
  const accessToken = useAuthStore((s) => s.accessToken);

  const q = useQuery({
    queryKey: ["work-slots-pending-count", tenantSlug],
    enabled: Boolean(tenantSlug) && authHydrated && Boolean(accessToken?.trim()),
    staleTime: STALE.live,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data } = await api.get<{ count: number }>(
        `/api/${tenantSlug}/work-slots/pending-count`
      );
      return data.count ?? 0;
    }
  });

  const count = q.data ?? 0;
  if (count < 1) return null;

  return (
    <Link
      href="/work-slots"
      className={cn(
        "relative flex h-9 w-9 items-center justify-center rounded-md",
        "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
      )}
      title={`${count} ta agent tanlash kutilmoqda`}
    >
      <Briefcase className="h-4 w-4" aria-hidden />
      <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
        {count > 99 ? "99+" : count}
      </span>
    </Link>
  );
}
