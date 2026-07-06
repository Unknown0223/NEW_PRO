"use client";

import { resolveApiOrigin } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { activityPathInfo } from "@/lib/activity-path-map";
import { usePathname } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  type ReactNode
} from "react";

export type TrackIntentInput = {
  /** form_open | form_abandon | view_intent */
  eventType: "form_open" | "form_abandon" | "view_intent";
  /** Berilmasa joriy sahifa modul/bo'limi ishlatiladi. */
  module?: string;
  section?: string;
  entityType?: string;
  entityId?: string | number;
  label?: string;
  meta?: Record<string, unknown>;
};

type ActivityEventPayload = {
  event_type: string;
  module: string;
  section?: string;
  entity_type?: string;
  entity_id?: string;
  route?: string;
  label?: string;
  duration_ms?: number;
  meta?: Record<string, unknown>;
};

type TrackerCtx = {
  trackIntent: (input: TrackIntentInput) => void;
};

const Ctx = createContext<TrackerCtx>({ trackIntent: () => {} });

export function useActivityTracker(): TrackerCtx {
  return useContext(Ctx);
}

/**
 * Forma/dialog "ochildi → saqlamasdan yopildi" niyatini kuzatadi.
 * Mount'da `form_open`, unmount'da (agar `markSaved` chaqirilmagan bo'lsa) `form_abandon`.
 * Misol: agent klient tahrir formasini ochdi, lekin o'zgartirmasdan chiqdi.
 */
export function useFormIntentTracking(params: {
  active?: boolean;
  module?: string;
  section?: string;
  entityType?: string;
  entityId?: string | number;
  label?: string;
}): { markSaved: () => void } {
  const { trackIntent } = useActivityTracker();
  const savedRef = useRef(false);
  const active = params.active ?? true;
  // params'ni ref orqali barqaror saqlaymiz (effekt qayta ishlamasin).
  const paramsRef = useRef(params);
  paramsRef.current = params;

  useEffect(() => {
    if (!active) return;
    savedRef.current = false;
    const p = paramsRef.current;
    trackIntent({
      eventType: "form_open",
      module: p.module,
      section: p.section,
      entityType: p.entityType,
      entityId: p.entityId,
      label: p.label
    });
    return () => {
      if (savedRef.current) return;
      const pp = paramsRef.current;
      trackIntent({
        eventType: "form_abandon",
        module: pp.module,
        section: pp.section,
        entityType: pp.entityType,
        entityId: pp.entityId,
        label: pp.label
      });
    };
  }, [active, trackIntent]);

  return {
    markSaved: () => {
      savedRef.current = true;
    }
  };
}

const FLUSH_INTERVAL_MS = 15_000;

export function ActivityTrackerProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const buffer = useRef<ActivityEventPayload[]>([]);
  const currentRef = useRef<{ info: ReturnType<typeof activityPathInfo>; route: string; enteredAt: number } | null>(null);

  const flush = useCallback((useKeepalive = false) => {
    if (buffer.current.length === 0) return;
    const tenantSlug = useAuthStore.getState().tenantSlug;
    const token = useAuthStore.getState().accessToken;
    if (!tenantSlug || !token) {
      buffer.current = [];
      return;
    }
    const events = buffer.current;
    buffer.current = [];
    const url = `${resolveApiOrigin()}/api/${tenantSlug}/activity/track`;
    try {
      void fetch(url, {
        method: "POST",
        keepalive: useKeepalive,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ events })
      }).catch(() => {
        /* best-effort: kuzatuv xatosi ilovaga ta'sir qilmaydi */
      });
    } catch {
      /* ignore */
    }
  }, []);

  const enqueue = useCallback((event: ActivityEventPayload) => {
    buffer.current.push(event);
    if (buffer.current.length >= 20) flush(false);
  }, [flush]);

  const trackIntent = useCallback(
    (input: TrackIntentInput) => {
      const info = currentRef.current?.info;
      const targetModule = input.module ?? info?.module;
      if (!targetModule) return;
      enqueue({
        event_type: input.eventType,
        module: targetModule,
        section: input.section ?? info?.section,
        entity_type: input.entityType ?? info?.entityType,
        entity_id: input.entityId != null ? String(input.entityId) : info?.entityId,
        route: currentRef.current?.route,
        label: input.label,
        meta: input.meta
      });
    },
    [enqueue]
  );

  // Sahifa o'zgarishi: oldingi page_view davomiyligini yozib, yangisini boshlaymiz.
  useEffect(() => {
    const now = Date.now();
    const prev = currentRef.current;
    if (prev?.info) {
      enqueue({
        event_type: "page_view",
        module: prev.info.module,
        section: prev.info.section,
        entity_type: prev.info.entityType,
        entity_id: prev.info.entityId,
        route: prev.route,
        duration_ms: now - prev.enteredAt
      });
    }
    const info = activityPathInfo(pathname || "/");
    currentRef.current = info ? { info, route: pathname || "/", enteredAt: now } : null;
  }, [pathname, enqueue]);

  // Davriy flush + sahifa yashirilganda/yopilganda yakuniy flush (duration bilan).
  useEffect(() => {
    const interval = setInterval(() => flush(false), FLUSH_INTERVAL_MS);
    const finalize = () => {
      const prev = currentRef.current;
      if (prev?.info) {
        enqueue({
          event_type: "page_view",
          module: prev.info.module,
          section: prev.info.section,
          entity_type: prev.info.entityType,
          entity_id: prev.info.entityId,
          route: prev.route,
          duration_ms: Date.now() - prev.enteredAt
        });
        currentRef.current = { ...prev, enteredAt: Date.now() };
      }
      flush(true);
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") finalize();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", finalize);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", finalize);
      flush(false);
    };
  }, [flush, enqueue]);

  return <Ctx.Provider value={{ trackIntent }}>{children}</Ctx.Provider>;
}
