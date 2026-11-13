"use client";

import { useEffect, useRef } from "react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import {
  currentIdleTimeoutMs,
  isWebSessionAbsoluteExpired,
  loginUrlWithReturn,
  markWebSessionStarted,
  readRememberLoginPreference
} from "@/lib/session-idle";

const ACTIVITY_EVENTS = ["mousedown", "keydown", "touchstart", "scroll", "mousemove"] as const;
const CHECK_MS = 10_000;
const MOUSE_THROTTLE_MS = 1_000;

/**
 * Faolsizlik 15 daqiqa / «Запомнить» 1 soat + qat’iy max 1 soat → login?from=…
 * Qayta kirganda oxirgi sahifa tiklanadi.
 */
export function IdleSessionWatcher() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const clearSession = useAuthStore((s) => s.clearSession);
  const lastActivityRef = useRef(Date.now());
  const lastMouseRef = useRef(0);
  const loggingOutRef = useRef(false);

  useEffect(() => {
    if (!accessToken) return;
    loggingOutRef.current = false;
    lastActivityRef.current = Date.now();
    markWebSessionStarted();

    const mark = () => {
      lastActivityRef.current = Date.now();
    };

    const onMouseMove = () => {
      const now = Date.now();
      if (now - lastMouseRef.current < MOUSE_THROTTLE_MS) return;
      lastMouseRef.current = now;
      mark();
    };

    for (const ev of ACTIVITY_EVENTS) {
      window.addEventListener(ev, ev === "mousemove" ? onMouseMove : mark, { passive: true });
    }

    const logoutIdle = async () => {
      if (loggingOutRef.current) return;
      loggingOutRef.current = true;
      const returnTo = loginUrlWithReturn(window.location.pathname, window.location.search);
      const rt = useAuthStore.getState().refreshToken;
      try {
        if (rt) await api.post("/auth/logout", { refreshToken: rt });
      } catch {
        /* ignore */
      }
      clearSession();
      if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
        window.location.assign(returnTo);
      }
    };

    const tick = () => {
      if (isWebSessionAbsoluteExpired()) {
        void logoutIdle();
        return;
      }
      const limit = currentIdleTimeoutMs();
      if (Date.now() - lastActivityRef.current >= limit) {
        void logoutIdle();
      }
    };

    const id = window.setInterval(tick, CHECK_MS);
    void readRememberLoginPreference();
    tick();

    return () => {
      window.clearInterval(id);
      for (const ev of ACTIVITY_EVENTS) {
        window.removeEventListener(ev, ev === "mousemove" ? onMouseMove : mark);
      }
    };
  }, [accessToken, clearSession]);

  return null;
}
