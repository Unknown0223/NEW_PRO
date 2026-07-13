"use client";

import { AppThemeProvider } from "@/components/app-theme-provider";
import { LoaderPrefsProvider } from "@/components/loader-prefs-provider";
import { ShiftWheelHorizontalScroll } from "@/components/shift-wheel-horizontal-scroll";
import { WebVitalsReporter } from "@/components/web-vitals-reporter";
import { isApiUnreachable } from "@/lib/error-utils";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { persistQueryClient } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { useEffect, useState } from "react";

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
      key: "salec:rq:v1"
    });
    persistQueryClient({
      queryClient,
      persister,
      maxAge: 10 * 60 * 1000, // 10 min
      /** O‘zgartirilganda eski localStorage keshi bekor — infinite query shakli bilan to‘qnashmasin */
      buster: "v3",
      dehydrateOptions: {
        shouldDehydrateQuery: (q) => {
          if (q.state.status !== "success") return false;
          const key = q.queryKey;
          if (Array.isArray(key) && key[0] === "settings" && key[1] === "profile") return false;
          return true;
        }
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
