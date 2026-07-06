"use client";

import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { useQuery } from "@tanstack/react-query";

/**
 * Ajratilgan sessiya nazorati: belgilangan oraliqda `/auth/me` ni so'roqlaydi.
 * Agar sessiya boshqa qurilmada kirilgani yoki admin tomonidan tugatilgani
 * sababli yopilgan bo'lsa, backend `401 SESSION_REVOKED` qaytaradi va
 * `api` interceptor foydalanuvchini bildirishnoma bilan login sahifasiga
 * yo'naltiradi. Bu komponent faqat so'rovni davriy yuborib turadi
 * (foydalanuvchi hech narsa qilmay tursa ham aniqlanishi uchun).
 */
const POLL_MS = 25_000;

export function SessionWatcher() {
  const accessToken = useAuthStore((s) => s.accessToken);

  useQuery({
    queryKey: ["session-watch"],
    enabled: Boolean(accessToken),
    refetchInterval: POLL_MS,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
    retry: false,
    gcTime: 0,
    staleTime: 0,
    queryFn: async () => {
      await api.get("/auth/me");
      return true;
    }
  });

  return null;
}
