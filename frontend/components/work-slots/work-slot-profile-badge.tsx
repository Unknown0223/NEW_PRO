"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { STALE } from "@/lib/query-stale";
import { SlotBadge } from "./slot-badge";

/** Mobil agent ilovasi o‘rniga veb: `/auth/me` dagi ishchi o‘rni kodi. */
export function WorkSlotProfileBadge() {
  const meQ = useQuery({
    queryKey: ["auth", "me", "work-slot"],
    staleTime: STALE.profile,
    queryFn: async () => {
      const { data } = await api.get<{
        user: { work_slot_code?: string | null; role?: string };
      }>("/auth/me");
      return data.user;
    }
  });

  const code = meQ.data?.work_slot_code;
  if (!code?.trim()) return null;

  return (
    <div
      className="flex items-center justify-center gap-1.5 px-2 py-1"
      title="Sizning ishchi o‘rni kodi (mobil agent-config bilan bir xil)"
    >
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Joy</span>
      <SlotBadge code={code} />
    </div>
  );
}
