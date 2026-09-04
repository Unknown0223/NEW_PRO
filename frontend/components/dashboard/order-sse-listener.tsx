"use client";

import { api, resolveApiOrigin } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { invalidateLiveDashboardQueries } from "@/lib/dashboard-shared-query-keys";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

type StreamPayload = { type: string; tenant_id?: number; order_id?: number };

/**
 * Zakazlar o‘zgarishlarini SSE orqali tinglaydi va tegishli React Query so‘rovlarini yangilaydi.
 * Guruh status: N ta `order.updated` → bitta debounce refetch (har event uchun alohida GET emas).
 */
export function OrderSseListener() {
  const qc = useQueryClient();
  const tenantSlug = useAuthStore((s) => s.tenantSlug);
  const accessToken = useAuthStore((s) => s.accessToken);
  const esRef = useRef<EventSource | null>(null);
  const nudgeRef = useRef(false);
  const listInvalidateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingOrderIdsRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    if (!tenantSlug || !accessToken) {
      if (esRef.current) {
        esRef.current.close();
        esRef.current = null;
      }
      return;
    }

    let cancelled = false;
    let ownedEs: EventSource | null = null;
    const slugAtStart = tenantSlug;

    (async () => {
      try {
        /* Bearer bilan tekshiruv: eskirgan access JWT bo‘lsa interceptor refresh qiladi; SSE URL faqat query token oladi. */
        await api.get(`/api/${slugAtStart}/protected`);
      } catch {
        return;
      }
      if (cancelled || useAuthStore.getState().tenantSlug !== slugAtStart) return;

      const token = useAuthStore.getState().accessToken ?? accessToken;
      if (!token) return;

      const url = new URL(`/api/${slugAtStart}/stream/orders`, resolveApiOrigin());
      url.searchParams.set("access_token", token);
      if (cancelled) return;

      const es = new EventSource(url.toString());
      ownedEs = es;
      if (cancelled) {
        es.close();
        ownedEs = null;
        return;
      }
      esRef.current?.close();
      esRef.current = es;

      const flushInvalidations = () => {
        listInvalidateTimerRef.current = null;
        const orderIds = [...pendingOrderIdsRef.current];
        pendingOrderIdsRef.current.clear();
        void qc.invalidateQueries({ queryKey: ["orders", slugAtStart] });
        for (const orderId of orderIds) {
          void qc.invalidateQueries({ queryKey: ["order", slugAtStart, orderId] });
        }
        invalidateLiveDashboardQueries(qc, slugAtStart);
      };

      es.onmessage = (ev) => {
        try {
          const p = JSON.parse(ev.data) as StreamPayload;
          if (p.type !== "order.updated" || typeof p.order_id !== "number") return;
          pendingOrderIdsRef.current.add(p.order_id);
          if (listInvalidateTimerRef.current != null) {
            clearTimeout(listInvalidateTimerRef.current);
          }
          listInvalidateTimerRef.current = setTimeout(flushInvalidations, 450);
        } catch {
          /* ignore */
        }
      };

      es.onerror = () => {
        try {
          es.close();
        } catch {
          /* ignore */
        }
        if (ownedEs === es) ownedEs = null;
        if (esRef.current === es) esRef.current = null;
        if (nudgeRef.current) return;
        nudgeRef.current = true;
        void api
          .get(`/api/${slugAtStart}/protected`)
          .catch(() => {
            /* 401 → interceptor refresh */
          })
          .finally(() => {
            window.setTimeout(() => {
              nudgeRef.current = false;
            }, 2000);
          });
      };
    })();

    return () => {
      cancelled = true;
      if (listInvalidateTimerRef.current != null) {
        clearTimeout(listInvalidateTimerRef.current);
        listInvalidateTimerRef.current = null;
      }
      pendingOrderIdsRef.current.clear();
      ownedEs?.close();
      ownedEs = null;
      if (esRef.current) {
        esRef.current.close();
        esRef.current = null;
      }
    };
  }, [qc, tenantSlug, accessToken]);

  return null;
}
