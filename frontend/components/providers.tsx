"use client";

import { AppThemeProvider } from "@/components/app-theme-provider";
import { LoaderPrefsProvider } from "@/components/loader-prefs-provider";
import { ShiftWheelHorizontalScroll } from "@/components/shift-wheel-horizontal-scroll";
import { WebVitalsReporter } from "@/components/web-vitals-reporter";
import { useAuthStore } from "@/lib/auth-store";
import { isApiUnreachable } from "@/lib/error-utils";
import { decodeAccessTokenUserId } from "@/lib/me-permissions";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { persistQueryClient } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { useEffect, useState } from "react";

const RQ_PERSIST_KEY = "salec:rq:v1";

/** Scope-ga bog‘liq keshlarni localStorage da saqlamaslik (admin → operator o‘tishda sizib chiqmasin). */
function shouldPersistQueryKey(key: unknown): boolean {
  if (!Array.isArray(key) || key.length === 0) return true;
  const root = key[0];
  if (
    root === "orders" ||
    root === "agents" ||
    root === "agent" ||
    root === "clients" ||
    root === "clients-references" ||
    root === "expeditors" ||
    root === "payments" ||
    root === "client-balances" ||
    root === "consignment" ||
    root === "reports" ||
    root === "dashboard"
  ) {
    return false;
  }
  if (root === "me" && (key[1] === "access-permissions" || key[1] === "ui-preferences")) return false;
  if (root === "settings" && key[1] === "profile") return false;
  if (root === "access-territories" || root === "access-users" || root === "access-user-detail") return false;
  return true;
}

/** Panel uchun: keraksiz qayta-so‘rovlarni kamaytiradi (tezroq tuyiladi). */
function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        /** Ro‘yxatlar: qisqa muddatda bir xil ma’lumot qayta olinmasin */
        staleTime: 90 * 1000,
        gcTime: 20 * 60 * 1000,
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
        /** Backend o‘chiq bo‘lsa qayta urinmasin — konsoldagi ERR_CONNECTION_REFUSED takrorini kamaytiradi */
        retry: (failureCount, error) => {
          if (isApiUnreachable(error)) return false;
          return failureCount < 1;
        }
      },
      mutations: {
        retry: 0
      }
    }
  });
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(makeQueryClient);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const persister = createSyncStoragePersister({
      storage: window.localStorage,
      key: RQ_PERSIST_KEY
    });
    persistQueryClient({
      queryClient,
      persister,
      maxAge: 10 * 60 * 1000, // 10 min
      /** O‘zgartirilganda eski localStorage keshi bekor — infinite query shakli bilan to‘qnashmasin */
      buster: "v6-actor-scope-wipe-guard",
      dehydrateOptions: {
        shouldDehydrateQuery: (q) => {
          if (q.state.status !== "success") return false;
          return shouldPersistQueryKey(q.queryKey);
        }
      }
    });
  }, [queryClient]);

  /** Login / logout / boshqa foydalanuvchi — keshlarni tozalash (admin ro‘yxati operatorga ko‘rinmasin). */
  useEffect(() => {
    let prevUserId = decodeAccessTokenUserId(useAuthStore.getState().accessToken);
    return useAuthStore.subscribe((state) => {
      const nextUserId = decodeAccessTokenUserId(state.accessToken);
      if (nextUserId === prevUserId) return;
      prevUserId = nextUserId;
      queryClient.clear();
      try {
        window.localStorage.removeItem(RQ_PERSIST_KEY);
      } catch {
        /* ignore */
      }
    });
  }, [queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      <AppThemeProvider>
        <LoaderPrefsProvider>
          <ShiftWheelHorizontalScroll />
          <WebVitalsReporter />
          {children}
        </LoaderPrefsProvider>
      </AppThemeProvider>
    </QueryClientProvider>
  );
}
