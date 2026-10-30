"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";

export type WorkdayAccessStatus = {
  restricted: boolean;
  allowed: boolean;
  role_label: string | null;
  today: string;
  reason: "schedule" | "exception" | null;
  reason_label: string | null;
  comment: string | null;
  next_work_day: string | null;
  next_work_start: string | null;
  seconds_until_start: number | null;
  message: string | null;
};

const POLL_MS = 60_000;

export function workdayStatusQueryKey(tenantSlug: string | null) {
  return ["workday-status", tenantSlug] as const;
}

export function useWorkdayStatus(options: { enabled?: boolean } = {}) {
  const tenantSlug = useAuthStore((s) => s.tenantSlug);
  const accessToken = useAuthStore((s) => s.accessToken);
  return useQuery({
    queryKey: workdayStatusQueryKey(tenantSlug),
    enabled: Boolean(tenantSlug && accessToken) && options.enabled !== false,
    refetchInterval: POLL_MS,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
    retry: false,
    staleTime: 15_000,
    queryFn: async () => {
      const { data } = await api.get<{ data: WorkdayAccessStatus }>(`/api/${tenantSlug}/me/workday-status`);
      return data.data;
    }
  });
}

/** Qolgan vaqt: `1 д 04:05:09` yoki `04:05:09`. */
export function formatCountdown(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const days = Math.floor(s / 86_400);
  const hh = String(Math.floor((s % 86_400) / 3600)).padStart(2, "0");
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return days > 0 ? `${days} д ${hh}:${mm}:${ss}` : `${hh}:${mm}:${ss}`;
}
