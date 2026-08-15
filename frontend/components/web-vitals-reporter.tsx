"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/lib/auth-store";
import { api } from "@/lib/api";

type Metric = { name: string; value: number; id: string };

function sendMetric(tenantSlug: string, metric: Metric, path: string) {
  void api
    .post(`/api/${tenantSlug}/metrics/web-vitals`, {
      name: metric.name,
      value: metric.value,
      id: metric.id,
      path
    })
    .catch(() => {
      /* telemetry optional — silent fail */
    });
}

/** Core Web Vitals → backend Prometheus histogram. */
export function WebVitalsReporter() {
  const tenantSlug = useAuthStore((s) => s.tenantSlug);

  useEffect(() => {
    if (!tenantSlug || typeof window === "undefined") return;

    let cancelled = false;

    void import("web-vitals").then(({ onCLS, onFCP, onINP, onLCP, onTTFB }) => {
      if (cancelled) return;
      const path = window.location.pathname;
      const report = (m: Metric) => sendMetric(tenantSlug, m, path);
      onCLS((m) => report(m));
      onFCP((m) => report(m));
      onINP((m) => report(m));
      onLCP((m) => report(m));
      onTTFB((m) => report(m));
    });

    return () => {
      cancelled = true;
    };
  }, [tenantSlug]);

  return null;
}
